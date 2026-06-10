import type { EntityId } from '../../../shared/domain/ids';
import { gridPos, type GridPos } from '../../../shared/domain/positions';
import { isEntityWithinAttackRange } from '../../../shared/combat/engagement';

import type { WorldState } from '../../ecs/world-state';
import type { Command } from '../../ecs/commands';
import type { DomainEvent } from '../../ecs/events';
import type { SystemContext } from '../../ecs/scheduler';
import { OUTBOX_RESOURCE } from '../../ecs/outbox';

import type { ComponentType } from '../../ecs/component-registry';

import type { registerCombatComponents } from '../../ecs/combat-components';
import Formulas from '../../formulas';
import Types from '../../../shared/gametypes-browser';
import type { EntityKind } from '../../../shared/entity-kind-domain';
import { buildAttackAction, buildDespawnAction, buildDropAction } from '../../protocol/outbound-actions';

import type { WorldMessage } from '../contracts';
import type { registerSpawnReplicationComponents } from '../../replication/spawn-replication';

import type { registerMobAiComponents } from '../../ecs/mob-ai-components';

import type { PlayerLike } from '../player-like';

type DroppedItem = Readonly<{ id: EntityId; kind: EntityKind }>;
type DroppedMob = Readonly<{ kind: EntityKind; x: number; y: number }>;

import { createResourceKey } from '../../ecs/resources';
import type { ChunkOverlayStore } from '../chunks/chunk-overlay-store';

import type { RectClaim } from '../claims/claims-store';

import Log from '../../log';

import { mapScopedGroupKey } from '../ecs-command-pipeline/interest-replication';

import { resolveServerMovementNetcodeConfig } from '../../movement-netcode-config';

import type { MapTransitionEvent } from '../map-transition-observability';
import { resolveEntityMapId, resolveMapForId } from '../ecs-command-pipeline/map-runtime';

export const CHUNK_OVERLAY_STORE_RESOURCE = createResourceKey<ChunkOverlayStore>('chunk_overlay_store');
export const MOVE_SYNC_STATE_RESOURCE = createResourceKey<Map<EntityId, number>>('move_sync_state');
export const PLAYER_RECENT_POSITION_HISTORY_RESOURCE = createResourceKey<
    Map<EntityId, Array<{ pos: GridPos; tick: number }>>
>('player_recent_position_history');
export const ENTITY_STATE_BATCH_RESOURCE =
    createResourceKey<Map<string, Map<EntityId, { x: number; y: number; flags: number }>>>('entity_state_batch');

type WorldCommandHost = Readonly<{
    id?: string;
    ups: number;
    map: {
        getCheckpoint(id: string | number): { id?: string | number } | null | undefined;
        isDoor(x: number, y: number): boolean;
        getDoorDestination(x: number, y: number): { x: number; y: number } | null;
        getGroupIdFromPosition(x: number, y: number): string;
        forEachAdjacentGroup(groupId: string | null | undefined, callback: (groupId: string) => void): void;
        // Server map supports these, but some older host surfaces didn't type them.
        grid?: number[][];
        width?: number;
        height?: number;
        isOutOfBounds?(x: number, y: number): boolean;
    };
    getDefaultMapId?(): string;
    getMapById?(mapId: string): {
        getCheckpoint(id: string | number): { id?: string | number } | null | undefined;
        isDoor(x: number, y: number): boolean;
        getDoorDestination(x: number, y: number): { x: number; y: number } | null;
        getGroupIdFromPosition(x: number, y: number): string;
        forEachAdjacentGroup(groupId: string | null | undefined, callback: (groupId: string) => void): void;
        grid?: number[][];
        width?: number;
        height?: number;
        isOutOfBounds?(x: number, y: number): boolean;
    } | null;
    resolveDoorTeleport?(mapId: string, x: number, y: number): Readonly<{ toMapId: string; to: GridPos }> | null;
    isValidPositionForMap?(mapId: string, x: number, y: number): boolean;
    getConnectionPlayerById(playerId: EntityId): PlayerLike | null;
    removeEntityFromAreas(entityId: EntityId): void;
    scheduleMobRespawn(params: {
        mobId: EntityId;
        kind: EntityKind;
        spawn: GridPos;
        tickNow?: number;
        delaySeconds?: number;
    }): void;
    scheduleStaticItemRespawn(params: {
        itemId: EntityId;
        kind: EntityKind;
        spawn: GridPos;
        tickNow?: number;
        delaySeconds?: number;
    }): void;
    addPlayer(player: PlayerLike): void;
    emitPlayerEnter(player: PlayerLike): void;
    isPlayerActive(playerId: EntityId): boolean;
    pushSpawnsToPlayerId(playerId: EntityId, entities: EntityId[]): void;
    isValidPosition(x: number, y: number): boolean;
    getDroppedItem(mob: DroppedMob): DroppedItem | null;
    handleItemDespawn(item: Readonly<{ id: EntityId }>): void;
    removeEntity(entity: PlayerLike): void;
    addItemFromChest(kind: EntityKind, x: number, y: number): DroppedItem;
    pushToPlayerId(playerId: EntityId, message: WorldMessage): void;
    persistPlayerEquipment(player: PlayerLike): void;
    persistPlayerCheckpoint(playerName: string, checkpointId: number): void;
    persistPlayerAchievementUnlock(playerName: string, achievementId: number): void;
    recordPlayerMobKill(playerName: string, mobKind: EntityKind): void;
    recordPlayerDamageTaken(playerName: string, damage: number): void;
    recordPlayerRevive(playerName: string): void;
    persistClaimUpsert?(claim: RectClaim): void;
    persistClaimDelete?(claimId: number): void;
    ensureChunkOverlayLoaded?(mapId: string, chunkX: number, chunkY: number): boolean;
    ensureChunkOverlayLoadedForTile?(x: number, y: number, mapId?: string): boolean;
    recordMapTransitionEvent?(event: MapTransitionEvent): void;
}>;

import {
    addMobHate,
    clearPlayerFromMobAggro,
    isEntityVisibleToPlayer,
    isPlayerInAttackRangeWithGrace,
    resolvePlayerIdentityKey,
} from '../ecs-command-pipeline';
const log = Log.getLogger();

function clearTargetsForDeadEntity({
    state,
    replication,
    deadEntityId,
}: {
    state: WorldState<Command, DomainEvent>;
    replication: ReturnType<typeof registerSpawnReplicationComponents>;
    deadEntityId: EntityId;
}): void {
    const Target = replication.Target;
    const toClearTargets: EntityId[] = [];

    Target.store.forEach((attackerId, targetId) => {
        if (targetId === deadEntityId) {
            toClearTargets.push(attackerId);
        }
    });

    for (let i = 0; i < toClearTargets.length; i += 1) {
        const attackerId = toClearTargets[i];
        if (attackerId === undefined) {
            continue;
        }

        if (!state.world.entities.isAlive(attackerId)) {
            continue;
        }
        state.world.removeComponent(attackerId, Target);
    }
}

function resolveAttackCooldownMs(kind: EntityKind): number {
    if (Types.isPlayer(kind)) {
        return 800;
    }

    switch (kind) {
        case Types.Entities.SKELETON:
        case Types.Entities.SKELETON2:
            return 1300;
        case Types.Entities.SPECTRE:
            return 900;
        case Types.Entities.GOBLIN:
            return 700;
        case Types.Entities.BOSS:
            return 2000;
        default:
            return 800;
    }
}

function resolveAttackCooldownTicks(kind: EntityKind, ups: number): number {
    const ms = resolveAttackCooldownMs(kind);
    return Math.max(1, Math.floor((ups * ms) / 1000));
}

function resolveAttackWindupMs(kind: EntityKind): number {
    const cooldownMs = resolveAttackCooldownMs(kind);
    return Math.max(80, Math.min(200, Math.floor(cooldownMs * 0.25)));
}

function resolveAttackWindupTicks(kind: EntityKind, ups: number): number {
    const ms = resolveAttackWindupMs(kind);
    return Math.max(1, Math.ceil((ups * ms) / 1000));
}

function resolveCombatStat({
    state,
    component,
    entityId,
    fallback,
}: {
    state: WorldState<Command, DomainEvent>;
    component: ComponentType<number>;
    entityId: EntityId;
    fallback?: number;
}): number {
    const ecsValue = state.world.getComponent(entityId, component);
    if (typeof ecsValue === 'number') {
        return ecsValue;
    }

    const value = typeof fallback === 'number' ? fallback : 0;
    state.world.addComponent(entityId, component, value);
    return value;
}

function handleMobDeath({
    state,
    replication,
    MapId,
    world,
    mobId,
    killerId,
    mobKind,
    spawn,
    haters,
    tickNow,
}: {
    state: WorldState<Command, DomainEvent>;
    replication: ReturnType<typeof registerSpawnReplicationComponents>;
    MapId: ComponentType<string>;
    world: WorldCommandHost;
    mobId: EntityId;
    killerId: EntityId;
    mobKind: EntityKind;
    spawn: GridPos;
    haters: number[];
    tickNow: number;
}): void {
    clearTargetsForDeadEntity({ state, replication, deadEntityId: mobId });

    state.events.push({ type: 'MOB_KILLED', mobId, mobKind, killerId });

    const outbox = state.resources.require(OUTBOX_RESOURCE);
    const pos = state.world.getComponent(mobId, replication.Position);
    const mobMapId = resolveEntityMapId({ MapId, entityId: mobId, world });
    const map = resolveMapForId({ world, mapId: mobMapId });
    const fallbackGroupId =
        pos !== undefined && map ? mapScopedGroupKey(mobMapId, map.getGroupIdFromPosition(pos.x, pos.y)) : undefined;

    const dropPos = pos ?? spawn;
    const droppedItem = world.getDroppedItem({ kind: mobKind, x: dropPos.x, y: dropPos.y });
    if (droppedItem) {
        outbox.push({
            kind: 'broadcast_nearby',
            actorId: mobId,
            action: buildDropAction(mobId, droppedItem.id, droppedItem.kind, haters),
            fallbackGroupId,
        });
        world.handleItemDespawn(droppedItem);
    }

    outbox.push({ kind: 'broadcast_nearby', actorId: mobId, action: buildDespawnAction(mobId), fallbackGroupId });
    world.removeEntityFromAreas(mobId);
    world.scheduleMobRespawn({ mobId, kind: mobKind, spawn, tickNow });
    if (state.world.entities.isAlive(mobId)) {
        state.world.destroyEntity(mobId);
    }
}

function handlePlayerDeath({
    state,
    ctx,
    mobAi,
    replication,
    world,
    playerId,
}: {
    state: WorldState<Command, DomainEvent>;
    ctx: SystemContext;
    mobAi: ReturnType<typeof registerMobAiComponents>;
    replication: ReturnType<typeof registerSpawnReplicationComponents>;
    world: WorldCommandHost;
    playerId: EntityId;
}): void {
    const player = world.getConnectionPlayerById(playerId);

    if (player) {
        player.isDead = true;
        if (player.firepotionTimeout) {
            clearTimeout(player.firepotionTimeout);
        }
    }

    clearTargetsForDeadEntity({ state, replication, deadEntityId: playerId });
    clearPlayerFromMobAggro({ state, mobAi, replication, world, playerId, tickNow: ctx.tick });

    if (player) {
        world.removeEntity(player);
    }
}

export function runServerAuthoritativeCombatSystem({
    state,
    ctx,
    combat,
    mobAi,
    replication,
    MapId,
    world,
}: {
    state: WorldState<Command, DomainEvent>;
    ctx: SystemContext;
    combat: ReturnType<typeof registerCombatComponents>;
    mobAi: ReturnType<typeof registerMobAiComponents>;
    replication: ReturnType<typeof registerSpawnReplicationComponents>;
    MapId: ComponentType<string>;
    world: WorldCommandHost;
}): void {
    const AttackWindup = combat.AttackWindup;

    AttackWindup.store.forEach((attackerId, windup) => {
        if (!state.world.entities.isAlive(attackerId)) {
            state.world.removeComponent(attackerId, AttackWindup);
            return;
        }
        const targetId = replication.Target.store.get(attackerId);
        if (targetId === undefined || targetId !== windup.targetId || !state.world.entities.isAlive(windup.targetId)) {
            state.world.removeComponent(attackerId, AttackWindup);
        }
    });

    const engagements: Array<{ attackerId: EntityId; targetId: EntityId }> = [];
    replication.Target.store.forEach((attackerId, targetId) => {
        engagements.push({ attackerId, targetId });
    });

    const ups = Math.max(1, world.ups);

    for (let i = 0; i < engagements.length; i += 1) {
        const engagement = engagements[i];
        if (!engagement) {
            continue;
        }

        const attackerAlive = state.world.entities.isAlive(engagement.attackerId);
        const targetAlive = state.world.entities.isAlive(engagement.targetId);
        if (!attackerAlive && !targetAlive) {
            continue;
        }
        if (!attackerAlive) {
            continue;
        }
        if (!targetAlive) {
            state.world.removeComponent(engagement.attackerId, AttackWindup);
            state.world.removeComponent(engagement.attackerId, replication.Target);
            continue;
        }

        const attackerKind = state.world.getComponent(engagement.attackerId, replication.Kind);
        const targetKind = state.world.getComponent(engagement.targetId, replication.Kind);
        if (attackerKind === undefined || targetKind === undefined) {
            state.world.removeComponent(engagement.attackerId, AttackWindup);
            state.world.removeComponent(engagement.attackerId, replication.Target);
            continue;
        }

        const isPlayerVsMob = Types.isPlayer(attackerKind) && Types.isMob(targetKind);
        const isMobVsPlayer = Types.isMob(attackerKind) && Types.isPlayer(targetKind);
        if (!isPlayerVsMob && !isMobVsPlayer) {
            continue;
        }

        if (isMobVsPlayer) {
            const mobHateEntries = mobAi.MobHate.store.get(engagement.attackerId)?.entries ?? [];
            const hasHateForTarget = mobHateEntries.some((entry) => entry.id === engagement.targetId && entry.hate > 0);
            if (!hasHateForTarget) {
                state.world.removeComponent(engagement.attackerId, AttackWindup);
                state.world.removeComponent(engagement.attackerId, replication.Target);
                continue;
            }
        }

        const attackerPos = state.world.getComponent(engagement.attackerId, replication.Position);
        const targetPos = state.world.getComponent(engagement.targetId, replication.Position);
        const attackerWeaponKind = state.world.getComponent(engagement.attackerId, replication.Weapon);
        const isInRange =
            attackerPos !== undefined &&
            targetPos !== undefined &&
            isEntityWithinAttackRange({
                attackerPos,
                targetPos,
                attackerKind,
                attackerWeaponKind,
            });
        const isInRangeWithGrace =
            isPlayerVsMob &&
            targetPos !== undefined &&
            isPlayerInAttackRangeWithGrace({
                state,
                attackerId: engagement.attackerId,
                targetPos,
                attackerKind,
                attackerWeaponKind,
                currentTick: ctx.tick,
            });
        const isVisible =
            isMobVsPlayer && attackerPos !== undefined && targetPos !== undefined
                ? isEntityVisibleToPlayer({
                      world,
                      playerPos: targetPos,
                      playerMapId: resolveEntityMapId({ MapId, entityId: engagement.targetId, world }),
                      entityPos: attackerPos,
                      entityMapId: resolveEntityMapId({ MapId, entityId: engagement.attackerId, world }),
                  })
                : true;

        const windup = AttackWindup.store.get(engagement.attackerId);
        const nextAttackTick = state.world.getComponent(engagement.attackerId, combat.NextAttackTick) ?? 0;
        if (!windup && ctx.tick < nextAttackTick) {
            continue;
        }

        if (!windup) {
            if ((!isInRange && !isInRangeWithGrace) || !isVisible) {
                continue;
            }
            if (isPlayerVsMob) {
                state.events.push({
                    type: 'ENTITY_ATTACKED',
                    attackerId: engagement.attackerId,
                    targetId: engagement.targetId,
                });
                log.event('info', 'combat.player_windup_started', {
                    attackerId: engagement.attackerId,
                    targetId: engagement.targetId,
                    profile: resolveServerMovementNetcodeConfig().profileId,
                    tick: ctx.tick,
                    attackerPos: attackerPos === undefined ? null : { x: attackerPos.x, y: attackerPos.y },
                    targetPos: { x: targetPos.x, y: targetPos.y },
                    startedViaGrace: !isInRange && isInRangeWithGrace,
                });
            }
            if (isMobVsPlayer) {
                const outbox = state.resources.require(OUTBOX_RESOURCE);
                const attack = buildAttackAction(engagement.attackerId, engagement.targetId);
                outbox.push({ kind: 'to_player', playerId: engagement.targetId, action: attack });
                outbox.push({
                    kind: 'broadcast_nearby',
                    actorId: engagement.attackerId,
                    action: attack,
                    ignoredPlayerId: engagement.targetId,
                });
            }
            const cooldownTicks = resolveAttackCooldownTicks(attackerKind, ups);
            const windupTicks = resolveAttackWindupTicks(attackerKind, ups);
            state.world.addComponent(engagement.attackerId, combat.NextAttackTick, ctx.tick + cooldownTicks);
            state.world.addComponent(engagement.attackerId, AttackWindup, {
                targetId: engagement.targetId,
                hitAtTick: ctx.tick + windupTicks,
            });
            continue;
        }

        if (windup.targetId !== engagement.targetId) {
            if (isPlayerVsMob) {
                log.event('warn', 'combat.player_windup_cleared_target_changed', {
                    attackerId: engagement.attackerId,
                    windupTargetId: windup.targetId,
                    currentTargetId: engagement.targetId,
                    tick: ctx.tick,
                });
            }
            state.world.removeComponent(engagement.attackerId, AttackWindup);
            continue;
        }

        if (ctx.tick < windup.hitAtTick) {
            const windupRangeOk = isInRange || (isPlayerVsMob && isInRangeWithGrace);
            if (!windupRangeOk || !isVisible) {
                if (isPlayerVsMob) {
                    log.event('warn', 'combat.player_windup_cleared_before_hit', {
                        attackerId: engagement.attackerId,
                        targetId: engagement.targetId,
                        tick: ctx.tick,
                        hitAtTick: windup.hitAtTick,
                        isInRange,
                        isInRangeWithGrace,
                        isVisible,
                        attackerPos: attackerPos ? { x: attackerPos.x, y: attackerPos.y } : null,
                        targetPos: targetPos ? { x: targetPos.x, y: targetPos.y } : null,
                    });
                }
                state.world.removeComponent(engagement.attackerId, AttackWindup);
            }
            continue;
        }

        // Hit-frame: apply damage only if still in range at this tick.
        state.world.removeComponent(engagement.attackerId, AttackWindup);
        if (!isInRange || !isVisible) {
            if (isPlayerVsMob) {
                log.event('warn', 'combat.player_hitframe_canceled', {
                    attackerId: engagement.attackerId,
                    targetId: engagement.targetId,
                    tick: ctx.tick,
                    isInRange,
                    isVisible,
                    attackerPos: attackerPos ? { x: attackerPos.x, y: attackerPos.y } : null,
                    targetPos: targetPos ? { x: targetPos.x, y: targetPos.y } : null,
                });
            }
            if (isMobVsPlayer) {
                state.world.removeComponent(engagement.attackerId, replication.Target);
            }
            continue;
        }

        const attackerWeapon = resolveCombatStat({
            state,
            component: combat.WeaponLevel,
            entityId: engagement.attackerId,
            fallback: 1,
        });
        const targetArmor = resolveCombatStat({
            state,
            component: combat.ArmorLevel,
            entityId: engagement.targetId,
            fallback: 1,
        });

        const damage = Formulas.dmg(attackerWeapon, targetArmor);
        if (damage <= 0) {
            continue;
        }

        if (isPlayerVsMob) {
            const mobHp = resolveCombatStat({
                state,
                component: combat.HitPoints,
                entityId: engagement.targetId,
                fallback: 1,
            });
            const nextMobHp = Math.max(0, mobHp - damage);
            state.world.addComponent(engagement.targetId, combat.HitPoints, nextMobHp);

            addMobHate({
                state,
                mobAi,
                replication,
                mobId: engagement.targetId,
                playerId: engagement.attackerId,
                hatePoints: damage,
            });

            state.events.push({
                type: 'ENTITY_DAMAGED',
                entityId: engagement.targetId,
                damage,
                attackerId: engagement.attackerId,
            });

            if (nextMobHp <= 0) {
                const killer = world.getConnectionPlayerById(engagement.attackerId);
                const killerIdentity = resolvePlayerIdentityKey(killer);
                if (killerIdentity) {
                    world.recordPlayerMobKill(killerIdentity, targetKind);
                }
                const spawn =
                    mobAi.MobSpawnPos.store.get(engagement.targetId) ??
                    state.world.getComponent(engagement.targetId, replication.Position) ??
                    gridPos(0, 0);
                const haters =
                    mobAi.MobHate.store.get(engagement.targetId)?.entries.map((entry) => Number(entry.id)) ?? [];
                handleMobDeath({
                    state,
                    replication,
                    MapId,
                    world,
                    mobId: engagement.targetId,
                    killerId: engagement.attackerId,
                    mobKind: targetKind,
                    spawn,
                    haters,
                    tickNow: ctx.tick,
                });
            }
            continue;
        }

        const playerHp = resolveCombatStat({
            state,
            component: combat.HitPoints,
            entityId: engagement.targetId,
            fallback: 1,
        });
        const nextPlayerHp = Math.max(0, playerHp - damage);

        state.world.addComponent(engagement.targetId, combat.HitPoints, nextPlayerHp);
        state.events.push({
            type: 'PLAYER_HEALTH_CHANGED',
            playerId: engagement.targetId,
            hitPoints: nextPlayerHp,
            isRegen: false,
        });
        const targetPlayer = world.getConnectionPlayerById(engagement.targetId);
        const targetIdentity = resolvePlayerIdentityKey(targetPlayer);
        if (targetIdentity) {
            world.recordPlayerDamageTaken(targetIdentity, damage);
        }

        if (nextPlayerHp <= 0) {
            handlePlayerDeath({
                state,
                ctx,
                mobAi,
                replication,
                world,
                playerId: engagement.targetId,
            });
        }
    }
}
