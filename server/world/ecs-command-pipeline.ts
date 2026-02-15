import type { EntityId } from '../../shared/domain/ids';
import { gridPos, type GridPos } from '../../shared/domain/positions';
import { isWithinAttackRange, resolveAttackRangeTiles } from '../../shared/combat/attack-range';
import { requireMobPrefab } from '../../shared/content/prefabs';
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
import Utils from '../utils';
import Formulas from '../formulas';
import Types from '../../shared/gametypes-browser';
import type { EntityKind } from '../../shared/entity-kind-domain';
import {
    buildAttackAction,
    buildAchievementsAction,
    buildAckAction,
    buildBlinkAction,
    buildChatAction,
    buildChunkDeltaAction,
    buildChunkSnapshotAction,
    buildChunkSnapshotPartAction,
    buildDespawnAction,
    buildDestroyAction,
    buildDropAction,
    buildEquipAction,
    buildHpAction,
    buildLootMoveAction,
    buildMoveAction,
    buildCorrectionMoveAction,
    buildRejectAction,
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
import { registerChestComponents } from '../ecs/chest-components';
import { RESPAWN_TASKS_RESOURCE, type RespawnTask, type RespawnableEntity } from '../ecs/respawn-tasks';
import { registerMobAiComponents, type MobHateEntry } from '../ecs/mob-ai-components';
import { registerMovementComponents } from '../ecs/movement-components';
import type { PlayerLike } from './player-like';
import { GameModuleRegistry } from '../../shared/modules/module-registry';
import { encodeProtocolCapabilitiesJson, PROTOCOL_REVISION } from '../../shared/protocol/capabilities';
import { createIntentSeqState, INTENT_SEQ_STATE_RESOURCE } from '../ecs/intent-seq';
import { createResourceKey } from '../ecs/resources';
import { ChunkOverlayStore, makeChunkKey } from './chunks/chunk-overlay-store';
import { createChunkAoiState, CHUNK_AOI_STATE_RESOURCE, type ChunkSubscription } from './chunks/chunk-aoi';
import { encodeChunkSnapshotPayloadJson, encodeChunkSnapshotPayloadJsonParts } from '../../shared/protocol/chunks/chunk-snapshot-codec';
import { encodeChunkDeltaPayloadJson } from '../../shared/protocol/chunks/chunk-delta-codec';
import { ClaimsStore, type RectClaim } from './claims/claims-store';
import { CLAIMS_STORE_RESOURCE } from './claims/claims-resource';
import { canEditClaim, canEditTile, canManageClaim } from './claims/permissions';
import type { ServerConfig } from '../runtime-types';

type InboundIntentContext = Readonly<{
    modules: GameModuleRegistry;
    state: WorldState<Command, DomainEvent>;
    ctx: SystemContext;
    world: WorldCommandHost;
    player: PlayerLike;
    intentSourceKind?: 'intent' | 'legacy';
    Position: ComponentType<GridPos>;
    Target: ComponentType<EntityId>;
    movement: ReturnType<typeof registerMovementComponents>;
    mobAi: ReturnType<typeof registerMobAiComponents>;
    replication: ReturnType<typeof registerSpawnReplicationComponents>;
}>;

type DoorTeleportOutcome = Readonly<{ playerId: EntityId; to: GridPos }>;

const INTENT_MOVE_STEP = 'move.step';
const INTENT_DOOR_TELEPORT = 'door.teleport';
const INTENT_TILE_EDIT = 'tile.edit';
const INTENT_CLAIM_CREATE = 'claim.create';
const INTENT_CLAIM_UPDATE = 'claim.update';
const INTENT_CLAIM_DELETE = 'claim.delete';
const OUTCOME_DOOR_TELEPORT = 'teleport.door';

function createCoreServerModuleRegistry(): GameModuleRegistry {
    const modules = new GameModuleRegistry();
    modules.registerModules([
        {
            id: 'core.teleport',
            register(registry) {
                registry.registerOutcomeHandler(OUTCOME_DOOR_TELEPORT, (rawCtx, rawPayload) => {
                    const ctx = rawCtx as InboundIntentContext;
                    const payload = rawPayload as DoorTeleportOutcome;
                    applyTeleportOutcome({
                        state: ctx.state,
                        ctx: ctx.ctx,
                        Position: ctx.Position,
                        Target: ctx.Target,
                        mobAi: ctx.mobAi,
                        movement: ctx.movement,
                        replication: ctx.replication,
                        world: ctx.world,
                        playerId: payload.playerId,
                        to: payload.to,
                    });
                });
            },
        },
        {
            id: 'core.move',
            deps: ['core.teleport'],
            register(registry) {
                registry.registerIntentHandler(INTENT_MOVE_STEP, (rawCtx, rawPayload) => {
                    const ctx = rawCtx as InboundIntentContext;
                    const cmd = rawPayload as Extract<Command, { type: 'MOVE' }>;
                    return applyMoveIntentCommand({
                        state: ctx.state,
                        Position: ctx.Position,
                        player: ctx.player,
                        movement: ctx.movement,
                        world: ctx.world,
                        cmd,
                        sourceKind: ctx.intentSourceKind ?? 'legacy',
                    });
                });
            },
        },
        {
            id: 'core.doors',
            deps: ['core.teleport'],
            register(registry) {
                registry.registerIntentHandler(INTENT_DOOR_TELEPORT, (rawCtx, rawPayload) => {
                    const ctx = rawCtx as InboundIntentContext;
                    const cmd = rawPayload as Extract<Command, { type: 'TELEPORT' }>;

                    const currentPos = ctx.Position.store.get(ctx.player.id) ?? gridPos(ctx.player.x, ctx.player.y);
                    const doorDestination = ctx.world.map.getDoorDestination(currentPos.x, currentPos.y);
                    if (!doorDestination) {
                        return;
                    }
                    if (doorDestination.x !== cmd.to.x || doorDestination.y !== cmd.to.y) {
                        return;
                    }
                    if (!ctx.world.isValidPosition(cmd.to.x, cmd.to.y)) {
                        return;
                    }

                    const teleport = ctx.modules.getOutcomeHandler(OUTCOME_DOOR_TELEPORT);
                    if (!teleport) {
                        throw new Error(`Missing outcome handler: ${OUTCOME_DOOR_TELEPORT}`);
                    }
                    teleport(ctx, { playerId: ctx.player.id, to: cmd.to } satisfies DoorTeleportOutcome);
                });
            },
        },
        {
            id: 'core.tiles',
            register(registry) {
                registry.registerIntentHandler(INTENT_TILE_EDIT, (rawCtx, rawPayload) => {
                    const ctx = rawCtx as InboundIntentContext;
                    const cmd = rawPayload as Extract<Command, { type: 'TILE_EDIT' }>;
                    const claims = ctx.state.resources.require(CLAIMS_STORE_RESOURCE);
                    const claim = claims.getClaimAt(cmd.x, cmd.y);
                    const decision = canEditTile({
                            actorName: resolvePlayerIdentityKey(ctx.player) ?? ctx.player.name,
                            claim,
                        });
                    if (!decision.ok) {
                        return { ok: false, reason: `PERMISSION:${decision.code}` };
                    }

                    const overlays = ctx.state.resources.require(CHUNK_OVERLAY_STORE_RESOURCE);
                    ctx.world.ensureChunkOverlayLoadedForTile?.(cmd.x, cmd.y);
                    try {
                        if (cmd.value === null) {
                            overlays.clearGlobal(cmd.x, cmd.y);
                        } else {
                            overlays.setGlobal(cmd.x, cmd.y, cmd.value);
                        }
                    } catch (_err) {
                        return { ok: false, reason: 'Invalid tile edit.' };
                    }
                    return { ok: true };
                });
            },
        },
        {
            id: 'core.claims',
            register(registry) {
                registry.registerIntentHandler(INTENT_CLAIM_CREATE, (rawCtx, rawPayload) => {
                    const ctx = rawCtx as InboundIntentContext;
                    const cmd = rawPayload as Extract<Command, { type: 'CLAIM_CREATE' }>;
                    return applyClaimCreateIntent({ state: ctx.state, world: ctx.world, player: ctx.player, cmd });
                });
                registry.registerIntentHandler(INTENT_CLAIM_UPDATE, (rawCtx, rawPayload) => {
                    const ctx = rawCtx as InboundIntentContext;
                    const cmd = rawPayload as Extract<Command, { type: 'CLAIM_UPDATE' }>;
                    return applyClaimUpdateIntent({ state: ctx.state, world: ctx.world, player: ctx.player, cmd });
                });
                registry.registerIntentHandler(INTENT_CLAIM_DELETE, (rawCtx, rawPayload) => {
                    const ctx = rawCtx as InboundIntentContext;
                    const cmd = rawPayload as Extract<Command, { type: 'CLAIM_DELETE' }>;
                    return applyClaimDeleteIntent({ state: ctx.state, world: ctx.world, player: ctx.player, cmd });
                });
            },
        },
    ]);
    return modules;
}

export const CHUNK_OVERLAY_STORE_RESOURCE = createResourceKey<ChunkOverlayStore>('chunk_overlay_store');

const HEALING_ITEM_POINTS_BY_KIND: Partial<Record<EntityKind, number>> = {
    [Types.Entities.FLASK]: 40,
    [Types.Entities.BURGER]: 100,
};

function resolveDeterministicOrientation(entityId: EntityId): number {
    // Deterministic and stable: uses wire id bits only, avoids Math.random.
    const bucket = entityId % 4;
    switch (bucket) {
        case 0:
            return Types.Orientations.UP;
        case 1:
            return Types.Orientations.DOWN;
        case 2:
            return Types.Orientations.LEFT;
        default:
            return Types.Orientations.RIGHT;
    }
}

function resolveArmorLevel(kind: EntityKind): number {
    try {
        return Types.getArmorRank(kind) + 1;
    } catch (_) {
        return 1;
    }
}

function resolveWeaponLevel(kind: EntityKind): number {
    try {
        return Types.getWeaponRank(kind) + 1;
    } catch (_) {
        return 1;
    }
}

type WorldCommandHost = Readonly<{
    ups: number;
    map: {
        getCheckpoint(id: string | number): { id?: string | number } | null;
        isDoor(x: number, y: number): boolean;
        getDoorDestination(x: number, y: number): { x: number; y: number } | null;
        getGroupIdFromPosition(x: number, y: number): string;
        forEachAdjacentGroup(groupId: string | null | undefined, callback: (groupId: string) => void): void;
    };
    getConnectionPlayerById(playerId: EntityId): PlayerLike | null;
    removeEntityFromAreas(entityId: EntityId): void;
    scheduleMobRespawn(params: { mobId: EntityId; kind: EntityKind; spawn: GridPos; tickNow?: number; delaySeconds?: number }): void;
    scheduleStaticItemRespawn(params: { itemId: EntityId; kind: EntityKind; spawn: GridPos; tickNow?: number; delaySeconds?: number }): void;
    addPlayer(player: PlayerLike): void;
    emitPlayerEnter(player: PlayerLike): void;
    isPlayerActive(playerId: EntityId): boolean;
    pushSpawnsToPlayerId(playerId: EntityId, entities: EntityId[]): void;
    isValidPosition(x: number, y: number): boolean;
    getDroppedItem(mob: unknown): unknown;
    handleItemDespawn(item: unknown): void;
    moveEntity(entity: unknown, x: number, y: number): void;
    removeEntity(entity: unknown): void;
    addItemFromChest(kind: unknown, x: number, y: number): unknown;
    pushToPlayerId(playerId: EntityId, message: unknown): void;
    persistPlayerEquipment(player: PlayerLike): void;
    persistPlayerCheckpoint(playerName: string, checkpointId: number): void;
    persistPlayerAchievementUnlock(playerName: string, achievementId: number): void;
    recordPlayerMobKill(playerName: string, mobKind: EntityKind): void;
    recordPlayerDamageTaken(playerName: string, damage: number): void;
    recordPlayerRevive(playerName: string): void;
    persistClaimUpsert?(claim: RectClaim): void;
    persistClaimDelete?(claimId: number): void;
    ensureChunkOverlayLoaded?(chunkX: number, chunkY: number): boolean;
    ensureChunkOverlayLoadedForTile?(x: number, y: number): boolean;
}>;

const DEFAULT_CHUNK_SIZE = 32;
const MAX_CHUNK_SNAPSHOTS_PER_TICK_PER_PLAYER = 8;
const DEFAULT_MAX_CHUNK_SNAPSHOT_PAYLOAD_UTF8_BYTES = 64 * 1024;
const DEFAULT_MAX_CHUNK_SNAPSHOT_PARTS = 128;
const MAX_CHUNK_DELTA_CHANGES_PER_MESSAGE = 256;
const MAX_PENDING_CHUNKS_PER_PLAYER = 1024;
const MAX_PENDING_SNAPSHOT_STREAMS_PER_PLAYER = 32;
const MAX_PENDING_SNAPSHOT_PARTS_PER_PLAYER = 2048;
const CLAIM_COORD_ABS_MAX = 1_000_000;
const MAX_CLAIMS_PER_OWNER = 64;
const MAX_CLAIM_AREA_TILES = 64 * 64;
const MAX_CLAIM_EDITORS = 16;

function resolveMaxChunkSnapshotPayloadUtf8BytesFromEnv(): number {
    const raw = process.env.BQ_TEST_CHUNK_SNAPSHOT_MAX_UTF8_BYTES;
    if (typeof raw !== 'string' || raw.trim().length === 0) {
        return DEFAULT_MAX_CHUNK_SNAPSHOT_PAYLOAD_UTF8_BYTES;
    }
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        return DEFAULT_MAX_CHUNK_SNAPSHOT_PAYLOAD_UTF8_BYTES;
    }
    return parsed;
}

function resolvePositiveIntegerOrNull(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
        return null;
    }
    return value;
}

function resolvePlayerIdentityKey(player: { accountNameKey?: unknown; name?: unknown } | null | undefined): string | null {
    if (!player || typeof player !== 'object') {
        return null;
    }
    const accountNameKey = player.accountNameKey;
    if (typeof accountNameKey === 'string') {
        const normalized = accountNameKey.trim().toLowerCase();
        if (normalized.length > 0) {
            return normalized;
        }
    }
    const displayName = player.name;
    if (typeof displayName === 'string') {
        const normalized = displayName.trim().toLowerCase();
        if (normalized.length > 0) {
            return normalized;
        }
    }
    return null;
}

function normalizeIdentityKey(value: string): string {
    return value.trim().toLowerCase();
}

function normalizeEditorNameKeys(rawEditorNameKeys: ReadonlyArray<string>, ownerNameKey: string): string[] {
    const out: string[] = [];
    const deduped = new Set<string>();
    for (let i = 0; i < rawEditorNameKeys.length; i += 1) {
        const raw = rawEditorNameKeys[i];
        if (typeof raw !== 'string') {
            continue;
        }
        const normalized = normalizeIdentityKey(raw);
        if (!normalized || normalized === ownerNameKey || deduped.has(normalized)) {
            continue;
        }
        deduped.add(normalized);
        out.push(normalized);
        if (out.length >= MAX_CLAIM_EDITORS) {
            break;
        }
    }
    return out;
}

function resolveClaimBounds(x1: number, y1: number, x2: number, y2: number): { x1: number; y1: number; x2: number; y2: number } {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    return { x1: minX, y1: minY, x2: maxX, y2: maxY };
}

function validateClaimBounds({
    world,
    x1,
    y1,
    x2,
    y2,
}: {
    world: WorldCommandHost;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}): { ok: true; bounds: { x1: number; y1: number; x2: number; y2: number } } | { ok: false; reason: string } {
    const bounds = resolveClaimBounds(x1, y1, x2, y2);
    if (
        Math.abs(bounds.x1) > CLAIM_COORD_ABS_MAX
        || Math.abs(bounds.y1) > CLAIM_COORD_ABS_MAX
        || Math.abs(bounds.x2) > CLAIM_COORD_ABS_MAX
        || Math.abs(bounds.y2) > CLAIM_COORD_ABS_MAX
    ) {
        return { ok: false, reason: 'CLAIM:coords_out_of_range' };
    }

    if (!world.isValidPosition(bounds.x1, bounds.y1) || !world.isValidPosition(bounds.x2, bounds.y2)) {
        return { ok: false, reason: 'CLAIM:out_of_bounds' };
    }

    const width = bounds.x2 - bounds.x1 + 1;
    const height = bounds.y2 - bounds.y1 + 1;
    const area = width * height;
    if (!Number.isSafeInteger(area) || area <= 0 || area > MAX_CLAIM_AREA_TILES) {
        return { ok: false, reason: 'CLAIM:area_too_large' };
    }

    return { ok: true, bounds };
}

function isAdjacentNonDiagonal(a: GridPos, b: GridPos): boolean {
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    return dx + dy === 1;
}

function isEntityVisibleToPlayer(world: WorldCommandHost, playerPos: GridPos, entityPos: GridPos): boolean {
    const playerGroupId = world.map.getGroupIdFromPosition(playerPos.x, playerPos.y);
    const entityGroupId = world.map.getGroupIdFromPosition(entityPos.x, entityPos.y);
    let visible = false;
    world.map.forEachAdjacentGroup(playerGroupId, (groupId) => {
        if (groupId === entityGroupId) {
            visible = true;
        }
    });
    return visible;
}

function chooseStepTowards({
    from,
    to,
    avoidExactTargetTile = true,
    isValidPosition,
}: {
    from: GridPos;
    to: GridPos;
    avoidExactTargetTile?: boolean;
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
        // For chasing, never step onto the target's exact tile. For returning home, allow reaching spawn.
        if (avoidExactTargetTile && next.x === to.x && next.y === to.y) {
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

function addMobHate({
    state,
    mobAi,
    replication,
    mobId,
    playerId,
    hatePoints,
}: {
    state: WorldState<Command, DomainEvent>;
    mobAi: ReturnType<typeof registerMobAiComponents>;
    replication: ReturnType<typeof registerSpawnReplicationComponents>;
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
    modules,
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
    modules: GameModuleRegistry;
    player: PlayerLike;
    cmd: Extract<Command, { type: 'HELLO' }>;
}): void {
    const wasDead = player.isDead === true;
    const resolvedName = cmd.profile?.displayName ?? cmd.name;
    const resolvedAccountNameKey = (cmd.profile?.accountNameKey ?? cmd.profile?.nameKey ?? cmd.name).trim().toLowerCase();
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
    player.accountNameKey = resolvedAccountNameKey;
    player.kind = Types.Entities.WARRIOR;
    player.orientation = Utils.randomOrientation();
    player.updatePosition();
    player.armor = resolvedArmorKind;
    player.weapon = resolvedWeaponKind;
    player.armorLevel = resolveArmorLevel(resolvedArmorKind);
    player.weaponLevel = resolveWeaponLevel(resolvedWeaponKind);
    const maxHitPoints = Formulas.hp(player.armorLevel);
    const hitPoints = maxHitPoints;

    state.world.ensureEntity(player.id);
    state.world.addComponent(player.id, Kind, player.kind);
    state.world.addComponent(player.id, Position, gridPos(player.x, player.y));
    state.world.addComponent(player.id, Name, player.name);
    state.world.addComponent(player.id, Orientation, player.orientation);
    state.world.addComponent(player.id, Armor, player.armor);
    state.world.addComponent(player.id, Weapon, player.weapon);
    state.world.removeComponent(player.id, Target);
    state.world.addComponent(player.id, combat.HitPoints, hitPoints);
    state.world.addComponent(player.id, combat.MaxHitPoints, maxHitPoints);
    state.world.addComponent(player.id, combat.ArmorLevel, player.armorLevel);
    state.world.addComponent(player.id, combat.WeaponLevel, player.weaponLevel);

    world.addPlayer(player);

    const shouldSendCapabilities = typeof cmd.protocolRevision === 'number';
    const serverCapabilitiesJson = shouldSendCapabilities
        ? encodeProtocolCapabilitiesJson({
            moduleIds: [...modules.moduleOrder],
            intentTypeIds: [...modules.intentHandlers.keys()],
            outcomeTypeIds: [...modules.outcomeHandlers.keys()],
        })
        : undefined;

    world.pushToPlayerId(
        player.id,
        buildWelcomeAction({
            id: player.id,
            name: player.name,
            x: player.x,
            y: player.y,
            hp: hitPoints,
            protocolRevision: shouldSendCapabilities ? PROTOCOL_REVISION : undefined,
            capabilitiesJson: serverCapabilitiesJson,
        })
    );
    world.pushToPlayerId(player.id, buildEquipAction(player.id, player.armor));
    world.pushToPlayerId(player.id, buildEquipAction(player.id, player.weapon));
    if (wasDead) {
        world.recordPlayerRevive(resolvePlayerIdentityKey(player) ?? player.name);
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
    world.emitPlayerEnter(player);
    player.hasEnteredGame = true;
    player.isDead = false;
}

function applyMoveIntentCommand({
    state,
    Position,
    player,
    movement,
    world,
    cmd,
    sourceKind,
}: {
    state: WorldState<Command, DomainEvent>;
    Position: ComponentType<GridPos>;
    player: PlayerLike;
    movement: ReturnType<typeof registerMovementComponents>;
    world: WorldCommandHost;
    cmd: Extract<Command, { type: 'MOVE' }>;
    sourceKind: 'intent' | 'legacy';
}): { ok: false; reason: string } | void {
    const { MoveQueue } = movement;
    const existing = MoveQueue.store.get(player.id)?.entries ?? [];
    const lastQueued = existing.length > 0 ? existing[existing.length - 1] : null;
    if (lastQueued && lastQueued.x === cmd.to.x && lastQueued.y === cmd.to.y) {
        return;
    }

    const currentPos = Position.store.get(player.id);
    if (!currentPos) {
        return;
    }
    const baseline = lastQueued ?? currentPos;
    const dist = Math.abs(baseline.x - cmd.to.x) + Math.abs(baseline.y - cmd.to.y);
    if (dist !== 1) {
        // Client got ahead or desynced; clear queued intents and force correction.
        state.world.removeComponent(player.id, MoveQueue);
        if (sourceKind === 'legacy') {
            const outbox = state.resources.require(OUTBOX_RESOURCE);
            outbox.push({
                kind: 'to_player',
                playerId: player.id,
                action: buildTeleportAction(player.id, currentPos.x, currentPos.y),
            });
            return;
        }
        return { ok: false, reason: 'Invalid move.step (non-adjacent).' };
    }

    if (!world.isValidPosition(cmd.to.x, cmd.to.y)) {
        if (sourceKind === 'legacy') {
            const outbox = state.resources.require(OUTBOX_RESOURCE);
            outbox.push({
                kind: 'to_player',
                playerId: player.id,
                action: buildTeleportAction(player.id, currentPos.x, currentPos.y),
            });
            return;
        }
        return { ok: false, reason: 'Invalid move.step (position blocked).' };
    }

    const MAX_QUEUE = 16;
    if (existing.length >= MAX_QUEUE) {
        if (sourceKind === 'legacy') {
            // Avoid unbounded buffering; client will keep sending new positions as it steps.
            return;
        }
        return { ok: false, reason: 'move.step queue full.' };
    }
    state.world.addComponent(player.id, MoveQueue, { entries: [...existing, cmd.to] });
}

function applyLootMoveCommand({
    state,
    Kind,
    Position,
    Target,
    player,
    cmd,
}: {
    state: WorldState<Command, DomainEvent>;
    Kind: ComponentType<EntityKind>;
    Position: ComponentType<GridPos>;
    Target: ComponentType<EntityId>;
    player: PlayerLike;
    cmd: Extract<Command, { type: 'LOOTMOVE' }>;
}): void {
    const currentPos = Position.store.get(player.id);
    if (!currentPos) {
        return;
    }
    if (currentPos.x !== cmd.to.x || currentPos.y !== cmd.to.y) {
        return;
    }

    const itemKind = Kind.store.get(cmd.itemId);
    if (itemKind === undefined || !Types.isItem(itemKind)) {
        return;
    }
    state.world.removeComponent(cmd.source.playerId, Target);
    const outbox = state.resources.require(OUTBOX_RESOURCE);
    outbox.push({
        kind: 'broadcast_nearby',
        actorId: player.id,
        ignoredPlayerId: player.id,
        action: buildLootMoveAction(player.id, cmd.itemId),
    });
}

function applyAttackCommand({
    state,
    mobAi,
    replication,
    Target,
    cmd,
}: {
    state: WorldState<Command, DomainEvent>;
    mobAi: ReturnType<typeof registerMobAiComponents>;
    replication: ReturnType<typeof registerSpawnReplicationComponents>;
    Target: ComponentType<EntityId>;
    cmd: Extract<Command, { type: 'ATTACK' }>;
}): void {
    applyAttackIntent({
        state,
        mobAi,
        replication,
        Target,
        attackerId: cmd.source.playerId,
        targetId: cmd.targetId,
    });
}

function applyAttackIntent({
    state,
    mobAi,
    replication,
    Target,
    attackerId,
    targetId,
}: {
    state: WorldState<Command, DomainEvent>;
    mobAi: ReturnType<typeof registerMobAiComponents>;
    replication: ReturnType<typeof registerSpawnReplicationComponents>;
    Target: ComponentType<EntityId>;
    attackerId: EntityId;
    targetId: EntityId;
}): void {
    const targetKind = replication.Kind.store.get(targetId);
    if (targetKind === undefined || !Types.isMob(targetKind)) {
        return;
    }
    state.world.addComponent(attackerId, Target, targetId);
    state.events.push({ type: 'ENTITY_ATTACKED', attackerId, targetId });

    addMobHate({
        state,
        mobAi,
        replication,
        mobId: targetId,
        playerId: attackerId,
        hatePoints: 5,
    });
}

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

function resolveMoveCooldownMs(kind: EntityKind): number {
    // Keep parity with legacy client movement speeds in `client/mobs.ts` (ms per tile).
    if (Types.isPlayer(kind)) {
        return 120;
    }

    switch (kind) {
        case Types.Entities.RAT:
            return 350;
        case Types.Entities.SKELETON:
            return 350;
        case Types.Entities.SKELETON2:
            return 200;
        case Types.Entities.SPECTRE:
            return 150;
        case Types.Entities.DEATHKNIGHT:
            return 220;
        case Types.Entities.GOBLIN:
            return 150;
        case Types.Entities.OGRE:
            return 300;
        case Types.Entities.CRAB:
            return 200;
        case Types.Entities.SNAKE:
            return 200;
        case Types.Entities.EYE:
            return 200;
        case Types.Entities.BAT:
            return 120;
        case Types.Entities.WIZARD:
            return 200;
        case Types.Entities.BOSS:
            return 300;
        default:
            return 200;
    }
}

function resolveMoveCooldownTicks(kind: EntityKind, ups: number): number {
    const ms = resolveMoveCooldownMs(kind);
    // Use ceil to avoid server stepping faster than the client can animate.
    return Math.max(1, Math.ceil((ups * ms) / 1000));
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
    spawn,
    haters,
    tickNow,
}: {
    state: WorldState<Command, DomainEvent>;
    replication: ReturnType<typeof registerSpawnReplicationComponents>;
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
    const fallbackGroupId = pos !== undefined ? world.map.getGroupIdFromPosition(pos.x, pos.y) : undefined;

    const dropPos = pos ?? spawn;
    const droppedItem = world.getDroppedItem({ kind: mobKind, x: dropPos.x, y: dropPos.y });
    if (
        droppedItem &&
        typeof droppedItem === 'object' &&
        typeof (droppedItem as { id?: unknown }).id === 'number' &&
        typeof (droppedItem as { kind?: unknown }).kind === 'number'
    ) {
        outbox.push({
            kind: 'broadcast_nearby',
            actorId: mobId,
            action: buildDropAction(
                mobId,
                (droppedItem as { id: EntityId }).id,
                (droppedItem as { kind: EntityKind }).kind,
                haters
            ) as unknown as ServerToClientProtocolAction,
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
    const legacyPlayer = world.getConnectionPlayerById(playerId) as
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

    clearTargetsForDeadEntity({ state, replication, deadEntityId: playerId });
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
        const attackRangeTiles = resolveAttackRangeTiles({ attackerKind, weaponKind: attackerWeaponKind });
        const isInRange =
            attackerPos !== undefined && targetPos !== undefined && isWithinAttackRange(attackerPos, targetPos, attackRangeTiles);
        const isVisible =
            isMobVsPlayer && attackerPos !== undefined && targetPos !== undefined
                ? isEntityVisibleToPlayer(world, targetPos, attackerPos)
                : true;

        const windup = AttackWindup.store.get(engagement.attackerId);
        const nextAttackTick = state.world.getComponent(engagement.attackerId, combat.NextAttackTick) ?? 0;
        if (!windup && ctx.tick < nextAttackTick) {
            continue;
        }

        if (!windup) {
            if (!isInRange || !isVisible) {
                continue;
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
            state.world.removeComponent(engagement.attackerId, AttackWindup);
            continue;
        }

        if (ctx.tick < windup.hitAtTick) {
            if (!isInRange || !isVisible) {
                state.world.removeComponent(engagement.attackerId, AttackWindup);
            }
            continue;
        }

        // Hit-frame: apply damage only if still in range at this tick.
        state.world.removeComponent(engagement.attackerId, AttackWindup);
        if (!isInRange || !isVisible) {
            if (isMobVsPlayer) {
                state.world.removeComponent(engagement.attackerId, replication.Target);
            }
            continue;
        }

        const legacyAttacker: unknown = null;
        const legacyTarget: unknown = null;

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
                    mobAi.MobSpawnPos.store.get(engagement.targetId)
                    ?? state.world.getComponent(engagement.targetId, replication.Position)
                    ?? gridPos(0, 0);
                const haters =
                    mobAi.MobHate.store.get(engagement.targetId)?.entries.map((entry) => entry.id as unknown as number) ??
                    [];
                handleMobDeath({
                    state,
                    replication,
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

function applyLootCommand({
    state,
    ctx,
    combat,
    replication,
    effects,
    items,
    world,
    player,
    cmd,
}: {
    state: WorldState<Command, DomainEvent>;
    ctx: SystemContext;
    combat: ReturnType<typeof registerCombatComponents>;
    replication: ReturnType<typeof registerSpawnReplicationComponents>;
    effects: ReturnType<typeof registerEffectsComponents>;
    items: ReturnType<typeof registerItemLifecycleComponents>;
    world: WorldCommandHost;
    player: PlayerLike;
    cmd: Extract<Command, { type: 'LOOT' }>;
}): void {
    const droppedItemId = cmd.droppedItemId;
    const droppedKind = replication.Kind.store.get(droppedItemId);
    if (droppedKind === undefined || !Types.isItem(droppedKind) || !state.world.entities.isAlive(droppedItemId)) {
        return;
    }

    const staticSpawn = items.StaticSpawnPos.store.get(droppedItemId);
    const removeDroppedItem = (): void => {
        // Item entities are ECS-first; destroying the entity will trigger DESPAWN via interest diff.
        if (staticSpawn) {
            world.scheduleStaticItemRespawn({
                itemId: droppedItemId,
                kind: droppedKind,
                spawn: staticSpawn,
                tickNow: ctx.tick,
            });
        }
        if (state.world.entities.isAlive(droppedItemId)) {
            state.world.destroyEntity(droppedItemId);
        }
    };

    if (droppedKind === Types.Entities.FIREPOTION) {
        const armorKind = replication.Armor.store.get(player.id) ?? player.armor;
        const armorLevel = combat.ArmorLevel.store.get(player.id) ?? resolveArmorLevel(armorKind);
        const maxHitPoints = Formulas.hp(armorLevel);
        player.armor = armorKind;
        player.armorLevel = armorLevel;

        state.world.addComponent(player.id, combat.MaxHitPoints, maxHitPoints);
        state.world.addComponent(player.id, combat.HitPoints, maxHitPoints);

        removeDroppedItem();

        const outbox = state.resources.require(OUTBOX_RESOURCE);
        state.world.removeComponent(player.id, effects.TempVisualEquip);
        outbox.push({ kind: 'to_player', playerId: player.id, action: buildHpAction(maxHitPoints) });
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

    const healingPoints = HEALING_ITEM_POINTS_BY_KIND[droppedKind];
    if (typeof healingPoints === 'number') {
        const maxHp = combat.MaxHitPoints.store.get(player.id);
        const hp = combat.HitPoints.store.get(player.id);
        if (typeof maxHp !== 'number' || typeof hp !== 'number') {
            return;
        }
        if (hp >= maxHp) {
            return;
        }
        const nextHp = Math.min(maxHp, hp + healingPoints);
        if (nextHp === hp) {
            return;
        }

        removeDroppedItem();
        state.world.addComponent(player.id, combat.HitPoints, nextHp);
        state.world.addComponent(player.id, combat.MaxHitPoints, maxHp);
        state.events.push({ type: 'PLAYER_HEALTH_CHANGED', playerId: player.id, hitPoints: nextHp, isRegen: false });
        return;
    }

    if (Types.isArmor(droppedKind)) {
        const armorKind = droppedKind;
        const armorLevel = resolveArmorLevel(armorKind);
        const maxHitPoints = Formulas.hp(armorLevel);
        player.armor = armorKind;
        player.armorLevel = armorLevel;

        removeDroppedItem();
        world.persistPlayerEquipment(player);

        state.world.addComponent(player.id, replication.Armor, player.armor);
        state.world.addComponent(player.id, combat.ArmorLevel, player.armorLevel);
        state.world.addComponent(player.id, combat.MaxHitPoints, maxHitPoints);
        state.world.addComponent(player.id, combat.HitPoints, maxHitPoints);

        const outbox = state.resources.require(OUTBOX_RESOURCE);
        outbox.push({ kind: 'to_player', playerId: player.id, action: buildHpAction(maxHitPoints) });
        outbox.push({
            kind: 'to_player',
            playerId: player.id,
            action: buildEquipAction(player.id, droppedKind),
        });
        outbox.push({
            kind: 'broadcast_nearby',
            actorId: player.id,
            ignoredPlayerId: player.id,
            action: buildEquipAction(player.id, droppedKind),
        });
        return;
    }

    if (Types.isWeapon(droppedKind)) {
        const weaponKind = droppedKind;
        player.weapon = weaponKind;
        player.weaponLevel = resolveWeaponLevel(weaponKind);

        removeDroppedItem();
        world.persistPlayerEquipment(player);

        state.world.addComponent(player.id, replication.Weapon, player.weapon);
        state.world.addComponent(player.id, combat.WeaponLevel, player.weaponLevel);

        const outbox = state.resources.require(OUTBOX_RESOURCE);
        outbox.push({
            kind: 'to_player',
            playerId: player.id,
            action: buildEquipAction(player.id, droppedKind),
        });
        outbox.push({
            kind: 'broadcast_nearby',
            actorId: player.id,
            ignoredPlayerId: player.id,
            action: buildEquipAction(player.id, droppedKind),
        });
        return;
    }

    // Ex: CAKE is consumed but has no server-side effect beyond the client loot message.
    removeDroppedItem();
}

function _applyTeleportCommand({
    state,
    ctx,
    Position,
    Target,
    mobAi,
    movement,
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
    movement: ReturnType<typeof registerMovementComponents>;
    replication: ReturnType<typeof registerSpawnReplicationComponents>;
    world: WorldCommandHost;
    player: PlayerLike;
    cmd: Extract<Command, { type: 'TELEPORT' }>;
}): void {
    const currentPos = Position.store.get(player.id) ?? gridPos(player.x, player.y);
    const doorDestination = world.map.getDoorDestination(currentPos.x, currentPos.y);
    if (!doorDestination) {
        return;
    }
    if (doorDestination.x !== cmd.to.x || doorDestination.y !== cmd.to.y) {
        return;
    }
    if (!world.isValidPosition(cmd.to.x, cmd.to.y)) {
        return;
    }

    applyTeleportOutcome({
        state,
        ctx,
        Position,
        Target,
        mobAi,
        movement,
        replication,
        world,
        playerId: player.id,
        to: cmd.to,
    });
}

function applyTeleportOutcome({
    state,
    ctx,
    Position,
    Target,
    mobAi,
    movement,
    replication,
    world,
    playerId,
    to,
}: {
    state: WorldState<Command, DomainEvent>;
    ctx: SystemContext;
    Position: ComponentType<GridPos>;
    Target: ComponentType<EntityId>;
    mobAi: ReturnType<typeof registerMobAiComponents>;
    movement: ReturnType<typeof registerMovementComponents>;
    replication: ReturnType<typeof registerSpawnReplicationComponents>;
    world: WorldCommandHost;
    playerId: EntityId;
    to: GridPos;
}): void {
    state.world.addComponent(playerId, Position, to);
    state.world.removeComponent(playerId, Target);

    const teleport = buildTeleportAction(playerId, to.x, to.y);
    const outbox = state.resources.require(OUTBOX_RESOURCE);
    outbox.push({ kind: 'to_player', playerId, action: teleport });
    outbox.push({ kind: 'broadcast_nearby', actorId: playerId, ignoredPlayerId: playerId, action: teleport });

    state.world.removeComponent(playerId, movement.MoveQueue);
    state.world.removeComponent(playerId, movement.NextMoveTick);
    clearPlayerFromMobAggro({ state, mobAi, replication, world, playerId, tickNow: ctx.tick });
}

function applyOpenCommand({
    state,
    Kind,
    Position,
    ChestLootTable,
    world,
    cmd,
}: {
    state: WorldState<Command, DomainEvent>;
    Kind: ComponentType<EntityKind>;
    Position: ComponentType<GridPos>;
    ChestLootTable: ComponentType<{ items: ReadonlyArray<EntityKind> }>;
    world: WorldCommandHost;
    cmd: Extract<Command, { type: 'OPEN' }>;
}): void {
    const kind = Kind.store.get(cmd.chestId);
    if (kind !== Types.Entities.CHEST) {
        return;
    }

    const pos = Position.store.get(cmd.chestId);
    if (!pos) {
        return;
    }

    const loot = ChestLootTable.store.get(cmd.chestId);
    const items = loot?.items ?? [];
    const drop = items.length > 0 ? items[Utils.random(items.length)] : null;

    if (state.world.entities.isAlive(cmd.chestId)) {
        state.world.destroyEntity(cmd.chestId);
    }
    if (typeof drop === 'number') {
        const item = world.addItemFromChest(drop, pos.x, pos.y);
        world.handleItemDespawn(item);
    }
}

function applyCheckCommand(world: WorldCommandHost, player: PlayerLike, cmd: Extract<Command, { type: 'CHECK' }>): void {
    const checkpoint = world.map.getCheckpoint(cmd.checkpointId);
    if (checkpoint) {
        player.lastCheckpoint = checkpoint;
        world.persistPlayerCheckpoint(resolvePlayerIdentityKey(player) ?? player.name, cmd.checkpointId);
    }
}

function applyChatCommand(state: WorldState<Command, DomainEvent>, playerId: EntityId, cmd: Extract<Command, { type: 'CHAT' }>): void {
    if (cmd.message && cmd.message !== '') {
        const outbox = state.resources.require(OUTBOX_RESOURCE);
        outbox.push({ kind: 'broadcast_nearby', actorId: playerId, action: buildChatAction(playerId, cmd.message) });
    }
}

function applyClaimCreateIntent({
    state,
    world,
    player,
    cmd,
}: {
    state: WorldState<Command, DomainEvent>;
    world: WorldCommandHost;
    player: PlayerLike;
    cmd: Extract<Command, { type: 'CLAIM_CREATE' }>;
}): { ok: false; reason: string } | { ok: true } {
    const actorNameKey = resolvePlayerIdentityKey(player);
    if (!actorNameKey) {
        return { ok: false, reason: 'PERMISSION:identity_required' };
    }

    const claims = state.resources.require(CLAIMS_STORE_RESOURCE);
    if (claims.countClaimsByOwner(actorNameKey) >= MAX_CLAIMS_PER_OWNER) {
        return { ok: false, reason: 'CLAIM:owner_quota_exceeded' };
    }

    const boundsValidation = validateClaimBounds({
        world,
        x1: cmd.x1,
        y1: cmd.y1,
        x2: cmd.x2,
        y2: cmd.y2,
    });
    if (!boundsValidation.ok) {
        return { ok: false, reason: boundsValidation.reason };
    }
    const { bounds } = boundsValidation;

    const overlap = claims.findFirstOverlappingClaim(bounds);
    if (overlap) {
        return { ok: false, reason: 'CLAIM:overlap' };
    }

    const editorNameKeys = normalizeEditorNameKeys(cmd.editorNameKeys, actorNameKey);
    let claim: RectClaim;
    try {
        claim = claims.createClaim({
            ownerName: actorNameKey,
            editorNameKeys,
            x1: bounds.x1,
            y1: bounds.y1,
            x2: bounds.x2,
            y2: bounds.y2,
        });
    } catch (err) {
        return { ok: false, reason: `CLAIM:create_failed:${String(err)}` };
    }
    world.persistClaimUpsert?.(claim);
    return { ok: true };
}

function applyClaimUpdateIntent({
    state,
    world,
    player,
    cmd,
}: {
    state: WorldState<Command, DomainEvent>;
    world: WorldCommandHost;
    player: PlayerLike;
    cmd: Extract<Command, { type: 'CLAIM_UPDATE' }>;
}): { ok: false; reason: string } | { ok: true } {
    const actorNameKey = resolvePlayerIdentityKey(player);
    if (!actorNameKey) {
        return { ok: false, reason: 'PERMISSION:identity_required' };
    }

    const claims = state.resources.require(CLAIMS_STORE_RESOURCE);
    const claim = claims.getClaimById(cmd.claimId);
    if (!claim) {
        return { ok: false, reason: 'CLAIM:not_found' };
    }

    const editDecision = canEditClaim({ actorName: actorNameKey, claim });
    if (!editDecision.ok) {
        return { ok: false, reason: `PERMISSION:${editDecision.code}` };
    }

    const boundsValidation = validateClaimBounds({
        world,
        x1: cmd.x1,
        y1: cmd.y1,
        x2: cmd.x2,
        y2: cmd.y2,
    });
    if (!boundsValidation.ok) {
        return { ok: false, reason: boundsValidation.reason };
    }
    const { bounds } = boundsValidation;

    const overlap = claims.findFirstOverlappingClaim({ ...bounds, excludeClaimId: claim.id });
    if (overlap) {
        return { ok: false, reason: 'CLAIM:overlap' };
    }

    const updates: {
        id: number;
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        editorNameKeys?: ReadonlyArray<string>;
    } = {
        id: claim.id,
        x1: bounds.x1,
        y1: bounds.y1,
        x2: bounds.x2,
        y2: bounds.y2,
    };

    if (cmd.editorNameKeys !== undefined) {
        const ownerDecision = canManageClaim({ actorName: actorNameKey, claim });
        if (!ownerDecision.ok) {
            return { ok: false, reason: `PERMISSION:${ownerDecision.code}` };
        }
        updates.editorNameKeys = normalizeEditorNameKeys(cmd.editorNameKeys, claim.ownerName);
    }

    let updated: RectClaim | null;
    try {
        updated = claims.updateClaim(updates);
    } catch (err) {
        return { ok: false, reason: `CLAIM:update_failed:${String(err)}` };
    }
    if (!updated) {
        return { ok: false, reason: 'CLAIM:not_found' };
    }
    world.persistClaimUpsert?.(updated);
    return { ok: true };
}

function applyClaimDeleteIntent({
    state,
    world,
    player,
    cmd,
}: {
    state: WorldState<Command, DomainEvent>;
    world: WorldCommandHost;
    player: PlayerLike;
    cmd: Extract<Command, { type: 'CLAIM_DELETE' }>;
}): { ok: false; reason: string } | { ok: true } {
    const actorNameKey = resolvePlayerIdentityKey(player);
    if (!actorNameKey) {
        return { ok: false, reason: 'PERMISSION:identity_required' };
    }

    const claims = state.resources.require(CLAIMS_STORE_RESOURCE);
    const claim = claims.getClaimById(cmd.claimId);
    if (!claim) {
        return { ok: false, reason: 'CLAIM:not_found' };
    }

    const decision = canManageClaim({ actorName: actorNameKey, claim });
    if (!decision.ok) {
        return { ok: false, reason: `PERMISSION:${decision.code}` };
    }

    if (!claims.deleteClaim(claim.id)) {
        return { ok: false, reason: 'CLAIM:not_found' };
    }
    world.persistClaimDelete?.(claim.id);
    return { ok: true };
}

function createApplyInboundCommandsSystem(
    world: WorldCommandHost,
    Position: ComponentType<GridPos>,
    Target: ComponentType<EntityId>,
    replication: ReturnType<typeof registerSpawnReplicationComponents>,
    combat: ReturnType<typeof registerCombatComponents>,
    effects: ReturnType<typeof registerEffectsComponents>,
    items: ReturnType<typeof registerItemLifecycleComponents>,
    mobAi: ReturnType<typeof registerMobAiComponents>,
    movement: ReturnType<typeof registerMovementComponents>,
    chests: ReturnType<typeof registerChestComponents>,
    modules: GameModuleRegistry
) {
    return (state: WorldState<Command, DomainEvent>, ctx: SystemContext) => {
        const seqState = state.resources.require(INTENT_SEQ_STATE_RESOURCE);
        const chunkAoi = state.resources.require(CHUNK_AOI_STATE_RESOURCE);
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
                    modules,
                    player,
                    cmd,
                });
                state.world.removeComponent(player.id, movement.MoveQueue);
                state.world.removeComponent(player.id, movement.NextMoveTick);
                continue;
            }

            const player = world.getConnectionPlayerById(cmd.source.playerId);
            if (!player) {
                continue;
            }

                    const intentCtx: InboundIntentContext = {
                        modules,
                        state,
                        ctx,
                        world,
                        player,
                        Position,
                        Target,
                        movement,
                        mobAi,
                        replication,
                    };

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
                case 'INTENT': {
                    const reject = (reason: string) => {
                        world.pushToPlayerId(cmd.source.playerId, buildRejectAction(cmd.seq, cmd.intentTypeId, reason));
                    };

                    const correction = () => {
                        const pos = Position.store.get(player.id) ?? gridPos(player.x, player.y);
                        world.pushToPlayerId(cmd.source.playerId, buildCorrectionMoveAction(cmd.seq, pos.x, pos.y));
                    };

                    const lastAccepted = seqState.lastAcceptedByPlayerId.get(player.id) ?? -1;
                    const maxSeqGap = 2048;
                    if (cmd.seq < lastAccepted) {
                        reject(`Stale seq: ${cmd.seq} < ${lastAccepted}`);
                        correction();
                        break;
                    }
                    if (cmd.seq === lastAccepted) {
                        world.pushToPlayerId(cmd.source.playerId, buildAckAction(cmd.seq));
                        break;
                    }
                    if (cmd.seq > lastAccepted + maxSeqGap) {
                        reject(`Seq gap too large: ${cmd.seq} > ${lastAccepted} + ${maxSeqGap}`);
                        correction();
                        break;
                    }

                    const handler = modules.getIntentHandler(cmd.intentTypeId);
                    if (!handler) {
                        reject(`Unknown intentTypeId: ${cmd.intentTypeId}`);
                        correction();
                        break;
                    }

                    let bridged: Command | null = null;
                    if (cmd.intentTypeId === INTENT_MOVE_STEP) {
                        const to = decodeIntentGridPos(cmd.payloadJson);
                        bridged = to
                            ? ({ type: 'MOVE', source: cmd.source, to } satisfies Extract<Command, { type: 'MOVE' }>)
                            : null;
                    } else if (cmd.intentTypeId === INTENT_DOOR_TELEPORT) {
                        const to = decodeIntentGridPos(cmd.payloadJson);
                        bridged = to
                            ? ({ type: 'TELEPORT', source: cmd.source, to } satisfies Extract<Command, { type: 'TELEPORT' }>)
                            : null;
                    } else if (cmd.intentTypeId === INTENT_TILE_EDIT) {
                        const edit = decodeIntentTileEdit(cmd.payloadJson);
                        bridged = edit
                            ? ({
                                  type: 'TILE_EDIT',
                                  source: cmd.source,
                                  x: edit.x,
                                  y: edit.y,
                                  value: edit.value,
                              } satisfies Extract<Command, { type: 'TILE_EDIT' }>)
                            : null;
                    } else if (cmd.intentTypeId === INTENT_CLAIM_CREATE) {
                        const claim = decodeIntentClaimCreate(cmd.payloadJson);
                        bridged = claim
                            ? ({
                                  type: 'CLAIM_CREATE',
                                  source: cmd.source,
                                  x1: claim.x1,
                                  y1: claim.y1,
                                  x2: claim.x2,
                                  y2: claim.y2,
                                  editorNameKeys: claim.editorNameKeys,
                              } satisfies Extract<Command, { type: 'CLAIM_CREATE' }>)
                            : null;
                    } else if (cmd.intentTypeId === INTENT_CLAIM_UPDATE) {
                        const claim = decodeIntentClaimUpdate(cmd.payloadJson);
                        bridged = claim
                            ? ({
                                  type: 'CLAIM_UPDATE',
                                  source: cmd.source,
                                  claimId: claim.claimId,
                                  x1: claim.x1,
                                  y1: claim.y1,
                                  x2: claim.x2,
                                  y2: claim.y2,
                                  ...(claim.editorNameKeys !== undefined ? { editorNameKeys: claim.editorNameKeys } : {}),
                              } satisfies Extract<Command, { type: 'CLAIM_UPDATE' }>)
                            : null;
                    } else if (cmd.intentTypeId === INTENT_CLAIM_DELETE) {
                        const claim = decodeIntentClaimDelete(cmd.payloadJson);
                        bridged = claim
                            ? ({
                                  type: 'CLAIM_DELETE',
                                  source: cmd.source,
                                  claimId: claim.claimId,
                              } satisfies Extract<Command, { type: 'CLAIM_DELETE' }>)
                            : null;
                    }

                    if (!bridged) {
                        reject(`Unsupported INTENT payload for: ${cmd.intentTypeId}`);
                        correction();
                        break;
                    }

                    (intentCtx as unknown as { intentSourceKind?: 'intent' }).intentSourceKind = 'intent';
                    const result = handler(intentCtx, bridged);
                    if (result && typeof result === 'object' && 'ok' in result && result.ok === false) {
                        reject(result.reason);
                        if (cmd.intentTypeId === INTENT_MOVE_STEP) {
                            correction();
                        }
                        break;
                    }
                    seqState.lastAcceptedByPlayerId.set(player.id, cmd.seq);
                    world.pushToPlayerId(cmd.source.playerId, buildAckAction(cmd.seq));
                    break;
                }
                case 'MOVE':
                    {
                        (intentCtx as unknown as { intentSourceKind?: 'legacy' }).intentSourceKind = 'legacy';
                        const handler = modules.getIntentHandler(INTENT_MOVE_STEP);
                        if (!handler) {
                            throw new Error(`Missing intent handler: ${INTENT_MOVE_STEP}`);
                        }
                        handler(intentCtx, cmd);
                    }
                    break;
                case 'TILE_EDIT':
                    {
                        const handler = modules.getIntentHandler(INTENT_TILE_EDIT);
                        if (!handler) {
                            throw new Error(`Missing intent handler: ${INTENT_TILE_EDIT}`);
                        }
                        handler(intentCtx, cmd);
                    }
                    break;
                case 'CLAIM_CREATE':
                    {
                        const handler = modules.getIntentHandler(INTENT_CLAIM_CREATE);
                        if (!handler) {
                            throw new Error(`Missing intent handler: ${INTENT_CLAIM_CREATE}`);
                        }
                        handler(intentCtx, cmd);
                    }
                    break;
                case 'CLAIM_UPDATE':
                    {
                        const handler = modules.getIntentHandler(INTENT_CLAIM_UPDATE);
                        if (!handler) {
                            throw new Error(`Missing intent handler: ${INTENT_CLAIM_UPDATE}`);
                        }
                        handler(intentCtx, cmd);
                    }
                    break;
                case 'CLAIM_DELETE':
                    {
                        const handler = modules.getIntentHandler(INTENT_CLAIM_DELETE);
                        if (!handler) {
                            throw new Error(`Missing intent handler: ${INTENT_CLAIM_DELETE}`);
                        }
                        handler(intentCtx, cmd);
                    }
                    break;
                case 'LOOTMOVE':
                    applyLootMoveCommand({ state, Kind: replication.Kind, Position, Target, player, cmd });
                    break;
                case 'AGGRO':
                    addMobHate({ state, mobAi, replication, mobId: cmd.mobId, playerId: player.id, hatePoints: 5 });
                    break;
                case 'ATTACK':
                    applyAttackCommand({ state, mobAi, replication, Target, cmd });
                    break;
                case 'LOOT':
                    applyLootCommand({ state, ctx, combat, replication, effects, items, world, player, cmd });
                    break;
                case 'TELEPORT':
                    {
                        const handler = modules.getIntentHandler(INTENT_DOOR_TELEPORT);
                        if (!handler) {
                            throw new Error(`Missing intent handler: ${INTENT_DOOR_TELEPORT}`);
                        }
                        handler(intentCtx, cmd);
                    }
                    break;
                case 'OPEN':
                    applyOpenCommand({
                        state,
                        Kind: replication.Kind,
                        Position,
                        ChestLootTable: chests.ChestLootTable,
                        world,
                        cmd,
                    });
                    break;
                case 'CHECK':
                    applyCheckCommand(world, player, cmd);
                    break;
                case 'ACHIEVEMENT':
                    world.persistPlayerAchievementUnlock(resolvePlayerIdentityKey(player) ?? player.name, cmd.achievementId);
                    break;
                case 'CHUNK_SUBSCRIBE': {
                    const radius = Math.max(0, Math.min(8, cmd.radius));
                    const center = {
                        chunkX: cmd.chunkX,
                        chunkY: cmd.chunkY,
                    };
                    const existing = chunkAoi.byPlayerId.get(player.id);
                    const knownChunks = existing?.knownChunks ?? new Set<bigint>();
                    knownChunks.clear();
                    const knownChunkVersions = existing?.knownChunkVersions ?? new Map<bigint, number>();
                    knownChunkVersions.clear();
                    const pendingChunkKeys = existing?.pendingChunkKeys ?? new Set<bigint>();
                    pendingChunkKeys.clear();
                    const inFlightSnapshotKeys = existing?.inFlightSnapshotKeys ?? new Set<bigint>();
                    inFlightSnapshotKeys.clear();

                    const next: ChunkSubscription = {
                        radius,
                        lastCenterChunkX: center.chunkX,
                        lastCenterChunkY: center.chunkY,
                        knownChunks,
                        knownChunkVersions,
                        pendingChunks: [],
                        pendingChunkKeys,
                        inFlightSnapshotKeys,
                        pendingSnapshotParts: [],
                    };
                    chunkAoi.byPlayerId.set(player.id, next);
                    enqueueChunkAoiUpdates(next, center.chunkX, center.chunkY);
                    break;
                }
                case 'CHUNK_UNSUBSCRIBE':
                    chunkAoi.byPlayerId.delete(player.id);
                    break;
                default:
                    // Ensure exhaustive handling when new command types are introduced.
                     
                    const _exhaustive: never = cmd;
                    break;
            }
        }
    };
}

function safeParseJson(payload: string): unknown {
    try {
        return JSON.parse(payload);
    } catch (_) {
        return null;
    }
}

function decodeIntentGridPos(payloadJson: string): GridPos | null {
    const parsed = safeParseJson(payloadJson);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null;
    }
    const record = parsed as Record<string, unknown>;
    const x = record.x;
    const y = record.y;
    if (typeof x !== 'number' || typeof y !== 'number' || !Number.isInteger(x) || !Number.isInteger(y)) {
        return null;
    }
    return gridPos(x, y);
}

function decodeIntentTileEdit(payloadJson: string): { x: number; y: number; value: number | null } | null {
    const parsed = safeParseJson(payloadJson);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null;
    }
    const record = parsed as Record<string, unknown>;
    const x = record.x;
    const y = record.y;
    const value = record.value;
    const TILE_COORD_ABS_MAX = 1_000_000;
    const TILE_VALUE_MAX = 0xffff_ffff;
    if (
        typeof x !== 'number'
        || typeof y !== 'number'
        || !Number.isInteger(x)
        || !Number.isInteger(y)
        || Math.abs(x) > TILE_COORD_ABS_MAX
        || Math.abs(y) > TILE_COORD_ABS_MAX
    ) {
        return null;
    }
    if (value === null) {
        return { x, y, value: null };
    }
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > TILE_VALUE_MAX) {
        return null;
    }
    return { x, y, value };
}

function parseEditorsPayload(record: Record<string, unknown>): string[] | undefined | null {
    if (!Object.prototype.hasOwnProperty.call(record, 'editors')) {
        return undefined;
    }
    const editorsRaw = record.editors;
    if (!Array.isArray(editorsRaw)) {
        return null;
    }
    if (editorsRaw.length > MAX_CLAIM_EDITORS) {
        return null;
    }
    const editorNameKeys: string[] = [];
    for (let i = 0; i < editorsRaw.length; i += 1) {
        const raw = editorsRaw[i];
        if (typeof raw !== 'string') {
            return null;
        }
        editorNameKeys.push(raw);
    }
    return editorNameKeys;
}

function decodeIntentClaimCreate(payloadJson: string): { x1: number; y1: number; x2: number; y2: number; editorNameKeys: string[] } | null {
    const parsed = safeParseJson(payloadJson);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null;
    }
    const record = parsed as Record<string, unknown>;
    const x1 = record.x1;
    const y1 = record.y1;
    const x2 = record.x2;
    const y2 = record.y2;
    if (
        typeof x1 !== 'number'
        || typeof y1 !== 'number'
        || typeof x2 !== 'number'
        || typeof y2 !== 'number'
        || !Number.isInteger(x1)
        || !Number.isInteger(y1)
        || !Number.isInteger(x2)
        || !Number.isInteger(y2)
    ) {
        return null;
    }
    const editors = parseEditorsPayload(record);
    if (editors === null) {
        return null;
    }
    return { x1, y1, x2, y2, editorNameKeys: editors ?? [] };
}

function decodeIntentClaimUpdate(payloadJson: string): {
    claimId: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    editorNameKeys?: string[];
} | null {
    const parsed = safeParseJson(payloadJson);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null;
    }
    const record = parsed as Record<string, unknown>;
    const claimId = record.id;
    const x1 = record.x1;
    const y1 = record.y1;
    const x2 = record.x2;
    const y2 = record.y2;
    if (
        typeof claimId !== 'number'
        || !Number.isSafeInteger(claimId)
        || claimId <= 0
        || typeof x1 !== 'number'
        || typeof y1 !== 'number'
        || typeof x2 !== 'number'
        || typeof y2 !== 'number'
        || !Number.isInteger(x1)
        || !Number.isInteger(y1)
        || !Number.isInteger(x2)
        || !Number.isInteger(y2)
    ) {
        return null;
    }
    const editors = parseEditorsPayload(record);
    if (editors === null) {
        return null;
    }
    return { claimId, x1, y1, x2, y2, ...(editors !== undefined ? { editorNameKeys: editors } : {}) };
}

function decodeIntentClaimDelete(payloadJson: string): { claimId: number } | null {
    const parsed = safeParseJson(payloadJson);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null;
    }
    const record = parsed as Record<string, unknown>;
    const claimId = record.id;
    if (typeof claimId !== 'number' || !Number.isSafeInteger(claimId) || claimId <= 0) {
        return null;
    }
    return { claimId };
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
    readonly chests = registerChestComponents(this.state.world);
    readonly mobAi = registerMobAiComponents(this.state.world);
    readonly movement = registerMovementComponents(this.state.world);
    readonly chunkOverlays: ChunkOverlayStore;
    #maxChunkSnapshotPayloadUtf8Bytes: number;
    #maxChunkSnapshotParts: number;
    #tick = 0;

    constructor(world: WorldCommandHost, { chunkSize }: { chunkSize?: number } = {}) {
        this.#world = world;
        this.#maxChunkSnapshotPayloadUtf8Bytes = resolveMaxChunkSnapshotPayloadUtf8BytesFromEnv();
        this.#maxChunkSnapshotParts = DEFAULT_MAX_CHUNK_SNAPSHOT_PARTS;
        const chunkSizeRaw = chunkSize;
        const resolvedChunkSize =
            typeof chunkSizeRaw === 'number' && Number.isInteger(chunkSizeRaw) && chunkSizeRaw > 0 && chunkSizeRaw <= 256
                ? chunkSizeRaw
                : DEFAULT_CHUNK_SIZE;
        this.chunkOverlays = new ChunkOverlayStore({ chunkSize: resolvedChunkSize });
        this.state.resources.set(OUTBOX_RESOURCE, new Queue());
        this.state.resources.set(INTEREST_TRACKER_RESOURCE, new InterestTracker());
        this.state.resources.set(RESPAWN_TASKS_RESOURCE, []);
        this.state.resources.set(INTENT_SEQ_STATE_RESOURCE, createIntentSeqState());
        this.state.resources.set(CHUNK_AOI_STATE_RESOURCE, createChunkAoiState());
        this.state.resources.set(CHUNK_OVERLAY_STORE_RESOURCE, this.chunkOverlays);
        this.state.resources.set(CLAIMS_STORE_RESOURCE, new ClaimsStore());

        const modules = createCoreServerModuleRegistry();

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
                this.items,
                this.mobAi,
                this.movement,
                this.chests,
                modules
            )
        );
        this.#scheduler.register('sim', 'player_move', (state, ctx: SystemContext) => {
            const Kind = this.replication.Kind;
            const Position = this.Position;
            const Target = this.replication.Target;
            const { MoveQueue, NextMoveTick } = this.movement;
            const { HitPoints } = this.combat;
            const outbox = state.resources.require(OUTBOX_RESOURCE);

            const ups = Math.max(1, this.#world.ups);
            const positionKey = (x: number, y: number) => `${x},${y}`;
            const occupiedBy = new Map<string, EntityId>();

            Position.store.forEach((id, pos) => {
                const kind = Kind.store.get(id);
                if (kind === undefined) {
                    return;
                }
                // Items are intentionally excluded so players can stand on them to loot.
                if (!Types.isPlayer(kind) && !Types.isMob(kind) && !Types.isChest(kind) && !Types.isNpc(kind)) {
                    return;
                }
                occupiedBy.set(positionKey(pos.x, pos.y), id);
            });

            const teleportCorrect = (playerId: EntityId, pos: GridPos) => {
                outbox.push({
                    kind: 'to_player',
                    playerId,
                    action: buildTeleportAction(playerId, pos.x, pos.y),
                });
            };

            MoveQueue.store.forEach((playerId, queue) => {
                const kind = Kind.store.get(playerId);
                if (kind === undefined || !Types.isPlayer(kind)) {
                    state.world.removeComponent(playerId, MoveQueue);
                    return;
                }

                const hp = HitPoints.store.get(playerId) ?? 0;
                if (hp <= 0) {
                    state.world.removeComponent(playerId, MoveQueue);
                    return;
                }

                const nextAllowedTick = NextMoveTick.store.get(playerId) ?? 0;
                if (ctx.tick < nextAllowedTick) {
                    return;
                }

                const from = Position.store.get(playerId);
                if (!from) {
                    state.world.removeComponent(playerId, MoveQueue);
                    return;
                }

                const next = queue.entries[0];
                if (!next) {
                    state.world.removeComponent(playerId, MoveQueue);
                    return;
                }

                const dist = Math.abs(from.x - next.x) + Math.abs(from.y - next.y);
                if (dist !== 1 || !this.#world.isValidPosition(next.x, next.y)) {
                    teleportCorrect(playerId, from);
                    state.world.removeComponent(playerId, MoveQueue);
                    return;
                }

                const occupant = occupiedBy.get(positionKey(next.x, next.y));
                if (occupant !== undefined && occupant !== playerId) {
                    teleportCorrect(playerId, from);
                    state.world.removeComponent(playerId, MoveQueue);
                    return;
                }

                const oldKey = positionKey(from.x, from.y);
                if (occupiedBy.get(oldKey) === playerId) {
                    occupiedBy.delete(oldKey);
                }
                occupiedBy.set(positionKey(next.x, next.y), playerId);

                state.world.removeComponent(playerId, Target);
                state.world.addComponent(playerId, Position, next);

                outbox.push({ kind: 'to_player', playerId, action: buildMoveAction(playerId, next.x, next.y) });
                state.events.push({ type: 'ENTITY_MOVED', entityId: playerId, to: next });

                const doorDestination = this.#world.map.getDoorDestination(next.x, next.y);
                if (doorDestination && this.#world.isValidPosition(doorDestination.x, doorDestination.y)) {
                    const destinationKey = positionKey(doorDestination.x, doorDestination.y);
                    const destinationOccupant = occupiedBy.get(destinationKey);
                    if (destinationOccupant === undefined || destinationOccupant === playerId) {
                        occupiedBy.delete(positionKey(next.x, next.y));
                        occupiedBy.set(destinationKey, playerId);

                        const teleport = modules.getOutcomeHandler(OUTCOME_DOOR_TELEPORT);
                        if (!teleport) {
                            throw new Error(`Missing outcome handler: ${OUTCOME_DOOR_TELEPORT}`);
                        }

                        const player = this.#world.getConnectionPlayerById(playerId);
                        if (!player) {
                            state.world.removeComponent(playerId, MoveQueue);
                            return;
                        }

                        teleport(
                            {
                                modules,
                                state,
                                ctx,
                                world: this.#world,
                                player,
                                Position,
                                Target,
                                movement: this.movement,
                                mobAi: this.mobAi,
                                replication: this.replication,
                            },
                            { playerId, to: gridPos(doorDestination.x, doorDestination.y) } satisfies DoorTeleportOutcome
                        );
                        return;
                    }
                }

                state.world.addComponent(playerId, NextMoveTick, ctx.tick + resolveMoveCooldownTicks(kind, ups));

                const remaining = queue.entries.slice(1);
                if (remaining.length === 0) {
                    state.world.removeComponent(playerId, MoveQueue);
                } else {
                    state.world.addComponent(playerId, MoveQueue, { entries: remaining });
                }
            });
        });
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

                state.world.removeComponent(entry.id, ItemDespawnTimer);
                this.removeEntity(entry.id);
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
            const { MobSpawnPos, MobHate, MobReturnAtTick, MobNextMoveTick } = this.mobAi;

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
                if (!Types.isPlayer(kind) && !Types.isMob(kind) && !Types.isChest(kind) && !Types.isNpc(kind)) {
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
                const mobKind = Kind.store.get(mobId);
                if (mobKind === undefined) {
                    continue;
                }

                const currentPos = Position.store.get(mobId);
                if (!currentPos) {
                    continue;
                }

                let spawn = MobSpawnPos.store.get(mobId);
                if (!spawn) {
                    spawn = currentPos;
                    state.world.addComponent(mobId, MobSpawnPos, spawn);
                }

                const hate = MobHate.store.get(mobId)?.entries ?? [];
                if (hate.length === 0) {
                    const returnAtTick = MobReturnAtTick.store.get(mobId);
                    if (typeof returnAtTick === 'number' && ctx.tick >= returnAtTick) {
                        if (currentPos.x === spawn.x && currentPos.y === spawn.y) {
                            state.world.removeComponent(mobId, MobReturnAtTick);
                        } else {
                            const next = chooseStepTowards({
                                from: currentPos,
                                to: spawn,
                                avoidExactTargetTile: false,
                                isValidPosition: (x, y) => canMobMoveTo(mobId, x, y),
                            });
                            if (next) {
                                const nextMoveTick = MobNextMoveTick.store.get(mobId) ?? 0;
                                if (ctx.tick < nextMoveTick) {
                                    continue;
                                }
                                const oldKey = positionKey(currentPos.x, currentPos.y);
                                if (occupiedBy.get(oldKey) === mobId) {
                                    occupiedBy.delete(oldKey);
                                }
                                state.world.addComponent(mobId, Position, next);
                                state.world.addComponent(
                                    mobId,
                                    MobNextMoveTick,
                                    ctx.tick + resolveMoveCooldownTicks(mobKind, ups)
                                );
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
                    if (!this.#world.isPlayerActive(entry.id)) {
                        continue;
                    }
                    const playerKind = Kind.store.get(entry.id);
                    if (playerKind === undefined || !Types.isPlayer(playerKind)) {
                        continue;
                    }
                    const playerHp = this.combat.HitPoints.store.get(entry.id) ?? 0;
                    if (playerHp <= 0) {
                        continue;
                    }
                    filtered.push(entry);
                }

                if (filtered.length !== hate.length) {
                    if (filtered.length === 0) {
                        state.world.removeComponent(mobId, MobHate);
                        state.world.addComponent(mobId, MobReturnAtTick, ctx.tick + returnDelayTicks);
                        state.world.removeComponent(mobId, Target);
                        continue;
                    }
                    state.world.addComponent(mobId, MobHate, { entries: filtered });
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
                    state.events.push({ type: 'ENTITY_ATTACKED', attackerId: mobId, targetId: desiredTargetId });
                }

                const targetPos = Position.store.get(desiredTargetId);
                if (!targetPos) {
                    continue;
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
                    continue;
                }

                const nextMoveTick = MobNextMoveTick.store.get(mobId) ?? 0;
                if (ctx.tick < nextMoveTick) {
                    continue;
                }

                const oldKey = positionKey(currentPos.x, currentPos.y);
                if (occupiedBy.get(oldKey) === mobId) {
                    occupiedBy.delete(oldKey);
                }
                state.world.addComponent(mobId, Position, next);
                state.world.addComponent(mobId, MobNextMoveTick, ctx.tick + resolveMoveCooldownTicks(mobKind, ups));
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

    seedItemFromSpawn({
        id,
        kind,
        x,
        y,
    }: {
        id: EntityId;
        kind: EntityKind;
        x: number;
        y: number;
    }): void {
        this.state.world.ensureEntity(id);
        this.state.world.addComponent(id, this.replication.Kind, kind);
        this.state.world.addComponent(id, this.Position, gridPos(x, y));
    }

    seedMobFromPrefabSpawn({
        id,
        kind,
        x,
        y,
        spawnX,
        spawnY,
        orientation,
    }: {
        id: EntityId;
        kind: EntityKind;
        x: number;
        y: number;
        spawnX: number;
        spawnY: number;
        orientation?: number;
    }): void {
        this.seedItemFromSpawn({ id, kind, x, y });
        this.state.world.addComponent(id, this.replication.Orientation, orientation ?? resolveDeterministicOrientation(id));
        this.state.world.addComponent(id, this.mobAi.MobSpawnPos, gridPos(spawnX, spawnY));

        const prefab = requireMobPrefab(kind);
        this.state.world.addComponent(id, this.combat.ArmorLevel, prefab.combat.armorLevel);
        this.state.world.addComponent(id, this.combat.WeaponLevel, prefab.combat.weaponLevel);
        this.state.world.addComponent(id, this.combat.MaxHitPoints, prefab.combat.maxHitPoints);
        this.state.world.addComponent(id, this.combat.HitPoints, prefab.combat.maxHitPoints);
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

        if (typeof entity.hitPoints === 'number' && this.combat.HitPoints.store.get(entity.id) === undefined) {
            this.state.world.addComponent(entity.id, this.combat.HitPoints, entity.hitPoints);
        }
        if (typeof entity.maxHitPoints === 'number' && this.combat.MaxHitPoints.store.get(entity.id) === undefined) {
            this.state.world.addComponent(entity.id, this.combat.MaxHitPoints, entity.maxHitPoints);
        }
        if (typeof entity.armorLevel === 'number' && this.combat.ArmorLevel.store.get(entity.id) === undefined) {
            this.state.world.addComponent(entity.id, this.combat.ArmorLevel, entity.armorLevel);
        }
        if (typeof entity.weaponLevel === 'number' && this.combat.WeaponLevel.store.get(entity.id) === undefined) {
            this.state.world.addComponent(entity.id, this.combat.WeaponLevel, entity.weaponLevel);
        }
    }

    syncChestLootEntity(entity: Readonly<{ id: EntityId; kind?: EntityKind; items?: unknown }>): void {
        if (entity.kind !== Types.Entities.CHEST) {
            return;
        }

        if (this.chests.ChestLootTable.store.get(entity.id) !== undefined) {
            return;
        }

        const rawItems = entity.items;
        const items = Array.isArray(rawItems) ? (rawItems as unknown[]) : [];

        const loot: EntityKind[] = [];
        for (let i = 0; i < items.length; i += 1) {
            const item = items[i];
            if (typeof item !== 'number') {
                continue;
            }
            if (item === Types.Entities.CHEST) {
                continue;
            }
            if (Types.getKindAsString(item as EntityKind) === undefined) {
                continue;
            }
            loot.push(item as EntityKind);
        }

        this.state.world.ensureEntity(entity.id);
        this.state.world.addComponent(entity.id, this.chests.ChestLootTable, { items: loot });
    }

    setChestLootTable(chestId: EntityId, rawItems: unknown): void {
        const items = Array.isArray(rawItems) ? (rawItems as unknown[]) : [];

        const loot: EntityKind[] = [];
        for (let i = 0; i < items.length; i += 1) {
            const item = items[i];
            if (typeof item !== 'number') {
                continue;
            }
            if (item === Types.Entities.CHEST) {
                continue;
            }
            if (Types.getKindAsString(item as EntityKind) === undefined) {
                continue;
            }
            loot.push(item as EntityKind);
        }

        this.state.world.ensureEntity(chestId);
        this.state.world.addComponent(chestId, this.chests.ChestLootTable, { items: loot });
    }

    removeEntity(id: EntityId): void {
        this.state.resources.get(INTENT_SEQ_STATE_RESOURCE)?.lastAcceptedByPlayerId.delete(id);
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

    buildSpawnActionForEntityId(entityId: EntityId): ServerToClientSpawnAction {
        return buildSpawnActionFromReplicationState(this.state.world, this.replication, entityId);
    }

    setServerConfig(config: ServerConfig | null | undefined): void {
        // Keep this narrow: this class only needs config for replication caps.
        if (!config) {
            this.#maxChunkSnapshotPayloadUtf8Bytes = resolveMaxChunkSnapshotPayloadUtf8BytesFromEnv();
            this.#maxChunkSnapshotParts = DEFAULT_MAX_CHUNK_SNAPSHOT_PARTS;
            return;
        }

        // Test env override remains the highest priority for deterministic unit tests.
        this.#maxChunkSnapshotPayloadUtf8Bytes = resolveMaxChunkSnapshotPayloadUtf8BytesFromEnv();
        if (process.env.BQ_TEST_CHUNK_SNAPSHOT_MAX_UTF8_BYTES === undefined) {
            const configured = resolvePositiveIntegerOrNull(config.chunk_snapshot_payload_max_utf8_bytes);
            if (configured !== null) {
                this.#maxChunkSnapshotPayloadUtf8Bytes = configured;
            }
        }

        const parts = resolvePositiveIntegerOrNull(config.chunk_snapshot_max_parts);
        if (parts !== null) {
            this.#maxChunkSnapshotParts = parts;
        }
    }

    tick(): void {
        this.#scheduler.tick(this.state, this.#tick++);

        const idsByGroup = this.#buildGroupIndex();
        this.#replicateInterest(idsByGroup);
        this.#replicateChunkSnapshots();
        this.#replicateChunkDeltas();

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

    #replicateChunkSnapshots(): void {
        const outbox = this.state.resources.require(OUTBOX_RESOURCE);
        const overlays = this.state.resources.require(CHUNK_OVERLAY_STORE_RESOURCE);
        const chunkAoi = this.state.resources.require(CHUNK_AOI_STATE_RESOURCE);

        for (const [playerId, sub] of chunkAoi.byPlayerId.entries()) {
            if (!this.#world.isPlayerActive(playerId)) {
                chunkAoi.byPlayerId.delete(playerId);
                continue;
            }

            const pos = this.Position.store.get(playerId);
            if (!pos) {
                continue;
            }
            const center = resolveChunkCoords(overlays.chunkSize, pos.x, pos.y);

            if (sub.lastCenterChunkX !== center.chunkX || sub.lastCenterChunkY !== center.chunkY) {
                sub.lastCenterChunkX = center.chunkX;
                sub.lastCenterChunkY = center.chunkY;
                pruneChunkSubscriptionWindow(sub, center.chunkX, center.chunkY);
                enqueueChunkAoiUpdates(sub, center.chunkX, center.chunkY);
            } else {
                pruneChunkSubscriptionWindow(sub, center.chunkX, center.chunkY);
            }

            let sent = 0;
            while (sent < MAX_CHUNK_SNAPSHOTS_PER_TICK_PER_PLAYER) {
                const inflight = sub.pendingSnapshotParts[0] ?? null;
                if (inflight) {
                    const partIndex = inflight.nextPartIndex;
                    const payloadJson = inflight.parts[partIndex] ?? null;
                    if (payloadJson === null) {
                        sub.pendingSnapshotParts.shift();
                        sub.inFlightSnapshotKeys.delete(inflight.key);
                        continue;
                    }

                    outbox.push({
                        kind: 'to_player',
                        playerId,
                        action: buildChunkSnapshotPartAction(
                            inflight.chunkX,
                            inflight.chunkY,
                            inflight.version,
                            partIndex,
                            inflight.parts.length,
                            payloadJson
                        ),
                    });
                    inflight.nextPartIndex += 1;
                    sent += 1;

                    if (inflight.nextPartIndex >= inflight.parts.length) {
                        sub.pendingSnapshotParts.shift();
                        sub.inFlightSnapshotKeys.delete(inflight.key);
                        sub.knownChunks.add(inflight.key);
                        sub.knownChunkVersions.set(inflight.key, inflight.version);
                    }
                    continue;
                }

                const next = sub.pendingChunks.shift();
                if (!next) {
                    break;
                }
                const key = makeChunkKey(next.chunkX, next.chunkY);
                sub.pendingChunkKeys.delete(key);
                if (sub.knownChunks.has(key) || sub.inFlightSnapshotKeys.has(key)) {
                    continue;
                }

	                this.#world.ensureChunkOverlayLoaded?.(next.chunkX, next.chunkY);
	                const chunk = overlays.getChunk(next.chunkX, next.chunkY);
                const version = chunk?.version ?? 0;
                const overrides = chunk ? extractOverrides(chunk.present, chunk.values, chunk.size) : [];

                const encoded = (() => {
                    try {
                        return encodeChunkSnapshotPayloadJson({
                            chunkSize: overlays.chunkSize,
                            overrides,
                            maxUtf8Bytes: this.#maxChunkSnapshotPayloadUtf8Bytes,
                        });
                    } catch (_) {
                        return null;
                    }
                })();

                if (encoded !== null) {
                    outbox.push({
                        kind: 'to_player',
                        playerId,
                        action: buildChunkSnapshotAction(next.chunkX, next.chunkY, version, encoded),
                    });
                    sub.knownChunks.add(key);
                    sub.knownChunkVersions.set(key, version);
                    sent += 1;
                    continue;
                }

                let parts: string[];
                try {
                    parts = encodeChunkSnapshotPayloadJsonParts({
                        chunkSize: overlays.chunkSize,
                        overrides,
                        maxUtf8Bytes: this.#maxChunkSnapshotPayloadUtf8Bytes,
                    });
                } catch (_) {
                    // Retry later; don't mark known/in-flight.
                    enqueuePendingChunk(sub, next.chunkX, next.chunkY);
                    sent += 1;
                    continue;
                }

                if (parts.length <= 1) {
                    const payloadJson = parts[0] ?? null;
                    if (payloadJson === null) {
                        continue;
                    }
                    outbox.push({
                        kind: 'to_player',
                        playerId,
                        action: buildChunkSnapshotAction(next.chunkX, next.chunkY, version, payloadJson),
                    });
                    sub.knownChunks.add(key);
                    sub.knownChunkVersions.set(key, version);
                    sent += 1;
                    continue;
                }

                const overflowParts = parts.length > this.#maxChunkSnapshotParts;
                const queued = enqueueSnapshotPartStream(sub, {
                    key,
                    chunkX: next.chunkX,
                    chunkY: next.chunkY,
                    version,
                    parts,
                    nextPartIndex: 0,
                });
                if (!queued) {
                    enqueuePendingChunk(sub, next.chunkX, next.chunkY);
                    sent += 1;
                    continue;
                }
                if (overflowParts) {
                    // Deterministic overflow fallback: stream a high-part snapshot instead of indefinitely requeueing.
                    continue;
                }
            }
        }
    }

    #replicateChunkDeltas(): void {
        const outbox = this.state.resources.require(OUTBOX_RESOURCE);
        const overlays = this.state.resources.require(CHUNK_OVERLAY_STORE_RESOURCE);
        const chunkAoi = this.state.resources.require(CHUNK_AOI_STATE_RESOURCE);

        const pending = overlays.listChunksWithPendingDelta();
        for (let i = 0; i < pending.length; i += 1) {
            const chunk = pending[i];
            if (!chunk) {
                continue;
            }
            const key = makeChunkKey(chunk.chunkX, chunk.chunkY);
            const delta = overlays.drainPendingDeltaForChunk(chunk.chunkX, chunk.chunkY);
            if (!delta || delta.changes.length === 0) {
                continue;
            }

            if (delta.changes.length > MAX_CHUNK_DELTA_CHANGES_PER_MESSAGE) {
                const overrides = extractOverrides(chunk.present, chunk.values, chunk.size);
                const encoded = (() => {
                    try {
                        return encodeChunkSnapshotPayloadJson({
                            chunkSize: overlays.chunkSize,
                            overrides,
                            maxUtf8Bytes: this.#maxChunkSnapshotPayloadUtf8Bytes,
                        });
                    } catch (_) {
                        return null;
                    }
                })();

                const parts = (() => {
                    if (encoded !== null) {
                        return null;
                    }
                    try {
                        return encodeChunkSnapshotPayloadJsonParts({
                            chunkSize: overlays.chunkSize,
                            overrides,
                            maxUtf8Bytes: this.#maxChunkSnapshotPayloadUtf8Bytes,
                        });
                    } catch (_) {
                        return null;
                    }
                })();

                for (const [playerId, sub] of chunkAoi.byPlayerId.entries()) {
                    if (!this.#world.isPlayerActive(playerId)) {
                        chunkAoi.byPlayerId.delete(playerId);
                        continue;
                    }
                    if (!sub.knownChunkVersions.has(key)) {
                        continue;
                    }
                    if (encoded !== null) {
                        outbox.push({
                            kind: 'to_player',
                            playerId,
                            action: buildChunkSnapshotAction(chunk.chunkX, chunk.chunkY, chunk.version, encoded),
                        });
                        sub.knownChunkVersions.set(key, chunk.version);
                        continue;
                    }
                    if (!parts || parts.length <= 1) {
                        continue;
                    }
                    // Stream parts via the bounded snapshot path; suppress deltas until fully applied.
                    sub.knownChunkVersions.delete(key);
                    if (!sub.inFlightSnapshotKeys.has(key)) {
                        const overflowParts = parts.length > this.#maxChunkSnapshotParts;
                        const queued = enqueueSnapshotPartStream(sub, {
                            key,
                            chunkX: chunk.chunkX,
                            chunkY: chunk.chunkY,
                            version: chunk.version,
                            parts,
                            nextPartIndex: 0,
                        });
                        if (!queued) {
                            enqueuePendingChunk(sub, chunk.chunkX, chunk.chunkY, { front: true });
                        } else if (overflowParts) {
                            // Deterministic overflow fallback: allow high-part snapshot resync to complete.
                            continue;
                        }
                    }
                }
                continue;
            }

            const payloadJson = encodeChunkDeltaPayloadJson({ chunkSize: overlays.chunkSize, changes: delta.changes });
            for (const [playerId, sub] of chunkAoi.byPlayerId.entries()) {
                if (!this.#world.isPlayerActive(playerId)) {
                    chunkAoi.byPlayerId.delete(playerId);
                    continue;
                }
                const known = sub.knownChunkVersions.get(key);
                if (known === undefined) {
                    continue;
                }
                if (known !== delta.fromVersion) {
                    if (known >= delta.toVersion) {
                        continue;
                    }
                    // Resync contract: stop sending deltas for this chunk until we re-stream a snapshot (bounded by
                    // the snapshot budgeted path).
                    sub.knownChunks.delete(key);
                    sub.knownChunkVersions.delete(key);
                    if (!sub.inFlightSnapshotKeys.has(key)) {
                        enqueuePendingChunk(sub, chunk.chunkX, chunk.chunkY, { front: true });
                    }
                    continue;
                }
                outbox.push({
                    kind: 'to_player',
                    playerId,
                    action: buildChunkDeltaAction(chunk.chunkX, chunk.chunkY, delta.fromVersion, delta.toVersion, payloadJson),
                });
                sub.knownChunkVersions.set(key, delta.toVersion);
            }
        }
    }
}

function resolveChunkCoords(chunkSize: number, x: number, y: number): { chunkX: number; chunkY: number } {
    const chunkX = Math.floor(x / chunkSize);
    const chunkY = Math.floor(y / chunkSize);
    return { chunkX, chunkY };
}

function decodeChunkCoordFromKeyPart(value: bigint): number {
    const raw = Number(value & 0xffff_ffffn);
    return raw >= 0x8000_0000 ? raw - 0x1_0000_0000 : raw;
}

function decodeChunkKey(key: bigint): { chunkX: number; chunkY: number } {
    const chunkX = decodeChunkCoordFromKeyPart(key >> 32n);
    const chunkY = decodeChunkCoordFromKeyPart(key);
    return { chunkX, chunkY };
}

function isChunkInAoiWindow(
    chunkX: number,
    chunkY: number,
    centerChunkX: number | null,
    centerChunkY: number | null,
    radius: number
): boolean {
    if (centerChunkX === null || centerChunkY === null) {
        return true;
    }
    return Math.abs(chunkX - centerChunkX) <= radius && Math.abs(chunkY - centerChunkY) <= radius;
}

function enforcePendingChunkQueueBounds(sub: ChunkSubscription): void {
    while (sub.pendingChunks.length > MAX_PENDING_CHUNKS_PER_PLAYER) {
        const dropped = sub.pendingChunks.pop();
        if (!dropped) {
            break;
        }
        sub.pendingChunkKeys.delete(makeChunkKey(dropped.chunkX, dropped.chunkY));
    }
}

function enforcePendingSnapshotStreamBounds(sub: ChunkSubscription): void {
    const kept: ChunkSubscription['pendingSnapshotParts'] = [];
    const keys = new Set<bigint>();
    let totalParts = 0;

    for (let i = 0; i < sub.pendingSnapshotParts.length; i += 1) {
        const stream = sub.pendingSnapshotParts[i];
        if (!stream) {
            continue;
        }

        if (
            !isChunkInAoiWindow(stream.chunkX, stream.chunkY, sub.lastCenterChunkX, sub.lastCenterChunkY, sub.radius)
            || keys.has(stream.key)
            || kept.length >= MAX_PENDING_SNAPSHOT_STREAMS_PER_PLAYER
            || totalParts + stream.parts.length > MAX_PENDING_SNAPSHOT_PARTS_PER_PLAYER
        ) {
            continue;
        }

        kept.push(stream);
        keys.add(stream.key);
        totalParts += stream.parts.length;
    }

    sub.pendingSnapshotParts = kept;
    sub.inFlightSnapshotKeys.clear();
    keys.forEach((key) => sub.inFlightSnapshotKeys.add(key));
}

function enqueueSnapshotPartStream(
    sub: ChunkSubscription,
    stream: ChunkSubscription['pendingSnapshotParts'][number]
): boolean {
    if (sub.inFlightSnapshotKeys.has(stream.key)) {
        return false;
    }
    sub.pendingSnapshotParts.push(stream);
    sub.inFlightSnapshotKeys.add(stream.key);
    enforcePendingSnapshotStreamBounds(sub);
    return sub.inFlightSnapshotKeys.has(stream.key);
}

function pruneChunkSubscriptionWindow(sub: ChunkSubscription, centerChunkX: number, centerChunkY: number): void {
    for (const key of sub.knownChunks) {
        const coords = decodeChunkKey(key);
        if (!isChunkInAoiWindow(coords.chunkX, coords.chunkY, centerChunkX, centerChunkY, sub.radius)) {
            sub.knownChunks.delete(key);
            sub.knownChunkVersions.delete(key);
        }
    }

    for (const [key] of sub.knownChunkVersions.entries()) {
        const coords = decodeChunkKey(key);
        if (!isChunkInAoiWindow(coords.chunkX, coords.chunkY, centerChunkX, centerChunkY, sub.radius)) {
            sub.knownChunkVersions.delete(key);
            sub.knownChunks.delete(key);
        }
    }

    const pending: ChunkSubscription['pendingChunks'] = [];
    const keys = new Set<bigint>();
    for (let i = 0; i < sub.pendingChunks.length; i += 1) {
        const next = sub.pendingChunks[i];
        if (!next) {
            continue;
        }
        if (!isChunkInAoiWindow(next.chunkX, next.chunkY, centerChunkX, centerChunkY, sub.radius)) {
            continue;
        }
        const key = makeChunkKey(next.chunkX, next.chunkY);
        if (keys.has(key) || sub.knownChunks.has(key) || sub.inFlightSnapshotKeys.has(key)) {
            continue;
        }
        pending.push(next);
        keys.add(key);
        if (pending.length >= MAX_PENDING_CHUNKS_PER_PLAYER) {
            break;
        }
    }
    sub.pendingChunks = pending;
    sub.pendingChunkKeys.clear();
    keys.forEach((key) => sub.pendingChunkKeys.add(key));

    enforcePendingChunkQueueBounds(sub);
    enforcePendingSnapshotStreamBounds(sub);
}

function enqueuePendingChunk(
    sub: ChunkSubscription,
    chunkX: number,
    chunkY: number,
    options?: { front?: boolean }
): boolean {
    if (!isChunkInAoiWindow(chunkX, chunkY, sub.lastCenterChunkX, sub.lastCenterChunkY, sub.radius)) {
        return false;
    }

    const key = makeChunkKey(chunkX, chunkY);
    if (sub.knownChunks.has(key) || sub.inFlightSnapshotKeys.has(key) || sub.pendingChunkKeys.has(key)) {
        return false;
    }

    if (options?.front === true) {
        sub.pendingChunks.unshift({ chunkX, chunkY });
    } else {
        sub.pendingChunks.push({ chunkX, chunkY });
    }
    sub.pendingChunkKeys.add(key);
    enforcePendingChunkQueueBounds(sub);
    return sub.pendingChunkKeys.has(key);
}

function enqueueChunkAoiUpdates(sub: ChunkSubscription, centerChunkX: number, centerChunkY: number): void {
    const radius = sub.radius;
    for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
            enqueuePendingChunk(sub, centerChunkX + dx, centerChunkY + dy);
        }
    }
}

function extractOverrides(present: Uint8Array, values: Uint32Array, size: number): Array<[number, number, number]> {
    const overrides: Array<[number, number, number]> = [];
    const cellCount = size * size;
    for (let i = 0; i < cellCount; i += 1) {
        if (!present[i]) {
            continue;
        }
        const localX = i % size;
        const localY = Math.floor(i / size);
        overrides.push([localX, localY, values[i]!]);
    }
    return overrides;
}
