import type { EntityId } from '../../shared/domain/ids';
import { gridPos, type GridPos } from '../../shared/domain/positions';
import { WorldState } from '../ecs/world-state';
import type { Command } from '../ecs/commands';
import type { DomainEvent } from '../ecs/events';
import { Scheduler, type SchedulerStage, type System, type SystemContext } from '../ecs/scheduler';
import { OUTBOX_RESOURCE, type OutboxMessage } from '../ecs/outbox';
import { Queue } from '../ecs/queues';
import { flushDomainEventsToOutboxSystem } from '../ecs/outbox-systems';
import type { ComponentType } from '../ecs/component-registry';
import { InterestTracker } from '../ecs/interest-tracker';
import { INTEREST_TRACKER_RESOURCE } from '../ecs/spatial-resources';
import { registerCombatComponents } from '../ecs/combat-components';
import Player from '../player';
import Utils from '../utils';
import Formulas from '../formulas';
import Types from '../../shared/gametypes-browser';
import type { EntityKind } from '../../shared/entity-kind-domain';
import Chest from '../chest';
import {
    buildAchievementsAction,
    buildBlinkAction,
    buildChatAction,
    buildDespawnAction,
    buildDestroyAction,
    buildEquipAction,
    buildHpAction,
    buildLootMoveAction,
    buildTeleportAction,
    buildWelcomeAction,
} from '../protocol/outbound-actions';
import type { ServerToClientProtocolAction, ServerToClientSpawnAction } from '../../shared/protocol/types';
import {
    buildSpawnActionFromReplicationState,
    registerSpawnReplicationComponents,
    syncSpawnReplicationFromLegacyEntity,
    type LegacySpawnReplicationEntity,
} from '../replication/spawn-replication';
import { registerEffectsComponents } from '../ecs/effects-components';
import { registerItemLifecycleComponents } from '../ecs/item-lifecycle-components';
import { RESPAWN_TASKS_RESOURCE, type RespawnTask, type RespawnableEntity } from '../ecs/respawn-tasks';
import { registerMobAiComponents, type MobHateEntry } from '../ecs/mob-ai-components';

const HEALING_ITEM_POINTS_BY_KIND: Partial<Record<EntityKind, number>> = {
    [Types.Entities.FLASK]: 40,
    [Types.Entities.BURGER]: 100,
};

type WorldCommandHost = Readonly<{
    ups: number;
    map: {
        getCheckpoint(id: string | number): { id?: string | number } | null;
        getGroupIdFromPosition(x: number, y: number): string;
        forEachAdjacentGroup(groupId: string | null | undefined, callback: (groupId: string) => void): void;
    };
    getConnectionPlayerById(playerId: EntityId): Player | null;
    getEntityById(id: EntityId): unknown;
    addPlayer(player: Player): void;
    emit(eventName: 'playerEnter', player: Player): void;
    isPlayerActive(playerId: EntityId): boolean;
    pushSpawnsToPlayerId(playerId: EntityId, entities: EntityId[]): void;
    isValidPosition(x: number, y: number): boolean;
    getDroppedItem(mob: unknown): unknown;
    handleItemDespawn(item: unknown): void;
    moveEntity(entity: unknown, x: number, y: number): void;
    removeEntity(entity: unknown): void;
    addItemFromChest(kind: unknown, x: number, y: number): unknown;
    pushToPlayerId(playerId: EntityId, message: unknown): void;
    persistPlayerEquipment(player: Player): void;
    persistPlayerCheckpoint(playerName: string, checkpointId: number): void;
    persistPlayerAchievementUnlock(playerName: string, achievementId: number): void;
    recordPlayerMobKill(playerName: string, mobKind: EntityKind): void;
    recordPlayerDamageTaken(playerName: string, damage: number): void;
    recordPlayerRevive(playerName: string): void;
}>;

function isPlayer(value: unknown): value is Player {
    return value instanceof Player;
}

function asGridPos(value: unknown): GridPos | null {
    const obj = value as { x?: unknown; y?: unknown } | null;
    if (!obj || typeof obj.x !== 'number' || typeof obj.y !== 'number') {
        return null;
    }
    return gridPos(obj.x, obj.y);
}

function isAdjacentNonDiagonal(a: GridPos, b: GridPos): boolean {
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    return dx + dy === 1;
}

function chooseStepTowards({
    from,
    to,
    isValidPosition,
}: {
    from: GridPos;
    to: GridPos;
    isValidPosition: (x: number, y: number) => boolean;
}): GridPos | null {
    const dx = to.x - from.x;
    const dy = to.y - from.y;

    const stepX = dx === 0 ? 0 : dx > 0 ? 1 : -1;
    const stepY = dy === 0 ? 0 : dy > 0 ? 1 : -1;

    const candidates: GridPos[] = [];
    if (Math.abs(dx) >= Math.abs(dy)) {
        if (stepX !== 0) candidates.push(gridPos(from.x + stepX, from.y));
        if (stepY !== 0) candidates.push(gridPos(from.x, from.y + stepY));
    } else {
        if (stepY !== 0) candidates.push(gridPos(from.x, from.y + stepY));
        if (stepX !== 0) candidates.push(gridPos(from.x + stepX, from.y));
    }

    // If we're blocked, try perpendicular directions as a fallback.
    candidates.push(gridPos(from.x + 1, from.y));
    candidates.push(gridPos(from.x - 1, from.y));
    candidates.push(gridPos(from.x, from.y + 1));
    candidates.push(gridPos(from.x, from.y - 1));

    for (let i = 0; i < candidates.length; i += 1) {
        const next = candidates[i];
        if (!next) {
            continue;
        }
        // Never step onto the target's exact tile.
        if (next.x === to.x && next.y === to.y) {
            continue;
        }
        if (isValidPosition(next.x, next.y)) {
            return next;
        }
    }

    return null;
}


function chooseStepTowardsAdjacentViaBfs({
    from,
    target,
    spawn,
    leashDistance,
    isValidPosition,
    maxNodes = 512,
}: {
    from: GridPos;
    target: GridPos;
    spawn: GridPos;
    leashDistance: number;
    isValidPosition: (x: number, y: number) => boolean;
    maxNodes?: number;
}): GridPos | null {
    if (isAdjacentNonDiagonal(from, target)) {
        return null;
    }

    const makeKey = (x: number, y: number) => `${x},${y}`;
    const visited = new Set<string>();
    visited.add(makeKey(from.x, from.y));

    type Node = { x: number; y: number; first: GridPos };
    const queue: Node[] = [];

    const canVisit = (x: number, y: number) => {
        if (x === target.x && y === target.y) {
            return false;
        }
        if (!isValidPosition(x, y)) {
            return false;
        }
        if (Utils.distanceTo(x, y, spawn.x, spawn.y) > leashDistance) {
            return false;
        }
        return !visited.has(makeKey(x, y));
    };

    const enqueue = (x: number, y: number, first: GridPos) => {
        visited.add(makeKey(x, y));
        queue.push({ x, y, first });
    };

    // Seed the BFS frontier with the mob's immediate neighbors, storing their coordinate as the "first step".
    const seeds: Array<[number, number]> = [
        [from.x + 1, from.y],
        [from.x - 1, from.y],
        [from.x, from.y + 1],
        [from.x, from.y - 1],
    ];

    for (const [x, y] of seeds) {
        if (canVisit(x, y)) {
            enqueue(x, y, gridPos(x, y));
        }
    }

    while (queue.length > 0 && visited.size <= maxNodes) {
        const node = queue.shift();
        if (!node) {
            continue;
        }

        if (isAdjacentNonDiagonal(gridPos(node.x, node.y), target)) {
            return node.first;
        }

        const neighbors: Array<[number, number]> = [
            [node.x + 1, node.y],
            [node.x - 1, node.y],
            [node.x, node.y + 1],
            [node.x, node.y - 1],
        ];

        for (const [x, y] of neighbors) {
            if (canVisit(x, y)) {
                enqueue(x, y, node.first);
            }
        }
    }

    return null;
}

function syncLegacyMobHateList(mob: unknown, entries: MobHateEntry[]): void {
    const legacy = mob as { hatelist?: unknown };
    if (!Array.isArray(legacy.hatelist)) {
        return;
    }
    legacy.hatelist.length = 0;
    for (let i = 0; i < entries.length; i += 1) {
        const entry = entries[i];
        if (entry) {
            (legacy.hatelist as Array<{ id: EntityId; hate: number }>).push({ id: entry.id, hate: entry.hate });
        }
    }
}

function addMobHate({
    state,
    mobAi,
    replication,
    world,
    mobId,
    playerId,
    hatePoints,
}: {
    state: WorldState<Command, DomainEvent>;
    mobAi: ReturnType<typeof registerMobAiComponents>;
    replication: ReturnType<typeof registerSpawnReplicationComponents>;
    world: WorldCommandHost;
    mobId: EntityId;
    playerId: EntityId;
    hatePoints: number;
}): void {
    const kind = replication.Kind.store.get(mobId);
    if (kind === undefined || !Types.isMob(kind)) {
        return;
    }

    const current = mobAi.MobHate.store.get(mobId)?.entries ?? [];
    const next: MobHateEntry[] = current.slice();
    let matched = false;
    for (let i = 0; i < next.length; i += 1) {
        const entry = next[i];
        if (entry?.id === playerId) {
            next[i] = { id: playerId, hate: entry.hate + hatePoints };
            matched = true;
            break;
        }
    }
    if (!matched) {
        next.push({ id: playerId, hate: hatePoints });
    }

    state.world.addComponent(mobId, mobAi.MobHate, { entries: next });
    state.world.removeComponent(mobId, mobAi.MobReturnAtTick);

    const mob = world.getEntityById(mobId);
    if (mob) {
        syncLegacyMobHateList(mob, next);
    }
}

function clearPlayerFromMobAggro({
    state,
    mobAi,
    replication,
    world,
    playerId,
    tickNow,
}: {
    state: WorldState<Command, DomainEvent>;
    mobAi: ReturnType<typeof registerMobAiComponents>;
    replication: ReturnType<typeof registerSpawnReplicationComponents>;
    world: WorldCommandHost;
    playerId: EntityId;
    tickNow: number;
}): void {
    const Target = replication.Target;
    const ups = Math.max(1, world.ups);
    const returnDelayTicks = ups * 4;

    const updates: Array<{ mobId: EntityId; nextEntries: MobHateEntry[] }> = [];
    mobAi.MobHate.store.forEach((mobId, hate) => {
        const nextEntries = hate.entries.filter((entry) => entry.id !== playerId);
        if (nextEntries.length !== hate.entries.length) {
            updates.push({ mobId, nextEntries });
        }
    });

    for (let i = 0; i < updates.length; i += 1) {
        const update = updates[i];
        if (!update) {
            continue;
        }
        if (update.nextEntries.length === 0) {
            state.world.removeComponent(update.mobId, mobAi.MobHate);
            state.world.addComponent(update.mobId, mobAi.MobReturnAtTick, tickNow + returnDelayTicks);
        } else {
            state.world.addComponent(update.mobId, mobAi.MobHate, { entries: update.nextEntries });
        }

        const currentTarget = Target.store.get(update.mobId);
        if (currentTarget === playerId) {
            state.world.removeComponent(update.mobId, Target);
            const mob = world.getEntityById(update.mobId) as { target?: EntityId | null } | null;
            if (mob) {
                mob.target = null;
            }
        }

        const mob = world.getEntityById(update.mobId);
        if (mob) {
            syncLegacyMobHateList(mob, update.nextEntries);
        }
    }
}

function applyHello({
    state,
    Position,
    Kind,
    Name,
    Orientation,
    Armor,
    Weapon,
    Target,
    combat,
    world,
    player,
    cmd,
}: {
    state: WorldState<Command, DomainEvent>;
    Position: ComponentType<GridPos>;
    Kind: ComponentType<EntityKind>;
    Name: ComponentType<string>;
    Orientation: ComponentType<number>;
    Armor: ComponentType<EntityKind>;
    Weapon: ComponentType<EntityKind>;
    Target: ComponentType<EntityId>;
    combat: ReturnType<typeof registerCombatComponents>;
    world: WorldCommandHost;
    player: Player;
    cmd: Extract<Command, { type: 'HELLO' }>;
}): void {
    const wasDead = player.isDead === true;
    const resolvedName = cmd.profile?.displayName ?? cmd.name;
    const resolvedArmorKind = cmd.profile?.armorKind ?? cmd.armorKind;
    const resolvedWeaponKind = cmd.profile?.weaponKind ?? cmd.weaponKind;
    const baseAchievements = cmd.profile?.achievements ?? {
        unlockedIds: [] as number[],
        ratCount: 0,
        skeletonCount: 0,
        totalKills: 0,
        totalDmg: 0,
        totalRevives: 0,
    };

    if (typeof cmd.profile?.checkpointId === 'number' && Number.isFinite(cmd.profile.checkpointId)) {
        const checkpoint = world.map.getCheckpoint(cmd.profile.checkpointId);
        if (checkpoint) {
            player.lastCheckpoint = checkpoint as typeof player.lastCheckpoint;
        }
    }

    player.name = resolvedName;
    player.kind = Types.Entities.WARRIOR;
    player.equipArmor(resolvedArmorKind);
    player.equipWeapon(resolvedWeaponKind);
    player.orientation = Utils.randomOrientation();
    player.updateHitPoints();
    player.updatePosition();

    state.world.ensureEntity(player.id);
    state.world.addComponent(player.id, Kind, player.kind);
    state.world.addComponent(player.id, Position, gridPos(player.x, player.y));
    state.world.addComponent(player.id, Name, player.name);
    state.world.addComponent(player.id, Orientation, player.orientation);
    state.world.addComponent(player.id, Armor, player.armor);
    state.world.addComponent(player.id, Weapon, player.weapon);
    state.world.removeComponent(player.id, Target);
    state.world.addComponent(player.id, combat.HitPoints, player.hitPoints);
    state.world.addComponent(player.id, combat.MaxHitPoints, player.maxHitPoints);
    state.world.addComponent(player.id, combat.ArmorLevel, player.armorLevel);
    state.world.addComponent(player.id, combat.WeaponLevel, player.weaponLevel);

    world.addPlayer(player);
    world.pushToPlayerId(
        player.id,
        buildWelcomeAction({
            id: player.id,
            name: player.name,
            x: player.x,
            y: player.y,
            hp: player.hitPoints,
        })
    );
    world.pushToPlayerId(player.id, buildEquipAction(player.id, player.armor));
    world.pushToPlayerId(player.id, buildEquipAction(player.id, player.weapon));
    if (wasDead) {
        world.recordPlayerRevive(player.name);
    }
    world.pushToPlayerId(player.id, buildAchievementsAction({
        unlockedIds: baseAchievements.unlockedIds,
        ratCount: baseAchievements.ratCount,
        skeletonCount: baseAchievements.skeletonCount,
        totalKills: baseAchievements.totalKills,
        totalDmg: baseAchievements.totalDmg,
        totalRevives: wasDead ? Math.min(5, baseAchievements.totalRevives + 1) : baseAchievements.totalRevives,
    }));
    world.persistPlayerEquipment(player);
    world.emit('playerEnter', player);
    player.hasEnteredGame = true;
    player.isDead = false;
}

function applyMoveCommand({
    state,
    Position,
    Target,
    world,
    player,
    cmd,
}: {
    state: WorldState<Command, DomainEvent>;
    Position: ComponentType<GridPos>;
    Target: ComponentType<EntityId>;
    world: WorldCommandHost;
    player: Player;
    cmd: Extract<Command, { type: 'MOVE' }>;
}): void {
    if (!world.isValidPosition(cmd.to.x, cmd.to.y)) {
        return;
    }
    player.setPosition(cmd.to.x, cmd.to.y);
    player.clearTarget();
    state.world.removeComponent(cmd.source.playerId, Target);
    state.world.addComponent(cmd.source.playerId, Position, cmd.to);
    state.events.push({ type: 'ENTITY_MOVED', entityId: cmd.source.playerId, to: cmd.to });
    player.emit('move', player.x, player.y);
}

function applyLootMoveCommand({
    state,
    Position,
    Target,
    world,
    player,
    cmd,
}: {
    state: WorldState<Command, DomainEvent>;
    Position: ComponentType<GridPos>;
    Target: ComponentType<EntityId>;
    world: WorldCommandHost;
    player: Player;
    cmd: Extract<Command, { type: 'LOOTMOVE' }>;
}): void {
    player.setPosition(cmd.to.x, cmd.to.y);
    state.world.addComponent(cmd.source.playerId, Position, cmd.to);

    const item = world.getEntityById(cmd.itemId);
    if (!item) {
        return;
    }
    player.clearTarget();
    state.world.removeComponent(cmd.source.playerId, Target);
    const outbox = state.resources.require(OUTBOX_RESOURCE);
    outbox.push({
        kind: 'broadcast_nearby',
        actorId: player.id,
        ignoredPlayerId: player.id,
        action: buildLootMoveAction(player.id, (item as { id: EntityId }).id),
    });
    player.emit('lootMove', player.x, player.y);
}

function applyAttackCommand({
    state,
    Target,
    world,
    player,
    cmd,
}: {
    state: WorldState<Command, DomainEvent>;
    Target: ComponentType<EntityId>;
    world: WorldCommandHost;
    player: Player;
    cmd: Extract<Command, { type: 'ATTACK' }>;
}): void {
    const target = world.getEntityById(cmd.targetId);
    if (!target || typeof (target as { id?: unknown }).id !== 'number') {
        return;
    }
    player.setTarget(target as { id: EntityId });
    state.world.addComponent(cmd.source.playerId, Target, cmd.targetId);
    state.events.push({ type: 'ENTITY_ATTACKED', attackerId: cmd.source.playerId, targetId: cmd.targetId });
}

function clearTargetsForDeadEntity({
    state,
    replication,
    world,
    deadEntityId,
}: {
    state: WorldState<Command, DomainEvent>;
    replication: ReturnType<typeof registerSpawnReplicationComponents>;
    world: WorldCommandHost;
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
        const legacyAttacker = world.getEntityById(attackerId) as { clearTarget?: () => void; target?: EntityId | null } | null;
        if (!legacyAttacker) {
            continue;
        }

        if (typeof legacyAttacker.clearTarget === 'function') {
            legacyAttacker.clearTarget();
        } else if ('target' in legacyAttacker) {
            legacyAttacker.target = null;
        }
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

function resolveCombatNumber({
    state,
    component,
    entityId,
    legacy,
    key,
    fallback,
}: {
    state: WorldState<Command, DomainEvent>;
    component: ComponentType<number>;
    entityId: EntityId;
    legacy: unknown;
    key: 'hitPoints' | 'maxHitPoints' | 'armorLevel' | 'weaponLevel';
    fallback?: number;
}): number {
    const ecsValue = state.world.getComponent(entityId, component);
    if (typeof ecsValue === 'number') {
        return ecsValue;
    }

    const legacyValue = (legacy as Record<string, unknown> | null)?.[key];
    if (typeof legacyValue === 'number') {
        state.world.addComponent(entityId, component, legacyValue);
        return legacyValue;
    }

    const value = typeof fallback === 'number' ? fallback : 0;
    state.world.addComponent(entityId, component, value);
    return value;
}

function handleMobDeath({
    state,
    replication,
    world,
    mobId,
    killerId,
    mobKind,
}: {
    state: WorldState<Command, DomainEvent>;
    replication: ReturnType<typeof registerSpawnReplicationComponents>;
    world: WorldCommandHost;
    mobId: EntityId;
    killerId: EntityId;
    mobKind: EntityKind;
}): void {
    clearTargetsForDeadEntity({ state, replication, world, deadEntityId: mobId });

    state.events.push({ type: 'MOB_KILLED', mobId, mobKind, killerId });

    const outbox = state.resources.require(OUTBOX_RESOURCE);
    const pos = state.world.getComponent(mobId, replication.Position);
    const fallbackGroupId = pos !== undefined ? world.map.getGroupIdFromPosition(pos.x, pos.y) : undefined;

    const legacyMob = world.getEntityById(mobId) as
        | {
              id: EntityId;
              x: number;
              y: number;
              drop?: (item: unknown) => unknown;
          }
        | null;

    if (legacyMob) {
        const item = world.getDroppedItem(legacyMob);
        if (item) {
            const dropMsg = legacyMob.drop?.(item);
            if (Array.isArray(dropMsg) && typeof dropMsg[0] === 'number') {
                outbox.push({
                    kind: 'broadcast_nearby',
                    actorId: mobId,
                    action: dropMsg as unknown as ServerToClientProtocolAction,
                    fallbackGroupId,
                });
            }
            world.handleItemDespawn(item);
        }

        outbox.push({ kind: 'broadcast_nearby', actorId: mobId, action: buildDespawnAction(mobId), fallbackGroupId });
        world.removeEntity(legacyMob);
        return;
    }

    outbox.push({ kind: 'broadcast_nearby', actorId: mobId, action: buildDespawnAction(mobId), fallbackGroupId });
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
    const legacyPlayer = world.getEntityById(playerId) as
        | {
              isDead?: boolean;
              firepotionTimeout?: ReturnType<typeof setTimeout> | null;
          }
        | null;

    if (legacyPlayer) {
        legacyPlayer.isDead = true;
        if (legacyPlayer.firepotionTimeout) {
            clearTimeout(legacyPlayer.firepotionTimeout);
        }
    }

    clearPlayerFromMobAggro({ state, mobAi, replication, world, playerId, tickNow: ctx.tick });

    if (legacyPlayer) {
        world.removeEntity(legacyPlayer);
    }
}

function runServerAuthoritativeCombatSystem({
    state,
    ctx,
    combat,
    mobAi,
    replication,
    world,
}: {
    state: WorldState<Command, DomainEvent>;
    ctx: SystemContext;
    combat: ReturnType<typeof registerCombatComponents>;
    mobAi: ReturnType<typeof registerMobAiComponents>;
    replication: ReturnType<typeof registerSpawnReplicationComponents>;
    world: WorldCommandHost;
}): void {
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
            state.world.removeComponent(engagement.attackerId, replication.Target);
            continue;
        }

        const attackerKind = state.world.getComponent(engagement.attackerId, replication.Kind);
        const targetKind = state.world.getComponent(engagement.targetId, replication.Kind);
        if (attackerKind === undefined || targetKind === undefined) {
            state.world.removeComponent(engagement.attackerId, replication.Target);
            continue;
        }

        const isPlayerVsMob = Types.isPlayer(attackerKind) && Types.isMob(targetKind);
        const isMobVsPlayer = Types.isMob(attackerKind) && Types.isPlayer(targetKind);
        if (!isPlayerVsMob && !isMobVsPlayer) {
            continue;
        }

        const attackerPos = state.world.getComponent(engagement.attackerId, replication.Position);
        const targetPos = state.world.getComponent(engagement.targetId, replication.Position);
        if (!attackerPos || !targetPos || !isAdjacentNonDiagonal(attackerPos, targetPos)) {
            continue;
        }

        const nextAttackTick = state.world.getComponent(engagement.attackerId, combat.NextAttackTick) ?? 0;
        if (ctx.tick < nextAttackTick) {
            continue;
        }

        const legacyAttacker = world.getEntityById(engagement.attackerId);
        const legacyTarget = world.getEntityById(engagement.targetId);

        const attackerWeapon = resolveCombatNumber({
            state,
            component: combat.WeaponLevel,
            entityId: engagement.attackerId,
            legacy: legacyAttacker,
            key: 'weaponLevel',
            fallback: 1,
        });
        const targetArmor = resolveCombatNumber({
            state,
            component: combat.ArmorLevel,
            entityId: engagement.targetId,
            legacy: legacyTarget,
            key: 'armorLevel',
            fallback: 1,
        });

        const damage = Formulas.dmg(attackerWeapon, targetArmor);
        const cooldownTicks = resolveAttackCooldownTicks(attackerKind, ups);
        state.world.addComponent(engagement.attackerId, combat.NextAttackTick, ctx.tick + cooldownTicks);

        if (damage <= 0) {
            continue;
        }

        if (isPlayerVsMob) {
            const mobHp = resolveCombatNumber({
                state,
                component: combat.HitPoints,
                entityId: engagement.targetId,
                legacy: legacyTarget,
                key: 'hitPoints',
                fallback: 1,
            });
            const nextMobHp = Math.max(0, mobHp - damage);
            state.world.addComponent(engagement.targetId, combat.HitPoints, nextMobHp);

            if (legacyTarget && typeof (legacyTarget as { hitPoints?: unknown }).hitPoints === 'number') {
                (legacyTarget as { hitPoints: number }).hitPoints = nextMobHp;
            }

            addMobHate({
                state,
                mobAi,
                replication,
                world,
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
                const killerName = state.world.getComponent(engagement.attackerId, replication.Name);
                if (typeof killerName === 'string' && killerName.length > 0) {
                    world.recordPlayerMobKill(killerName, targetKind);
                }
                handleMobDeath({
                    state,
                    replication,
                    world,
                    mobId: engagement.targetId,
                    killerId: engagement.attackerId,
                    mobKind: targetKind,
                });
            }
            continue;
        }

        const playerHp = resolveCombatNumber({
            state,
            component: combat.HitPoints,
            entityId: engagement.targetId,
            legacy: legacyTarget,
            key: 'hitPoints',
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

        if (legacyTarget && typeof (legacyTarget as { hitPoints?: unknown }).hitPoints === 'number') {
            (legacyTarget as { hitPoints: number }).hitPoints = nextPlayerHp;
        }
        const playerName = state.world.getComponent(engagement.targetId, replication.Name);
        if (typeof playerName === 'string' && playerName.length > 0) {
            world.recordPlayerDamageTaken(playerName, damage);
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

function applyLootCommand({
    state,
    ctx,
    combat,
    replication,
    effects,
    world,
    player,
    cmd,
}: {
    state: WorldState<Command, DomainEvent>;
    ctx: SystemContext;
    combat: ReturnType<typeof registerCombatComponents>;
    replication: ReturnType<typeof registerSpawnReplicationComponents>;
    effects: ReturnType<typeof registerEffectsComponents>;
    world: WorldCommandHost;
    player: Player;
    cmd: Extract<Command, { type: 'LOOT' }>;
}): void {
    const droppedItem = world.getEntityById(cmd.droppedItemId) as
        | { id: EntityId; kind: EntityKind }
        | null;
    if (!droppedItem) {
        return;
    }
    if (!Types.isItem(droppedItem.kind)) {
        return;
    }

    world.removeEntity(droppedItem);

    if (droppedItem.kind === Types.Entities.FIREPOTION) {
        player.updateHitPoints();

        state.world.addComponent(player.id, combat.MaxHitPoints, player.maxHitPoints);
        state.world.addComponent(player.id, combat.HitPoints, player.hitPoints);

        const outbox = state.resources.require(OUTBOX_RESOURCE);
        state.world.removeComponent(player.id, effects.TempVisualEquip);
        outbox.push({ kind: 'to_player', playerId: player.id, action: buildHpAction(player.maxHitPoints) });
        outbox.push({
            kind: 'to_player',
            playerId: player.id,
            action: buildEquipAction(player.id, Types.Entities.FIREFOX),
        });
        outbox.push({
            kind: 'broadcast_nearby',
            actorId: player.id,
            ignoredPlayerId: player.id,
            action: buildEquipAction(player.id, Types.Entities.FIREFOX),
        });

        const durationTicks = world.ups * 15;
        const expiresAtTick = durationTicks > 0 ? ctx.tick + durationTicks : ctx.tick;
        state.world.addComponent(player.id, effects.TempVisualEquip, {
            kind: Types.Entities.FIREFOX,
            revertKind: player.armor,
            expiresAtTick,
        });
        return;
    }

    const healingPoints = HEALING_ITEM_POINTS_BY_KIND[droppedItem.kind];
    if (typeof healingPoints === 'number') {
        if (player.hasFullHealth()) {
            return;
        }
        const nextHp = Math.min(player.maxHitPoints, player.hitPoints + healingPoints);
        if (nextHp === player.hitPoints) {
            return;
        }
        player.hitPoints = nextHp;
        state.world.addComponent(player.id, combat.HitPoints, nextHp);
        state.world.addComponent(player.id, combat.MaxHitPoints, player.maxHitPoints);
        state.events.push({ type: 'PLAYER_HEALTH_CHANGED', playerId: player.id, hitPoints: nextHp, isRegen: false });
        return;
    }

    if (Types.isArmor(droppedItem.kind)) {
        player.equipArmor(droppedItem.kind);
        player.updateHitPoints();
        world.persistPlayerEquipment(player);

        state.world.addComponent(player.id, replication.Armor, player.armor);
        state.world.addComponent(player.id, combat.ArmorLevel, player.armorLevel);
        state.world.addComponent(player.id, combat.MaxHitPoints, player.maxHitPoints);
        state.world.addComponent(player.id, combat.HitPoints, player.hitPoints);

        const outbox = state.resources.require(OUTBOX_RESOURCE);
        outbox.push({ kind: 'to_player', playerId: player.id, action: buildHpAction(player.maxHitPoints) });
        outbox.push({
            kind: 'to_player',
            playerId: player.id,
            action: buildEquipAction(player.id, droppedItem.kind),
        });
        outbox.push({
            kind: 'broadcast_nearby',
            actorId: player.id,
            ignoredPlayerId: player.id,
            action: buildEquipAction(player.id, droppedItem.kind),
        });
        return;
    }

    if (Types.isWeapon(droppedItem.kind)) {
        player.equipWeapon(droppedItem.kind);
        world.persistPlayerEquipment(player);

        state.world.addComponent(player.id, replication.Weapon, player.weapon);
        state.world.addComponent(player.id, combat.WeaponLevel, player.weaponLevel);

        const outbox = state.resources.require(OUTBOX_RESOURCE);
        outbox.push({
            kind: 'to_player',
            playerId: player.id,
            action: buildEquipAction(player.id, droppedItem.kind),
        });
        outbox.push({
            kind: 'broadcast_nearby',
            actorId: player.id,
            ignoredPlayerId: player.id,
            action: buildEquipAction(player.id, droppedItem.kind),
        });
        return;
    }
}

function applyTeleportCommand({
    state,
    ctx,
    Position,
    Target,
    mobAi,
    replication,
    world,
    player,
    cmd,
}: {
    state: WorldState<Command, DomainEvent>;
    ctx: SystemContext;
    Position: ComponentType<GridPos>;
    Target: ComponentType<EntityId>;
    mobAi: ReturnType<typeof registerMobAiComponents>;
    replication: ReturnType<typeof registerSpawnReplicationComponents>;
    world: WorldCommandHost;
    player: Player;
    cmd: Extract<Command, { type: 'TELEPORT' }>;
}): void {
    if (!world.isValidPosition(cmd.to.x, cmd.to.y)) {
        return;
    }
    player.setPosition(cmd.to.x, cmd.to.y);
    state.world.addComponent(cmd.source.playerId, Position, cmd.to);
    player.clearTarget();
    state.world.removeComponent(cmd.source.playerId, Target);

    const teleport = buildTeleportAction(player.id, player.x, player.y);
    const outbox = state.resources.require(OUTBOX_RESOURCE);
    outbox.push({ kind: 'to_player', playerId: player.id, action: teleport });
    outbox.push({ kind: 'broadcast_nearby', actorId: player.id, ignoredPlayerId: player.id, action: teleport });

    clearPlayerFromMobAggro({ state, mobAi, replication, world, playerId: player.id, tickNow: ctx.tick });
}

function applyOpenCommand(world: WorldCommandHost, player: Player, cmd: Extract<Command, { type: 'OPEN' }>): void {
    const chest = world.getEntityById(cmd.chestId);
    if (chest && chest instanceof Chest) {
        world.removeEntity(chest);
        const kind = chest.getRandomItem();
        if (kind) {
            const item = world.addItemFromChest(kind, chest.x, chest.y);
            world.handleItemDespawn(item);
        }
    }
}

function applyCheckCommand(world: WorldCommandHost, player: Player, cmd: Extract<Command, { type: 'CHECK' }>): void {
    const checkpoint = world.map.getCheckpoint(cmd.checkpointId);
    if (checkpoint) {
        player.lastCheckpoint = checkpoint;
        world.persistPlayerCheckpoint(player.name, cmd.checkpointId);
    }
}

function applyChatCommand(state: WorldState<Command, DomainEvent>, playerId: EntityId, cmd: Extract<Command, { type: 'CHAT' }>): void {
    if (cmd.message && cmd.message !== '') {
        const outbox = state.resources.require(OUTBOX_RESOURCE);
        outbox.push({ kind: 'broadcast_nearby', actorId: playerId, action: buildChatAction(playerId, cmd.message) });
    }
}

function createApplyInboundCommandsSystem(
    world: WorldCommandHost,
    Position: ComponentType<GridPos>,
    Target: ComponentType<EntityId>,
    replication: ReturnType<typeof registerSpawnReplicationComponents>,
    combat: ReturnType<typeof registerCombatComponents>,
    effects: ReturnType<typeof registerEffectsComponents>,
    mobAi: ReturnType<typeof registerMobAiComponents>
) {
    return (state: WorldState<Command, DomainEvent>, ctx: SystemContext) => {
        const commands = state.commands.drain();
        for (let i = 0; i < commands.length; i += 1) {
            const cmd = commands[i];
            if (!cmd) {
                continue;
            }

            if (cmd.type === 'HELLO') {
                const player = world.getConnectionPlayerById(cmd.source.playerId);
                if (!player) {
                    continue;
                }
                applyHello({
                    state,
                    Position,
                    Kind: replication.Kind,
                    Name: replication.Name,
                    Orientation: replication.Orientation,
                    Armor: replication.Armor,
                    Weapon: replication.Weapon,
                    Target,
                    combat,
                    world,
                    player,
                    cmd,
                });
                continue;
            }

            const entity = world.getEntityById(cmd.source.playerId);
            if (!isPlayer(entity)) {
                continue;
            }
            const player = entity;

            switch (cmd.type) {
                case 'WHO':
                    world.pushSpawnsToPlayerId(cmd.source.playerId, [...cmd.entityIds]);
                    break;
                case 'ZONE':
                    player.emit('zone');
                    break;
                case 'CHAT':
                    applyChatCommand(state, player.id, cmd);
                    break;
                case 'MOVE':
                    applyMoveCommand({ state, Position, Target, world, player, cmd });
                    break;
                case 'LOOTMOVE':
                    applyLootMoveCommand({ state, Position, Target, world, player, cmd });
                    break;
                case 'AGGRO':
                    addMobHate({ state, mobAi, replication, world, mobId: cmd.mobId, playerId: player.id, hatePoints: 5 });
                    break;
                case 'ATTACK':
                    applyAttackCommand({ state, Target, world, player, cmd });
                    break;
                case 'HIT':
                    // Deprecated: server-authoritative combat resolves damage in sim stage.
                    break;
                case 'HURT':
                    // Deprecated: server-authoritative combat resolves damage in sim stage.
                    break;
                case 'LOOT':
                    applyLootCommand({ state, ctx, combat, replication, effects, world, player, cmd });
                    break;
                case 'TELEPORT':
                    applyTeleportCommand({ state, ctx, Position, Target, mobAi, replication, world, player, cmd });
                    break;
                case 'OPEN':
                    applyOpenCommand(world, player, cmd);
                    break;
                case 'CHECK':
                    applyCheckCommand(world, player, cmd);
                    break;
                case 'ACHIEVEMENT':
                    world.persistPlayerAchievementUnlock(player.name, cmd.achievementId);
                    break;
                default:
                    // Ensure exhaustive handling when new command types are introduced.
                     
                    const _exhaustive: never = cmd;
                    break;
            }
        }
    };
}

export class WorldEcsCommandPipeline {
    readonly state = new WorldState<Command, DomainEvent>();
    readonly #scheduler: Scheduler<Command, DomainEvent>;
    readonly #world: WorldCommandHost;
    readonly replication = registerSpawnReplicationComponents(this.state.world);
    readonly Position = this.replication.Position;
    readonly combat = registerCombatComponents(this.state.world);
    readonly effects = registerEffectsComponents(this.state.world);
    readonly items = registerItemLifecycleComponents(this.state.world);
    readonly mobAi = registerMobAiComponents(this.state.world);
    #tick = 0;

    constructor(world: WorldCommandHost) {
        this.#world = world;
        this.state.resources.set(OUTBOX_RESOURCE, new Queue());
        this.state.resources.set(INTEREST_TRACKER_RESOURCE, new InterestTracker());
        this.state.resources.set(RESPAWN_TASKS_RESOURCE, []);

        this.#scheduler = new Scheduler<Command, DomainEvent>({ nowMs: () => Date.now() });
        this.#scheduler.register(
            'pre',
            'apply_inbound_commands',
            createApplyInboundCommandsSystem(
                world,
                this.Position,
                this.replication.Target,
                this.replication,
                this.combat,
                this.effects,
                this.mobAi
            )
        );
        this.#scheduler.register('sim', 'item_despawn_timers', (state, ctx: SystemContext) => {
            const ItemDespawnTimer = this.items.ItemDespawnTimer;
            const outbox = state.resources.require(OUTBOX_RESOURCE);

            const toBlink: EntityId[] = [];
            const toDestroy: Array<{ id: EntityId; fallbackGroupId?: string }> = [];

            ItemDespawnTimer.store.forEach((id, timer) => {
                if (!timer.blinked && ctx.tick >= timer.blinkAtTick) {
                    toBlink.push(id);
                }
                if (ctx.tick >= timer.destroyAtTick) {
                    const pos = this.Position.store.get(id);
                    const fallbackGroupId =
                        pos !== undefined ? this.#world.map.getGroupIdFromPosition(pos.x, pos.y) : undefined;
                    toDestroy.push({ id, fallbackGroupId });
                }
            });

            for (let i = 0; i < toBlink.length; i += 1) {
                const id = toBlink[i];
                if (id === undefined) {
                    continue;
                }
                const current = ItemDespawnTimer.store.get(id);
                if (!current || current.blinked) {
                    continue;
                }
                state.world.addComponent(id, ItemDespawnTimer, {
                    blinkAtTick: current.blinkAtTick,
                    destroyAtTick: current.destroyAtTick,
                    blinked: true,
                });
                outbox.push({ kind: 'broadcast_nearby', actorId: id, action: buildBlinkAction(id) });
            }

            for (let i = 0; i < toDestroy.length; i += 1) {
                const entry = toDestroy[i];
                if (!entry) {
                    continue;
                }
                outbox.push({
                    kind: 'broadcast_nearby',
                    actorId: entry.id,
                    action: buildDestroyAction(entry.id),
                    fallbackGroupId: entry.fallbackGroupId,
                });

                const entity = this.#world.getEntityById(entry.id);
                if (entity) {
                    this.#world.removeEntity(entity);
                } else {
                    state.world.removeComponent(entry.id, ItemDespawnTimer);
                    this.removeEntity(entry.id);
                }
            }
        });
        this.#scheduler.register('sim', 'respawn_tasks', (state, ctx: SystemContext) => {
            const tasks = state.resources.require(RESPAWN_TASKS_RESOURCE);
            if (tasks.length === 0) {
                return;
            }

            const remaining: RespawnTask[] = [];
            for (let i = 0; i < tasks.length; i += 1) {
                const task = tasks[i];
                if (!task) {
                    continue;
                }
                if (ctx.tick >= task.atTick) {
                    task.entity.emit('respawn');
                } else {
                    remaining.push(task);
                }
            }
            tasks.length = 0;
            tasks.push(...remaining);
        });
        this.#scheduler.register('sim', 'expire_temp_visual_equip', (state, ctx: SystemContext) => {
            const TempVisualEquip = this.effects.TempVisualEquip;
            const outbox = state.resources.require(OUTBOX_RESOURCE);

            const expired: Array<{ id: EntityId; revertKind: EntityKind }> = [];
            TempVisualEquip.store.forEach((id, effect) => {
                if (ctx.tick >= effect.expiresAtTick) {
                    expired.push({ id, revertKind: effect.revertKind });
                }
            });

            for (let i = 0; i < expired.length; i += 1) {
                const entry = expired[i];
                if (!entry) {
                    continue;
                }
                state.world.removeComponent(entry.id, TempVisualEquip);
                outbox.push({
                    kind: 'to_player',
                    playerId: entry.id,
                    action: buildEquipAction(entry.id, entry.revertKind),
                });
                outbox.push({
                    kind: 'broadcast_nearby',
                    actorId: entry.id,
                    ignoredPlayerId: entry.id,
                    action: buildEquipAction(entry.id, entry.revertKind),
                });
            }
        });
        this.#scheduler.register('sim', 'mob_ai', (state, ctx: SystemContext) => {
            const Kind = this.replication.Kind;
            const Position = this.Position;
            const Target = this.replication.Target;
            const { MobSpawnPos, MobHate, MobReturnAtTick } = this.mobAi;

            const ups = Math.max(1, this.#world.ups);
            if (ctx.tick === 0) {
                return;
            }

            const returnDelayTicks = ups * 4;
            const leashDistance = 50;
            const positionKey = (x: number, y: number) => `${x},${y}`;
            const occupiedBy = new Map<string, EntityId>();

            Position.store.forEach((id, pos) => {
                const kind = Kind.store.get(id);
                if (kind === undefined) {
                    return;
                }
                if (!Types.isPlayer(kind) && !Types.isMob(kind) && !Types.isChest(kind)) {
                    return;
                }
                occupiedBy.set(positionKey(pos.x, pos.y), id);
            });

            const canMobMoveTo = (mobId: EntityId, x: number, y: number) => {
                if (!this.#world.isValidPosition(x, y)) {
                    return false;
                }
                const occupant = occupiedBy.get(positionKey(x, y));
                return occupant === undefined || occupant === mobId;
            };

            const mobIds: EntityId[] = [];
            Kind.store.forEach((id, kind) => {
                if (Types.isMob(kind)) {
                    mobIds.push(id);
                }
            });

            for (let i = 0; i < mobIds.length; i += 1) {
                const mobId = mobIds[i];
                if (mobId === undefined) {
                    continue;
                }

                const legacyMob = this.#world.getEntityById(mobId) as
                    | {
                          id: EntityId;
                          x: number;
                          y: number;
                          spawningX?: number;
                          spawningY?: number;
                          isDead?: boolean;
                          target?: EntityId | null;
                      }
                    | null;
                if (!legacyMob || legacyMob.isDead) {
                    continue;
                }

                let spawn = MobSpawnPos.store.get(mobId);
                if (!spawn) {
                    const spawningX = typeof legacyMob.spawningX === 'number' ? legacyMob.spawningX : legacyMob.x;
                    const spawningY = typeof legacyMob.spawningY === 'number' ? legacyMob.spawningY : legacyMob.y;
                    spawn = gridPos(spawningX, spawningY);
                    state.world.addComponent(mobId, MobSpawnPos, spawn);
                }

                const hate = MobHate.store.get(mobId)?.entries ?? [];
                if (hate.length === 0) {
                    const returnAtTick = MobReturnAtTick.store.get(mobId);
                    if (typeof returnAtTick === 'number' && ctx.tick >= returnAtTick) {
                        const currentPos = Position.store.get(mobId) ?? gridPos(legacyMob.x, legacyMob.y);
                        if (!Position.store.has(mobId)) {
                            state.world.addComponent(mobId, Position, currentPos);
                        }

                        if (currentPos.x === spawn.x && currentPos.y === spawn.y) {
                            state.world.removeComponent(mobId, MobReturnAtTick);
                        } else {
                            const next = chooseStepTowards({
                                from: currentPos,
                                to: spawn,
                                isValidPosition: (x, y) => canMobMoveTo(mobId, x, y),
                            });
                            if (next) {
                                const oldKey = positionKey(currentPos.x, currentPos.y);
                                if (occupiedBy.get(oldKey) === mobId) {
                                    occupiedBy.delete(oldKey);
                                }
                                this.#world.moveEntity(legacyMob, next.x, next.y);
                                state.world.addComponent(mobId, Position, next);
                                occupiedBy.set(positionKey(next.x, next.y), mobId);
                                state.events.push({ type: 'ENTITY_MOVED', entityId: mobId, to: next });
                            }
                        }
                    }
                    continue;
                }

                const filtered: MobHateEntry[] = [];
                for (let j = 0; j < hate.length; j += 1) {
                    const entry = hate[j];
                    if (!entry || entry.hate <= 0) {
                        continue;
                    }
                    const entity = this.#world.getEntityById(entry.id);
                    if (!isPlayer(entity) || entity.hitPoints <= 0 || entity.isDead) {
                        continue;
                    }
                    filtered.push(entry);
                }

                if (filtered.length !== hate.length) {
                    if (filtered.length === 0) {
                        state.world.removeComponent(mobId, MobHate);
                        state.world.addComponent(mobId, MobReturnAtTick, ctx.tick + returnDelayTicks);
                        state.world.removeComponent(mobId, Target);
                        legacyMob.target = null;
                        syncLegacyMobHateList(legacyMob, []);
                        continue;
                    }
                    state.world.addComponent(mobId, MobHate, { entries: filtered });
                    syncLegacyMobHateList(legacyMob, filtered);
                }

                let best: MobHateEntry | null = null;
                for (let j = 0; j < filtered.length; j += 1) {
                    const entry = filtered[j];
                    if (!entry) {
                        continue;
                    }
                    if (!best || entry.hate > best.hate) {
                        best = entry;
                    }
                }
                if (!best) {
                    continue;
                }

                const desiredTargetId = best.id;
                const currentTarget = Target.store.get(mobId);
                if (currentTarget !== desiredTargetId) {
                    state.world.addComponent(mobId, Target, desiredTargetId);
                    legacyMob.target = desiredTargetId;
                    state.events.push({ type: 'ENTITY_ATTACKED', attackerId: mobId, targetId: desiredTargetId });
                }

                const targetEntity = this.#world.getEntityById(desiredTargetId);
                const targetPos = Position.store.get(desiredTargetId) ?? asGridPos(targetEntity);
                if (!targetPos) {
                    continue;
                }

                const currentPos = Position.store.get(mobId) ?? gridPos(legacyMob.x, legacyMob.y);
                if (!Position.store.has(mobId)) {
                    state.world.addComponent(mobId, Position, currentPos);
                }

                if (isAdjacentNonDiagonal(currentPos, targetPos)) {
                    continue;
                }

                let next = chooseStepTowards({
                    from: currentPos,
                    to: targetPos,
                    isValidPosition: (x, y) => canMobMoveTo(mobId, x, y),
                });

                next ??= chooseStepTowardsAdjacentViaBfs({
                    from: currentPos,
                    target: targetPos,
                    spawn,
                    leashDistance,
                    isValidPosition: (x, y) => canMobMoveTo(mobId, x, y),
                });

                if (!next) {
                    continue;
                }

                if (Utils.distanceTo(next.x, next.y, spawn.x, spawn.y) > leashDistance) {
                    state.world.removeComponent(mobId, MobHate);
                    state.world.addComponent(mobId, MobReturnAtTick, ctx.tick + returnDelayTicks);
                    state.world.removeComponent(mobId, Target);
                    legacyMob.target = null;
                    syncLegacyMobHateList(legacyMob, []);
                    continue;
                }

                const oldKey = positionKey(currentPos.x, currentPos.y);
                if (occupiedBy.get(oldKey) === mobId) {
                    occupiedBy.delete(oldKey);
                }
                this.#world.moveEntity(legacyMob, next.x, next.y);
                state.world.addComponent(mobId, Position, next);
                occupiedBy.set(positionKey(next.x, next.y), mobId);
                state.events.push({ type: 'ENTITY_MOVED', entityId: mobId, to: next });
            }
        });
        this.#scheduler.register('sim', 'combat_authority', (state, ctx: SystemContext) => {
            runServerAuthoritativeCombatSystem({
                state,
                ctx,
                combat: this.combat,
                mobAi: this.mobAi,
                replication: this.replication,
                world: this.#world,
            });
        });
        this.#scheduler.register('sim', 'regen', (state, ctx: SystemContext) => {
            const intervalTicks = this.#world.ups * 2;
            if (ctx.tick === 0 || intervalTicks <= 0 || ctx.tick % intervalTicks !== 0) {
                return;
            }

            const Kind = this.replication.Kind;
            const { HitPoints, MaxHitPoints } = this.combat;
            HitPoints.store.forEach((id, hp) => {
                if (hp <= 0) {
                    return;
                }
                const max = MaxHitPoints.store.get(id);
                if (typeof max !== 'number' || max <= 0 || hp >= max) {
                    return;
                }
                const kind = Kind.store.get(id);
                if (kind === undefined || (!Types.isPlayer(kind) && !Types.isMob(kind))) {
                    return;
                }

                const delta = Math.floor(max / 25);
                if (delta <= 0) {
                    return;
                }
                const next = Math.min(max, hp + delta);
                if (next === hp) {
                    return;
                }
                state.world.addComponent(id, HitPoints, next);

                const legacy = this.#world.getEntityById(id) as { hitPoints?: unknown } | null;
                if (legacy && typeof legacy.hitPoints === 'number') {
                    legacy.hitPoints = next;
                }

                if (Types.isPlayer(kind)) {
                    state.events.push({ type: 'PLAYER_HEALTH_CHANGED', playerId: id, hitPoints: next, isRegen: true });
                }
            });
        });
        this.#scheduler.register('post', 'flush_events_to_outbox', flushDomainEventsToOutboxSystem);
    }

    registerSystem(stage: SchedulerStage, name: string, run: System<Command, DomainEvent>): void {
        this.#scheduler.register(stage, name, run);
    }

    getTick(): number {
        return this.#tick;
    }

    scheduleItemDespawn(
        entity: Readonly<{ id: EntityId }>,
        {
            blinkDelaySeconds = 10,
            blinkingDurationSeconds = 4,
        }: { blinkDelaySeconds?: number; blinkingDurationSeconds?: number } = {},
        tickNow?: number
    ): void {
        const baseTick = tickNow ?? this.#tick;
        const ups = Math.max(1, this.#world.ups);
        const blinkAtTick = baseTick + Math.floor(ups * blinkDelaySeconds);
        const destroyAtTick = blinkAtTick + Math.floor(ups * blinkingDurationSeconds);

        this.state.world.ensureEntity(entity.id);
        this.state.world.addComponent(entity.id, this.items.ItemDespawnTimer, {
            blinkAtTick,
            destroyAtTick,
            blinked: false,
        });
    }

    scheduleStaticRespawn(entity: RespawnableEntity, delaySeconds = 30, tickNow?: number): void {
        const baseTick = tickNow ?? this.#tick;
        const ups = Math.max(1, this.#world.ups);
        const tasks = this.state.resources.require(RESPAWN_TASKS_RESOURCE);
        tasks.push({ atTick: baseTick + Math.floor(ups * delaySeconds), entity });
    }

    syncSpawnReplicationEntity(entity: LegacySpawnReplicationEntity): void {
        syncSpawnReplicationFromLegacyEntity(this.state.world, this.replication, entity);
    }

    syncCombatEntity(
        entity: Readonly<{
            id: EntityId;
            hitPoints?: number;
            maxHitPoints?: number;
            armorLevel?: number;
            weaponLevel?: number;
        }>
    ): void {
        this.state.world.ensureEntity(entity.id);

        if (typeof entity.hitPoints === 'number') {
            this.state.world.addComponent(entity.id, this.combat.HitPoints, entity.hitPoints);
        }
        if (typeof entity.maxHitPoints === 'number') {
            this.state.world.addComponent(entity.id, this.combat.MaxHitPoints, entity.maxHitPoints);
        }
        if (typeof entity.armorLevel === 'number') {
            this.state.world.addComponent(entity.id, this.combat.ArmorLevel, entity.armorLevel);
        }
        if (typeof entity.weaponLevel === 'number') {
            this.state.world.addComponent(entity.id, this.combat.WeaponLevel, entity.weaponLevel);
        }
    }

    removeEntity(id: EntityId): void {
        this.state.resources.get(INTEREST_TRACKER_RESOURCE)?.clearObserver(id);
        if (this.state.world.entities.isAlive(id)) {
            this.state.world.destroyEntity(id);
        }
    }

    enqueue(command: Command): void {
        this.state.commands.push(command);
    }

    buildSpawnActionForLegacyEntity(entity: LegacySpawnReplicationEntity): ServerToClientSpawnAction {
        this.syncSpawnReplicationEntity(entity);
        return buildSpawnActionFromReplicationState(this.state.world, this.replication, entity.id);
    }

    tick(): void {
        this.#scheduler.tick(this.state, this.#tick++);

        const idsByGroup = this.#buildGroupIndex();
        this.#replicateInterest(idsByGroup);

        const outbox = this.state.resources.require(OUTBOX_RESOURCE);
        const messages = outbox.drain();
        for (let i = 0; i < messages.length; i += 1) {
            const msg = messages[i];
            if (!msg) {
                continue;
            }
            if (msg.kind === 'to_player') {
                this.#world.pushToPlayerId(msg.playerId, msg.action);
                continue;
            }

            this.#broadcastNearby(msg, idsByGroup);
        }
    }

    #buildGroupIndex(): Map<string, EntityId[]> {
        const idsByGroup = new Map<string, EntityId[]>();

        this.Position.store.forEach((id, pos) => {
            const groupId = this.#world.map.getGroupIdFromPosition(pos.x, pos.y);
            const list = idsByGroup.get(groupId);
            if (list) {
                list.push(id);
            } else {
                idsByGroup.set(groupId, [id]);
            }
        });

        return idsByGroup;
    }

    #replicateInterest(idsByGroup: Map<string, EntityId[]>): void {
        const interest = this.state.resources.require(INTEREST_TRACKER_RESOURCE);
        const Kind = this.replication.Kind;

        Kind.store.forEach((observerId, kind) => {
            if (!Types.isPlayer(kind)) {
                return;
            }

            if (!this.#world.isPlayerActive(observerId)) {
                interest.clearObserver(observerId);
                return;
            }

            const pos = this.Position.store.get(observerId);
            if (!pos) {
                return;
            }

            const groupId = this.#world.map.getGroupIdFromPosition(pos.x, pos.y);
            const visible: EntityId[] = [];
            this.#world.map.forEachAdjacentGroup(groupId, (adjacent) => {
                const groupIds = idsByGroup.get(adjacent);
                if (groupIds) {
                    visible.push(...groupIds);
                }
            });

            const diff = interest.update(observerId, visible, { excludeSelf: true });
            for (let i = 0; i < diff.enter.length; i += 1) {
                const id = diff.enter[i];
                if (id === undefined) {
                    continue;
                }
                try {
                    this.#world.pushToPlayerId(
                        observerId,
                        buildSpawnActionFromReplicationState(this.state.world, this.replication, id)
                    );
                } catch (_) {
                    // Entity may have been destroyed during this tick or missing replication components.
                }
            }
            for (let i = 0; i < diff.leave.length; i += 1) {
                const id = diff.leave[i];
                if (id === undefined) {
                    continue;
                }
                this.#world.pushToPlayerId(observerId, buildDespawnAction(id));
            }
        });
    }

    #broadcastNearby(msg: Extract<OutboxMessage, { kind: 'broadcast_nearby' }>, idsByGroup: Map<string, EntityId[]>) {
        const pos = this.Position.store.get(msg.actorId);
        const groupId =
            pos !== undefined
                ? this.#world.map.getGroupIdFromPosition(pos.x, pos.y)
                : typeof msg.fallbackGroupId === 'string'
                  ? msg.fallbackGroupId
                  : null;
        if (!groupId) {
            return;
        }

        this.#world.map.forEachAdjacentGroup(groupId, (adjacent) => {
            const ids = idsByGroup.get(adjacent);
            if (!ids) {
                return;
            }
            for (let i = 0; i < ids.length; i += 1) {
                const id = ids[i];
                if (id === undefined || (msg.ignoredPlayerId !== undefined && id === msg.ignoredPlayerId)) {
                    continue;
                }
                if (!this.#world.isPlayerActive(id)) {
                    continue;
                }
                this.#world.pushToPlayerId(id, msg.action);
            }
        });
    }
}
