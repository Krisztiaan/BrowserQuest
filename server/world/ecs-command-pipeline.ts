import { entityIdFromWire, type EntityId } from '../../shared/domain/ids';
import { gridPos, type GridPos } from '../../shared/domain/positions';
import { isEntityWithinAttackRange } from '../../shared/combat/engagement';
import { runServerAuthoritativeCombatSystem } from './ecs-command-pipeline/combat-engagements';
import { SUBPIXELS, TILE_SUBPX, tileToWorldPosCenter, worldPosToTile } from '../../shared/world/worldpos';
import {
    clampWorldPosInsideMap,
    resolveSubTileMotionAgainstTiles,
    worldPosOverlapsBlockedTiles,
} from '../../shared/world/collision/tile-collision';
import {
    MOVE_STEP_REJECT_NON_ADJACENT,
    isAdjacentStep,
    resolveMoveBaseline,
    validateMoveStepIntent,
} from '../../shared/world/movement-intents';
import { requireMobPrefab } from '../../shared/content/prefabs';
import { WorldState } from '../ecs/world-state';
import type { Command } from '../ecs/commands';
import type { DomainEvent } from '../ecs/events';
import { Scheduler, type SchedulerStage, type System, type SystemContext } from '../ecs/scheduler';
import { OUTBOX_RESOURCE } from '../ecs/outbox';
import { Queue } from '../ecs/queues';
import { flushDomainEventsToOutboxSystem } from '../ecs/outbox-systems';
import { createDeriveGridPositionFromWorldPosSystem } from '../ecs/position-systems';
import type { ComponentType } from '../ecs/component-registry';
import { SparseSetStore } from '../ecs/component-store';
import { InterestTracker } from '../ecs/interest-tracker';
import { INTEREST_TRACKER_RESOURCE } from '../ecs/spatial-resources';
import { registerCombatComponents } from '../ecs/combat-components';
import Utils from '../utils';
import Formulas from '../formulas';
import Types from '../../shared/gametypes-browser';
import type { EntityKind } from '../../shared/entity-kind-domain';
import {
    buildAchievementsAction,
    buildAckAction,
    buildBlinkAction,
    buildChatAction,
    buildDestroyAction,
    buildEquipAction,
    buildHpAction,
    buildLootMoveAction,
    buildMoveAction,
    buildMoveSyncAction,
    buildEntityStateBatchAction,
    buildCorrectionMoveAction,
    buildOutcomeAction,
    buildRejectAction,
    buildTeleportAction,
    buildWelcomeAction,
} from '../protocol/outbound-actions';
import type { ServerToClientSpawnAction } from '../../shared/protocol/types';
import type { WorldMessage } from './contracts';
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
import type { GameModuleRegistry } from '../../shared/modules/module-registry';
import { encodeProtocolCapabilitiesJson, PROTOCOL_REVISION } from '../../shared/protocol/capabilities';
import { createIntentSeqState, INTENT_SEQ_STATE_RESOURCE } from '../ecs/intent-seq';
import { createResourceKey } from '../ecs/resources';
import { ChunkOverlayStore } from './chunks/chunk-overlay-store';
import { createChunkAoiState, CHUNK_AOI_STATE_RESOURCE, type ChunkSubscription } from './chunks/chunk-aoi';
import { ClaimsStore, type RectClaim } from './claims/claims-store';
import { CLAIMS_STORE_RESOURCE } from './claims/claims-resource';
import type { ServerConfig } from '../runtime-types';
import { normalizeIdentityKey, resolveIdentityKey } from '../identity';
import Log from '../log';
import {
    decodeClaimCreateIntentPayload,
    decodeClaimDeleteIntentPayload,
    decodeClaimUpdateIntentPayload,
    decodeAttackIntentPayload,
    decodeDoorTeleportIntentPayload,
    decodeMoveInputIntentPayload,
    decodeMoveToIntentPayload,
    decodeMoveStepIntentPayload,
    decodeTileEditIntentPayload,
    encodeMapTransitionOutcomePayload,
    MOVE_INPUT_KEY_A,
    MOVE_INPUT_KEY_D,
    MOVE_INPUT_KEY_S,
    MOVE_INPUT_KEY_W,
    OUTCOME_MAP_TRANSITION_BEGIN,
    OUTCOME_MAP_TRANSITION_COMMIT,
} from '../../shared/protocol/intents';
import {
    classifyIntentSeq,
    formatIntentSeqRejectReason,
    INTENT_SEQ_DEFAULT_MAX_GAP,
    INTENT_SEQ_INITIAL_LAST_ACCEPTED,
} from '../../shared/protocol/intent-seq';
import {
    enqueueChunkAoiUpdates,
    replicateChunkDeltas,
    replicateChunkSnapshots,
} from './ecs-command-pipeline/chunk-aoi-streaming';
import {
    broadcastNearbyOutboxMessage,
    mapScopedGroupKey,
    replicateInterestVisibility,
} from './ecs-command-pipeline/interest-replication';
import {
    createCoreServerModuleRegistry,
    INTENT_ATTACK,
    INTENT_CLAIM_CREATE,
    INTENT_CLAIM_DELETE,
    INTENT_CLAIM_UPDATE,
    INTENT_DOOR_TELEPORT,
    INTENT_MOVE_INPUT,
    INTENT_MOVE_TO,
    INTENT_MOVE_STEP,
    INTENT_TILE_EDIT,
    OUTCOME_DOOR_TELEPORT,
    type InboundIntentContext,
    type IntentWorldHost,
} from './ecs-command-pipeline/core-module-registry';
import { resolveServerMovementNetcodeConfig } from '../movement-netcode-config';
import { applyMoveToIntentCommand as applyMoveToIntentCommandImpl } from './intents/move-to-intent';
import type { MapTransitionEvent } from './map-transition-observability';
import {
    emitMapTransitionEvent,
    isValidPositionInMap,
    resolveDefaultMapId,
    resolveDoorTeleportDestination,
    resolveEntityMapId,
    resolveMapForId,
} from './ecs-command-pipeline/map-runtime';
import {
    DEFAULT_MAX_CHUNK_SNAPSHOT_PARTS,
    resolveMaxChunkSnapshotPayloadUtf8BytesFromEnv,
    resolveMaxInboundCommandQueueFromEnv,
    resolvePositiveIntegerOrNull,
} from './ecs-command-pipeline/pipeline-config';

type DoorTeleportOutcome = Readonly<{ playerId: EntityId; fromMapId: string; toMapId: string; to: GridPos }>;
type DroppedItem = Readonly<{ id: EntityId; kind: EntityKind }>;
type DroppedMob = Readonly<{ kind: EntityKind; x: number; y: number }>;
type JsonScalar = string | number | boolean | null;
type JsonLike = JsonScalar | JsonLike[] | { [key: string]: JsonLike };

export const CHUNK_OVERLAY_STORE_RESOURCE = createResourceKey<ChunkOverlayStore>('chunk_overlay_store');
export const MOVE_SYNC_STATE_RESOURCE = createResourceKey<Map<EntityId, number>>('move_sync_state');
export const PLAYER_RECENT_POSITION_HISTORY_RESOURCE = createResourceKey<
    Map<EntityId, Array<{ pos: GridPos; tick: number }>>
>('player_recent_position_history');
export const ENTITY_STATE_BATCH_RESOURCE =
    createResourceKey<Map<string, Map<EntityId, { x: number; y: number; flags: number }>>>('entity_state_batch');

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

function toKnownEntityKind(value: number): EntityKind | null {
    const candidate = value as EntityKind;
    if (Types.getKindAsString(candidate) === undefined) {
        return null;
    }
    return candidate;
}

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

const DEFAULT_CHUNK_SIZE = 32;
const MAX_CHUNK_SNAPSHOTS_PER_TICK_PER_PLAYER = 8;
const MAX_CHUNK_DELTA_CHANGES_PER_MESSAGE = 256;
const log = Log.getLogger();

export function resolvePlayerIdentityKey(
    player: { accountNameKey?: string; name?: string } | null | undefined
): string | null {
    return resolveIdentityKey(player);
}

function isAdjacentNonDiagonal(a: GridPos, b: GridPos): boolean {
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    return dx + dy === 1;
}

function isWithinInteractionDistance(a: GridPos, b: GridPos, maxAxisDistance: number): boolean {
    return Math.abs(a.x - b.x) <= maxAxisDistance && Math.abs(a.y - b.y) <= maxAxisDistance;
}

function recordRecentPlayerPosition({
    state,
    playerId,
    pos,
    tick,
}: {
    state: WorldState<Command, DomainEvent>;
    playerId: EntityId;
    pos: GridPos;
    tick: number;
}): void {
    const config = resolveServerMovementNetcodeConfig();
    const historyByPlayer = state.resources.require(PLAYER_RECENT_POSITION_HISTORY_RESOURCE);
    const history = historyByPlayer.get(playerId) ?? [];
    const last = history[history.length - 1];
    if (last?.pos.x === pos.x && last.pos.y === pos.y) {
        last.tick = tick;
        historyByPlayer.set(playerId, history);
        return;
    }

    history.push({ pos: gridPos(pos.x, pos.y), tick });
    if (history.length > config.tuning.interactionGraceHistoryLimit) {
        history.splice(0, history.length - config.tuning.interactionGraceHistoryLimit);
    }
    historyByPlayer.set(playerId, history);
}

function getRecentPlayerPositionsWithinGrace({
    state,
    playerId,
    currentTick,
    maxAgeTicks,
}: {
    state: WorldState<Command, DomainEvent>;
    playerId: EntityId;
    currentTick: number;
    maxAgeTicks?: number;
}): GridPos[] {
    const config = resolveServerMovementNetcodeConfig();
    const history = state.resources.require(PLAYER_RECENT_POSITION_HISTORY_RESOURCE).get(playerId) ?? [];
    const recent: GridPos[] = [];
    for (let i = history.length - 1; i >= 0; i -= 1) {
        const entry = history[i];
        if (!entry) {
            continue;
        }
        if (currentTick - entry.tick > Math.max(0, maxAgeTicks ?? config.tuning.interactionGraceMaxAgeTicks)) {
            break;
        }
        recent.push(entry.pos);
    }
    return recent;
}

function isPlayerWithinInteractionGrace({
    state,
    playerId,
    targetPos,
    currentTick,
    maxAxisDistance,
}: {
    state: WorldState<Command, DomainEvent>;
    playerId: EntityId;
    targetPos: GridPos;
    currentTick: number;
    maxAxisDistance: number;
}): boolean {
    if (!resolveServerMovementNetcodeConfig().rollout.serverInteractionGrace) {
        return false;
    }
    const recentPositions = getRecentPlayerPositionsWithinGrace({ state, playerId, currentTick });
    return recentPositions.some((pos) => isWithinInteractionDistance(pos, targetPos, maxAxisDistance));
}

export function isPlayerInAttackRangeWithGrace({
    state,
    attackerId,
    targetPos,
    attackerKind,
    attackerWeaponKind,
    currentTick,
}: {
    state: WorldState<Command, DomainEvent>;
    attackerId: EntityId;
    targetPos: GridPos;
    attackerKind: EntityKind;
    attackerWeaponKind: EntityKind | undefined;
    currentTick: number;
}): boolean {
    if (!resolveServerMovementNetcodeConfig().rollout.serverInteractionGrace) {
        return false;
    }
    const recentPositions = getRecentPlayerPositionsWithinGrace({ state, playerId: attackerId, currentTick });
    return recentPositions.some((attackerPos) =>
        isEntityWithinAttackRange({
            attackerPos,
            targetPos,
            attackerKind,
            attackerWeaponKind,
        })
    );
}

export function isEntityVisibleToPlayer({
    world,
    playerPos,
    playerMapId,
    entityPos,
    entityMapId,
}: {
    world: WorldCommandHost;
    playerPos: GridPos;
    playerMapId: string;
    entityPos: GridPos;
    entityMapId: string;
}): boolean {
    if (playerMapId !== entityMapId) {
        return false;
    }
    const map = resolveMapForId({ world, mapId: playerMapId });
    if (!map) {
        return false;
    }
    const playerGroupId = map.getGroupIdFromPosition(playerPos.x, playerPos.y);
    const entityGroupId = map.getGroupIdFromPosition(entityPos.x, entityPos.y);
    let visible = false;
    map.forEachAdjacentGroup(playerGroupId, (groupId) => {
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

export function addMobHate({
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

export function clearPlayerFromMobAggro({
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
    MapId,
    PositionSub,
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
    MapId: ComponentType<string>;
    PositionSub: ReturnType<typeof registerSpawnReplicationComponents>['PositionSub'];
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
    const resolvedAccountNameKey =
        resolveIdentityKey({
            accountNameKey: cmd.profile?.accountNameKey ?? cmd.profile?.nameKey ?? cmd.name,
            name: resolvedName,
        }) ?? normalizeIdentityKey(resolvedName);
    const resolvedArmorKind = cmd.profile?.armorKind ?? cmd.armorKind;
    const resolvedWeaponKind = cmd.profile?.weaponKind ?? cmd.weaponKind;
    const emptyUnlockedIds: number[] = [];
    const baseAchievements = cmd.profile?.achievements ?? {
        unlockedIds: emptyUnlockedIds,
        ratCount: 0,
        skeletonCount: 0,
        totalKills: 0,
        totalDmg: 0,
        totalRevives: 0,
    };

    if (typeof cmd.profile?.checkpointId === 'number' && Number.isFinite(cmd.profile.checkpointId)) {
        const checkpoint = world.map.getCheckpoint(cmd.profile.checkpointId);
        if (checkpoint) {
            player.lastCheckpoint = checkpoint;
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
    const mapId = resolveEntityMapId({ MapId, entityId: player.id, world });
    state.world.addComponent(player.id, Kind, player.kind);
    state.world.addComponent(player.id, MapId, mapId);
    state.world.addComponent(player.id, Position, gridPos(player.x, player.y));
    state.world.addComponent(player.id, PositionSub, tileToWorldPosCenter(player.x, player.y));
    state.world.addComponent(player.id, Name, player.name);
    state.world.addComponent(player.id, Orientation, player.orientation);
    state.world.addComponent(player.id, Armor, player.armor);
    state.world.addComponent(player.id, Weapon, player.weapon);
    state.world.removeComponent(player.id, Target);
    state.world.addComponent(player.id, combat.HitPoints, hitPoints);
    state.world.addComponent(player.id, combat.MaxHitPoints, maxHitPoints);
    state.world.addComponent(player.id, combat.ArmorLevel, player.armorLevel);
    state.world.addComponent(player.id, combat.WeaponLevel, player.weaponLevel);
    recordRecentPlayerPosition({ state, playerId: player.id, pos: gridPos(player.x, player.y), tick: 0 });

    world.addPlayer(player);

    const shouldSendCapabilities = typeof cmd.protocolRevision === 'number';
    const protocolOutcomeTypeIds = Array.from(
        new Set<string>([
            ...modules.outcomeHandlers.keys(),
            OUTCOME_MAP_TRANSITION_BEGIN,
            OUTCOME_MAP_TRANSITION_COMMIT,
        ])
    );
    const serverCapabilitiesJson = shouldSendCapabilities
        ? encodeProtocolCapabilitiesJson({
              moduleIds: [...modules.moduleOrder],
              intentTypeIds: [...modules.intentHandlers.keys()],
              outcomeTypeIds: protocolOutcomeTypeIds,
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
    world.pushToPlayerId(
        player.id,
        buildAchievementsAction({
            unlockedIds: baseAchievements.unlockedIds,
            ratCount: baseAchievements.ratCount,
            skeletonCount: baseAchievements.skeletonCount,
            totalKills: baseAchievements.totalKills,
            totalDmg: baseAchievements.totalDmg,
            totalRevives: wasDead ? Math.min(5, baseAchievements.totalRevives + 1) : baseAchievements.totalRevives,
        })
    );
    world.persistPlayerEquipment(player);
    world.emitPlayerEnter(player);
    player.hasEnteredGame = true;
    player.isDead = false;
}

function applyMoveIntentCommand({
    state,
    Position,
    MapId,
    player,
    movement,
    world,
    cmd,
}: {
    state: WorldState<Command, DomainEvent>;
    Position: ComponentType<GridPos>;
    MapId: ComponentType<string>;
    player: PlayerLike;
    movement: ReturnType<typeof registerMovementComponents>;
    world: IntentWorldHost;
    cmd: Extract<Command, { type: 'MOVE' }>;
}): { ok: false; reason: string } | void {
    const config = resolveServerMovementNetcodeConfig();
    const { MoveQueue } = movement;
    const existing = MoveQueue.store.get(player.id)?.entries ?? [];
    if (existing.some((entry) => entry.x === cmd.to.x && entry.y === cmd.to.y)) {
        return;
    }
    const lastQueued = existing.length > 0 ? existing[existing.length - 1] : null;
    if (lastQueued && lastQueued.x === cmd.to.x && lastQueued.y === cmd.to.y) {
        return;
    }

    const currentPos = Position.store.get(player.id);
    if (!currentPos) {
        return;
    }
    const baseline = resolveMoveBaseline(currentPos, existing);
    const playerMapId = resolveEntityMapId({ MapId, entityId: player.id, world });
    const validation = validateMoveStepIntent({
        baseline,
        to: cmd.to,
        existingQueueLength: existing.length,
        isValidPosition: (x, y) => isValidPositionInMap({ world, mapId: playerMapId, x, y }),
    });
    if (!validation.ok) {
        if (config.rollout.serverMoveStepGrace && validation.reason === MOVE_STEP_REJECT_NON_ADJACENT) {
            const adjacentToCurrent = isAdjacentStep(currentPos, cmd.to);
            const currentTileRepeated = currentPos.x === cmd.to.x && currentPos.y === cmd.to.y;
            const isValidRequestedTile = isValidPositionInMap({ world, mapId: playerMapId, x: cmd.to.x, y: cmd.to.y });
            if ((adjacentToCurrent || currentTileRepeated) && isValidRequestedTile) {
                if (currentTileRepeated) {
                    log.event('info', 'movement.move_step_idempotent', {
                        playerId: player.id,
                        profile: config.profileId,
                        requestedPos: { x: cmd.to.x, y: cmd.to.y },
                    });
                    return;
                }
                log.event('info', 'movement.move_step_grace_accepted', {
                    playerId: player.id,
                    profile: config.profileId,
                    baseline: { x: baseline.x, y: baseline.y },
                    currentPos: { x: currentPos.x, y: currentPos.y },
                    requestedPos: { x: cmd.to.x, y: cmd.to.y },
                    queuedEntries: existing.length,
                });
                state.world.addComponent(player.id, MoveQueue, { entries: [cmd.to] });
                return;
            }
            // Client got ahead or desynced; clear queued intents and force correction.
            log.event('warn', 'movement.move_step_grace_rejected', {
                playerId: player.id,
                profile: config.profileId,
                baseline: { x: baseline.x, y: baseline.y },
                currentPos: { x: currentPos.x, y: currentPos.y },
                requestedPos: { x: cmd.to.x, y: cmd.to.y },
                queuedEntries: existing.length,
                isValidRequestedTile,
                adjacentToCurrent,
                currentTileRepeated,
            });
            state.world.removeComponent(player.id, MoveQueue);
        }
        return validation;
    }
    state.world.addComponent(player.id, MoveQueue, { entries: [...existing, cmd.to] });
}

function applyMoveInputIntentCommand({
    state,
    player,
    movement,
    cmd,
}: {
    state: WorldState<Command, DomainEvent>;
    player: PlayerLike;
    movement: ReturnType<typeof registerMovementComponents>;
    cmd: Extract<Command, { type: 'MOVE_INPUT' }>;
}): void {
    const { MoveInput, MoveQueue } = movement;
    const prev = MoveInput.store.get(player.id) ?? { keysMask: 0, recentKeys: [] };
    const nextMask = cmd.keysMask >>> 0;

    if (nextMask === 0) {
        // Key state went idle: stop any held-key motion and clear prior click-to-move queue.
        state.world.removeComponent(player.id, MoveInput);
        state.world.removeComponent(player.id, MoveQueue);
        return;
    }

    const newlyPressed = nextMask & ~prev.keysMask;
    let nextRecent = prev.recentKeys.slice();
    const pushKey = (bit: number) => {
        const idx = nextRecent.indexOf(bit);
        if (idx >= 0) {
            nextRecent.splice(idx, 1);
        }
        nextRecent.push(bit);
    };
    // Deterministic ordering for multi-bit transitions (rare, but keep stable).
    if (newlyPressed & MOVE_INPUT_KEY_W) pushKey(MOVE_INPUT_KEY_W);
    if (newlyPressed & MOVE_INPUT_KEY_A) pushKey(MOVE_INPUT_KEY_A);
    if (newlyPressed & MOVE_INPUT_KEY_S) pushKey(MOVE_INPUT_KEY_S);
    if (newlyPressed & MOVE_INPUT_KEY_D) pushKey(MOVE_INPUT_KEY_D);
    if (nextRecent.length > 4) {
        nextRecent = nextRecent.slice(nextRecent.length - 4);
    }

    // `move.input` overrides any previous click-to-move queue (authoritative held-key control).
    state.world.removeComponent(player.id, MoveQueue);
    state.world.addComponent(player.id, MoveInput, { keysMask: nextMask, recentKeys: nextRecent });
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
    ctx,
    mobAi,
    replication,
    Target,
    cmd,
}: {
    state: WorldState<Command, DomainEvent>;
    ctx: SystemContext;
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
        currentTick: ctx.tick,
    });
}

function applyAttackIntent({
    state,
    mobAi,
    replication,
    Target,
    attackerId,
    targetId,
    currentTick,
}: {
    state: WorldState<Command, DomainEvent>;
    mobAi: ReturnType<typeof registerMobAiComponents>;
    replication: ReturnType<typeof registerSpawnReplicationComponents>;
    Target: ComponentType<EntityId>;
    attackerId: EntityId;
    targetId: EntityId;
    currentTick: number;
}): void {
    const config = resolveServerMovementNetcodeConfig();
    const targetKind = replication.Kind.store.get(targetId);
    if (targetKind === undefined) {
        log.event('warn', 'combat.attack_intent_missing_target', { attackerId, targetId });
        return;
    }
    if (!Types.isMob(targetKind)) {
        log.event('warn', 'combat.attack_intent_invalid_target_kind', { attackerId, targetId, targetKind });
        return;
    }
    const attackerPos = state.world.getComponent(attackerId, replication.Position);
    const targetPos = state.world.getComponent(targetId, replication.Position);
    const attackerKind = replication.Kind.store.get(attackerId);
    const attackerWeaponKind = state.world.getComponent(attackerId, replication.Weapon);
    const inRangeAtAccept =
        attackerPos !== undefined &&
        targetPos !== undefined &&
        attackerKind !== undefined &&
        isEntityWithinAttackRange({
            attackerPos,
            targetPos,
            attackerKind,
            attackerWeaponKind,
        });
    const inRangeWithGraceAtAccept =
        attackerKind !== undefined &&
        targetPos !== undefined &&
        isPlayerInAttackRangeWithGrace({
            state,
            attackerId,
            targetPos,
            attackerKind,
            attackerWeaponKind,
            currentTick,
        });
    state.world.addComponent(attackerId, Target, targetId);
    log.event('info', 'combat.attack_intent_accepted', {
        attackerId,
        targetId,
        targetKind,
        profile: config.profileId,
        attackerPos: attackerPos ? { x: attackerPos.x, y: attackerPos.y } : null,
        targetPos: targetPos ? { x: targetPos.x, y: targetPos.y } : null,
        inRangeAtAccept,
        inRangeWithGraceAtAccept,
    });

    addMobHate({
        state,
        mobAi,
        replication,
        mobId: targetId,
        playerId: attackerId,
        hatePoints: 5,
    });
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

function applyLootCommand({
    state,
    ctx,
    combat,
    replication,
    effects,
    items,
    Position,
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
    Position: ComponentType<GridPos>;
    world: WorldCommandHost;
    player: PlayerLike;
    cmd: Extract<Command, { type: 'LOOT' }>;
}): void {
    const droppedItemId = cmd.droppedItemId;
    const droppedKind = replication.Kind.store.get(droppedItemId);
    if (droppedKind === undefined || !Types.isItem(droppedKind) || !state.world.entities.isAlive(droppedItemId)) {
        return;
    }
    const playerPos = Position.store.get(player.id);
    const itemPos = Position.store.get(droppedItemId);
    if (!playerPos || !itemPos) {
        return;
    }
    const canLoot =
        isWithinInteractionDistance(playerPos, itemPos, 1) ||
        isPlayerWithinInteractionGrace({
            state,
            playerId: player.id,
            targetPos: itemPos,
            currentTick: ctx.tick,
            maxAxisDistance: 1,
        });
    if (!canLoot) {
        return;
    }
    if (!isWithinInteractionDistance(playerPos, itemPos, 1)) {
        log.event('info', 'interaction.loot_grace_accepted', {
            playerId: player.id,
            profile: resolveServerMovementNetcodeConfig().profileId,
            playerPos: { x: playerPos.x, y: playerPos.y },
            itemPos: { x: itemPos.x, y: itemPos.y },
            tick: ctx.tick,
        });
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

function applyTeleportOutcome({
    state,
    ctx,
    Position,
    MapId,
    PositionSub,
    Target,
    mobAi,
    movement,
    replication,
    world,
    playerId,
    fromMapId,
    toMapId,
    to,
}: {
    state: WorldState<Command, DomainEvent>;
    ctx: SystemContext;
    Position: ComponentType<GridPos>;
    MapId: ComponentType<string>;
    PositionSub: ReturnType<typeof registerSpawnReplicationComponents>['PositionSub'];
    Target: ComponentType<EntityId>;
    mobAi: ReturnType<typeof registerMobAiComponents>;
    movement: ReturnType<typeof registerMovementComponents>;
    replication: ReturnType<typeof registerSpawnReplicationComponents>;
    world: WorldCommandHost;
    playerId: EntityId;
    fromMapId: string;
    toMapId: string;
    to: GridPos;
}): void {
    const transitionPayload = encodeMapTransitionOutcomePayload({
        fromMapId,
        toMapId,
        x: to.x,
        y: to.y,
    });
    if (!transitionPayload) {
        emitMapTransitionEvent({
            world,
            event: {
                kind: 'reject',
                reason: 'invalid_transition_payload',
                playerId,
                fromMapId,
                toMapId,
                toX: to.x,
                toY: to.y,
            },
        });
        return;
    }
    emitMapTransitionEvent({
        world,
        event: {
            kind: 'begin',
            playerId,
            fromMapId,
            toMapId,
            toX: to.x,
            toY: to.y,
        },
    });
    state.world.addComponent(playerId, MapId, toMapId);
    state.world.addComponent(playerId, Position, to);
    const toSub = tileToWorldPosCenter(to.x, to.y);
    state.world.addComponent(playerId, PositionSub, toSub);
    state.world.removeComponent(playerId, Target);
    recordRecentPlayerPosition({ state, playerId, pos: to, tick: ctx.tick });

    const teleport = buildTeleportAction(playerId, to.x, to.y, toMapId);
    const outbox = state.resources.require(OUTBOX_RESOURCE);
    const seqState = state.resources.require(INTENT_SEQ_STATE_RESOURCE);
    const moveSyncState = state.resources.require(MOVE_SYNC_STATE_RESOURCE);
    const ackSeq = seqState.lastAcceptedByPlayerId.get(playerId) ?? INTENT_SEQ_INITIAL_LAST_ACCEPTED;
    outbox.push({
        kind: 'to_player',
        playerId,
        action: buildOutcomeAction(ackSeq, OUTCOME_MAP_TRANSITION_BEGIN, transitionPayload),
    });
    // Teleports are authoritative corrections; stop predicting until the next input.
    const moveSync = buildMoveSyncAction(ackSeq, toSub.x, toSub.y, ctx.tick, 1, toMapId);
    moveSyncState.set(playerId, ctx.tick);
    outbox.push({ kind: 'to_player', playerId, action: teleport });
    outbox.push({ kind: 'to_player', playerId, action: moveSync });
    outbox.push({
        kind: 'to_player',
        playerId,
        action: buildOutcomeAction(ackSeq, OUTCOME_MAP_TRANSITION_COMMIT, transitionPayload),
    });
    emitMapTransitionEvent({
        world,
        event: {
            kind: 'commit',
            playerId,
            fromMapId,
            toMapId,
            toX: to.x,
            toY: to.y,
        },
    });
    outbox.push({ kind: 'broadcast_nearby', actorId: playerId, ignoredPlayerId: playerId, action: teleport });

    state.world.removeComponent(playerId, movement.MoveQueue);
    state.world.removeComponent(playerId, movement.NextMoveTick);
    clearPlayerFromMobAggro({ state, mobAi, replication, world, playerId, tickNow: ctx.tick });
}

function applyOpenCommand({
    state,
    ctx,
    Kind,
    Position,
    ChestLootTable,
    world,
    player,
    cmd,
}: {
    state: WorldState<Command, DomainEvent>;
    ctx: SystemContext;
    Kind: ComponentType<EntityKind>;
    Position: ComponentType<GridPos>;
    ChestLootTable: ComponentType<{ items: ReadonlyArray<EntityKind> }>;
    world: WorldCommandHost;
    player: PlayerLike;
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
    const playerPos = Position.store.get(player.id);
    if (!playerPos) {
        return;
    }
    const canOpen =
        isWithinInteractionDistance(playerPos, pos, 1) ||
        isPlayerWithinInteractionGrace({
            state,
            playerId: player.id,
            targetPos: pos,
            currentTick: ctx.tick,
            maxAxisDistance: 1,
        });
    if (!canOpen) {
        return;
    }
    if (!isWithinInteractionDistance(playerPos, pos, 1)) {
        log.event('info', 'interaction.open_grace_accepted', {
            playerId: player.id,
            profile: resolveServerMovementNetcodeConfig().profileId,
            playerPos: { x: playerPos.x, y: playerPos.y },
            chestPos: { x: pos.x, y: pos.y },
            tick: ctx.tick,
        });
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

function applyCheckCommand({
    world,
    MapId,
    player,
    cmd,
}: {
    world: WorldCommandHost;
    MapId: ComponentType<string>;
    player: PlayerLike;
    cmd: Extract<Command, { type: 'CHECK' }>;
}): void {
    const mapId = resolveEntityMapId({ MapId, entityId: player.id, world });
    const map = resolveMapForId({ world, mapId });
    const checkpoint = map?.getCheckpoint(cmd.checkpointId);
    if (checkpoint) {
        player.lastCheckpoint = checkpoint;
        world.persistPlayerCheckpoint(resolvePlayerIdentityKey(player) ?? player.name, cmd.checkpointId);
    }
}

function applyChatCommand(
    state: WorldState<Command, DomainEvent>,
    playerId: EntityId,
    cmd: Extract<Command, { type: 'CHAT' }>
): void {
    if (cmd.message && cmd.message !== '') {
        const outbox = state.resources.require(OUTBOX_RESOURCE);
        outbox.push({ kind: 'broadcast_nearby', actorId: playerId, action: buildChatAction(playerId, cmd.message) });
    }
}

function createApplyInboundCommandsSystem(
    world: WorldCommandHost,
    Position: ComponentType<GridPos>,
    MapId: ComponentType<string>,
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
            try {
                if (cmd.type === 'HELLO') {
                    const player = world.getConnectionPlayerById(cmd.source.playerId);
                    if (!player) {
                        continue;
                    }
                    applyHello({
                        state,
                        Position,
                        MapId,
                        PositionSub: replication.PositionSub,
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
                    MapId,
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
                        const lastAccepted =
                            seqState.lastAcceptedByPlayerId.get(player.id) ?? INTENT_SEQ_INITIAL_LAST_ACCEPTED;
                        const reject = (reason: string) => {
                            world.pushToPlayerId(
                                cmd.source.playerId,
                                buildRejectAction(cmd.seq, cmd.intentTypeId, reason)
                            );
                        };

                        const correction = () => {
                            const pos = Position.store.get(player.id) ?? gridPos(player.x, player.y);
                            const playerMapId = resolveEntityMapId({ MapId, entityId: player.id, world });
                            world.pushToPlayerId(
                                cmd.source.playerId,
                                buildCorrectionMoveAction(cmd.seq, pos.x, pos.y, playerMapId)
                            );
                            // Corrections are authoritative; stop prediction until the next input.
                            const sub =
                                replication.PositionSub.store.get(player.id) ?? tileToWorldPosCenter(pos.x, pos.y);
                            world.pushToPlayerId(
                                cmd.source.playerId,
                                buildMoveSyncAction(lastAccepted, sub.x, sub.y, ctx.tick, 1, playerMapId)
                            );
                            state.resources.require(MOVE_SYNC_STATE_RESOURCE).set(player.id, ctx.tick);
                        };

                        const seqDecision = classifyIntentSeq({
                            seq: cmd.seq,
                            lastAccepted,
                            maxGap: INTENT_SEQ_DEFAULT_MAX_GAP,
                        });
                        if (seqDecision.kind === 'duplicate') {
                            world.pushToPlayerId(cmd.source.playerId, buildAckAction(cmd.seq));
                            break;
                        }

                        const seqRejectReason = formatIntentSeqRejectReason(cmd.seq, seqDecision);
                        if (seqRejectReason !== null) {
                            reject(seqRejectReason);
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
                            const to = decodeMoveStepIntentPayload(cmd.payloadBytes);
                            bridged = to
                                ? ({ type: 'MOVE', source: cmd.source, to } satisfies Extract<
                                      Command,
                                      { type: 'MOVE' }
                                  >)
                                : null;
                        } else if (cmd.intentTypeId === INTENT_MOVE_TO) {
                            const decoded = decodeMoveToIntentPayload(cmd.payloadBytes);
                            bridged = decoded
                                ? ({
                                      type: 'MOVE_TO',
                                      source: cmd.source,
                                      to: gridPos(decoded.x, decoded.y),
                                      stopAdjacentToTarget: decoded.stopAdjacentToTarget,
                                  } satisfies Extract<Command, { type: 'MOVE_TO' }>)
                                : null;
                        } else if (cmd.intentTypeId === INTENT_MOVE_INPUT) {
                            const decoded = decodeMoveInputIntentPayload(cmd.payloadBytes);
                            bridged = decoded
                                ? ({
                                      type: 'MOVE_INPUT',
                                      source: cmd.source,
                                      keysMask: decoded.keysMask,
                                  } satisfies Extract<Command, { type: 'MOVE_INPUT' }>)
                                : null;
                        } else if (cmd.intentTypeId === INTENT_ATTACK) {
                            const decoded = decodeAttackIntentPayload(cmd.payloadBytes);
                            bridged = decoded
                                ? ({
                                      type: 'ATTACK',
                                      source: cmd.source,
                                      targetId: entityIdFromWire(decoded.targetId),
                                  } satisfies Extract<Command, { type: 'ATTACK' }>)
                                : null;
                        } else if (cmd.intentTypeId === INTENT_DOOR_TELEPORT) {
                            const to = decodeDoorTeleportIntentPayload(cmd.payloadBytes);
                            bridged = to
                                ? ({ type: 'TELEPORT', source: cmd.source, to } satisfies Extract<
                                      Command,
                                      { type: 'TELEPORT' }
                                  >)
                                : null;
                        } else if (cmd.intentTypeId === INTENT_TILE_EDIT) {
                            const edit = decodeTileEditIntentPayload(cmd.payloadBytes);
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
                            const claim = decodeClaimCreateIntentPayload(cmd.payloadBytes);
                            bridged = claim
                                ? ({
                                      type: 'CLAIM_CREATE',
                                      source: cmd.source,
                                      x1: claim.x1,
                                      y1: claim.y1,
                                      x2: claim.x2,
                                      y2: claim.y2,
                                      editorNameKeys: claim.editors,
                                  } satisfies Extract<Command, { type: 'CLAIM_CREATE' }>)
                                : null;
                        } else if (cmd.intentTypeId === INTENT_CLAIM_UPDATE) {
                            const claim = decodeClaimUpdateIntentPayload(cmd.payloadBytes);
                            bridged = claim
                                ? ({
                                      type: 'CLAIM_UPDATE',
                                      source: cmd.source,
                                      claimId: claim.id,
                                      x1: claim.x1,
                                      y1: claim.y1,
                                      x2: claim.x2,
                                      y2: claim.y2,
                                      ...(claim.editors !== undefined ? { editorNameKeys: claim.editors } : {}),
                                  } satisfies Extract<Command, { type: 'CLAIM_UPDATE' }>)
                                : null;
                        } else if (cmd.intentTypeId === INTENT_CLAIM_DELETE) {
                            const claim = decodeClaimDeleteIntentPayload(cmd.payloadBytes);
                            bridged = claim
                                ? ({
                                      type: 'CLAIM_DELETE',
                                      source: cmd.source,
                                      claimId: claim.id,
                                  } satisfies Extract<Command, { type: 'CLAIM_DELETE' }>)
                                : null;
                        }

                        if (!bridged) {
                            reject(`Unsupported INTENT payload for: ${cmd.intentTypeId}`);
                            correction();
                            break;
                        }

                        const result = handler(intentCtx, bridged);
                        if (result && typeof result === 'object' && 'ok' in result && result.ok === false) {
                            reject(result.reason);
                            if (cmd.intentTypeId === INTENT_MOVE_STEP) {
                                correction();
                            }
                            break;
                        }
                        if (cmd.intentTypeId === INTENT_ATTACK && bridged.type === 'ATTACK') {
                            applyAttackCommand({ state, ctx, mobAi, replication, Target, cmd: bridged });
                        }
                        seqState.lastAcceptedByPlayerId.set(player.id, cmd.seq);
                        world.pushToPlayerId(cmd.source.playerId, buildAckAction(cmd.seq));

                        if (cmd.intentTypeId === INTENT_MOVE_INPUT) {
                            // Immediately provide an authoritative sync point for held-key movement.
                            // This keeps clients/sniff tests from relying on a tile-boundary MOVE to observe progress.
                            const pos = replication.PositionSub.store.get(player.id);
                            if (pos) {
                                const playerMapId = resolveEntityMapId({ MapId, entityId: player.id, world });
                                world.pushToPlayerId(
                                    cmd.source.playerId,
                                    buildMoveSyncAction(cmd.seq, pos.x, pos.y, ctx.tick, 0, playerMapId)
                                );
                                state.resources.require(MOVE_SYNC_STATE_RESOURCE).set(player.id, ctx.tick);
                            }
                        }
                        break;
                    }
                    case 'MOVE':
                        {
                            const handler = modules.getIntentHandler(INTENT_MOVE_STEP);
                            if (!handler) {
                                throw new Error(`Missing intent handler: ${INTENT_MOVE_STEP}`);
                            }
                            const result = handler(intentCtx, cmd);
                            if (result && typeof result === 'object' && 'ok' in result && result.ok === false) {
                                const pos = Position.store.get(player.id) ?? gridPos(player.x, player.y);
                                const playerMapId = resolveEntityMapId({ MapId, entityId: player.id, world });
                                world.pushToPlayerId(
                                    cmd.source.playerId,
                                    buildTeleportAction(player.id, pos.x, pos.y, playerMapId)
                                );
                            }
                        }
                        break;
                    case 'MOVE_TO':
                        // MOVE_TO is only intended to exist as an internal bridged payload inside the INTENT handler.
                        // If it ever lands in the inbound command queue, ignore it (do not crash the server).
                        break;
                    case 'MOVE_INPUT':
                        // MOVE_INPUT is only intended to exist as an internal bridged payload inside the INTENT handler.
                        // If it ever lands in the inbound command queue, ignore it (do not crash the server).
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
                        applyAttackCommand({ state, ctx, mobAi, replication, Target, cmd });
                        break;
                    case 'LOOT':
                        applyLootCommand({
                            state,
                            ctx,
                            combat,
                            replication,
                            effects,
                            items,
                            Position,
                            world,
                            player,
                            cmd,
                        });
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
                            ctx,
                            Kind: replication.Kind,
                            Position,
                            ChestLootTable: chests.ChestLootTable,
                            world,
                            player,
                            cmd,
                        });
                        break;
                    case 'CHECK':
                        applyCheckCommand({
                            world,
                            MapId,
                            player,
                            cmd,
                        });
                        break;
                    case 'ACHIEVEMENT':
                        world.persistPlayerAchievementUnlock(
                            resolvePlayerIdentityKey(player) ?? player.name,
                            cmd.achievementId
                        );
                        break;
                    case 'CHUNK_SUBSCRIBE': {
                        const radius = Math.max(0, Math.min(8, cmd.radius));
                        const center = {
                            chunkX: cmd.chunkX,
                            chunkY: cmd.chunkY,
                        };
                        const existing = chunkAoi.byPlayerId.get(player.id);
                        const knownChunks = existing?.knownChunks ?? new Set<string>();
                        knownChunks.clear();
                        const knownChunkVersions = existing?.knownChunkVersions ?? new Map<string, number>();
                        knownChunkVersions.clear();
                        const pendingChunkKeys = existing?.pendingChunkKeys ?? new Set<string>();
                        pendingChunkKeys.clear();
                        const pendingPriorityChunks = existing?.pendingPriorityChunks ?? [];
                        pendingPriorityChunks.length = 0;
                        const inFlightSnapshotKeys = existing?.inFlightSnapshotKeys ?? new Set<string>();
                        inFlightSnapshotKeys.clear();

                        const next: ChunkSubscription = {
                            radius,
                            lastMapId: null,
                            lastCenterChunkX: center.chunkX,
                            lastCenterChunkY: center.chunkY,
                            pendingChunksHead: 0,
                            pendingPriorityChunks,
                            knownChunks,
                            knownChunkVersions,
                            pendingChunks: [],
                            pendingChunkKeys,
                            inFlightSnapshotKeys,
                            pendingSnapshotPartsHead: 0,
                            pendingSnapshotParts: [],
                        };
                        chunkAoi.byPlayerId.set(player.id, next);
                        const mapId = resolveEntityMapId({ MapId, entityId: player.id, world });
                        next.lastMapId = mapId;
                        enqueueChunkAoiUpdates(next, mapId, center.chunkX, center.chunkY);
                        break;
                    }
                    case 'CHUNK_UNSUBSCRIBE':
                        chunkAoi.byPlayerId.delete(player.id);
                        break;
                    default:
                        throw new Error('Unhandled inbound command type.');
                }
            } catch (error) {
                // Error boundary: one malformed or buggy command must not take
                // the whole world down. Drop the command, log, keep ticking.
                log.event('error', 'pipeline.command_error', {
                    commandType: cmd.type,
                    playerId: 'source' in cmd ? cmd.source.playerId : null,
                    tick: ctx.tick,
                    error: error instanceof Error ? error.message : String(error),
                });
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
    readonly PositionSub = this.replication.PositionSub;
    readonly combat = registerCombatComponents(this.state.world);
    readonly effects = registerEffectsComponents(this.state.world);
    readonly items = registerItemLifecycleComponents(this.state.world);
    readonly chests = registerChestComponents(this.state.world);
    readonly mobAi = registerMobAiComponents(this.state.world);
    readonly movement = registerMovementComponents(this.state.world);
    readonly MapId = this.state.world.components.register('MapId', new SparseSetStore<string>());
    readonly chunkOverlays: ChunkOverlayStore;
    #maxChunkSnapshotPayloadUtf8Bytes: number;
    #maxChunkSnapshotParts: number;
    #maxInboundCommandQueue: number;
    #tick = 0;

    constructor(world: WorldCommandHost, { chunkSize }: { chunkSize?: number } = {}) {
        this.#world = world;
        const movementConfig = resolveServerMovementNetcodeConfig();
        log.event('info', 'movement.config', {
            profile: movementConfig.profileId,
            profileLabel: movementConfig.profileLabel,
            rollout: movementConfig.rollout,
        });
        this.#maxChunkSnapshotPayloadUtf8Bytes = resolveMaxChunkSnapshotPayloadUtf8BytesFromEnv();
        this.#maxChunkSnapshotParts = DEFAULT_MAX_CHUNK_SNAPSHOT_PARTS;
        this.#maxInboundCommandQueue = resolveMaxInboundCommandQueueFromEnv();
        const chunkSizeRaw = chunkSize;
        const resolvedChunkSize =
            typeof chunkSizeRaw === 'number' &&
            Number.isInteger(chunkSizeRaw) &&
            chunkSizeRaw > 0 &&
            chunkSizeRaw <= 256
                ? chunkSizeRaw
                : DEFAULT_CHUNK_SIZE;
        this.chunkOverlays = new ChunkOverlayStore({ chunkSize: resolvedChunkSize });
        this.state.resources.set(OUTBOX_RESOURCE, new Queue());
        this.state.resources.set(INTEREST_TRACKER_RESOURCE, new InterestTracker());
        this.state.resources.set(RESPAWN_TASKS_RESOURCE, []);
        this.state.resources.set(INTENT_SEQ_STATE_RESOURCE, createIntentSeqState());
        this.state.resources.set(MOVE_SYNC_STATE_RESOURCE, new Map());
        this.state.resources.set(PLAYER_RECENT_POSITION_HISTORY_RESOURCE, new Map());
        this.state.resources.set(ENTITY_STATE_BATCH_RESOURCE, new Map());
        this.state.resources.set(CHUNK_AOI_STATE_RESOURCE, createChunkAoiState());
        this.state.resources.set(CHUNK_OVERLAY_STORE_RESOURCE, this.chunkOverlays);
        this.state.resources.set(CLAIMS_STORE_RESOURCE, new ClaimsStore());

        const PositionSub = this.PositionSub;
        const modules = createCoreServerModuleRegistry({
            chunkOverlayStoreResource: CHUNK_OVERLAY_STORE_RESOURCE,
            resolvePlayerIdentityKey,
            applyMoveIntentCommand({ state, Position, MapId, player, movement, world, cmd }) {
                return applyMoveIntentCommand({
                    state,
                    Position,
                    MapId,
                    player,
                    movement,
                    world,
                    cmd,
                });
            },
            applyMoveToIntentCommand({ state, Position, MapId, Kind, player, movement, world, cmd }) {
                return applyMoveToIntentCommandImpl({
                    state,
                    Position,
                    MapId,
                    Kind,
                    player,
                    movement,
                    world,
                    cmd,
                });
            },
            applyMoveInputIntentCommand({ state, player, movement, cmd }) {
                applyMoveInputIntentCommand({
                    state,
                    player,
                    movement,
                    cmd,
                });
            },
            applyTeleportOutcome: ({
                state,
                ctx,
                Position,
                MapId,
                Target,
                mobAi,
                movement,
                replication,
                world: _intentWorld,
                playerId,
                fromMapId,
                toMapId,
                to,
            }) => {
                applyTeleportOutcome({
                    state,
                    ctx,
                    Position,
                    MapId,
                    PositionSub,
                    Target,
                    mobAi,
                    movement,
                    replication,
                    world,
                    playerId,
                    fromMapId,
                    toMapId,
                    to,
                });
            },
        });

        this.#scheduler = new Scheduler<Command, DomainEvent>({ nowMs: () => Date.now() });
        this.#scheduler.register(
            'pre',
            'apply_inbound_commands',
            createApplyInboundCommandsSystem(
                world,
                this.Position,
                this.MapId,
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
        this.#scheduler.register(
            'pre',
            'derive_grid_position_from_subpos',
            createDeriveGridPositionFromWorldPosSystem({ PositionSub: this.PositionSub, Position: this.Position })
        );
        this.#scheduler.register('sim', 'player_move', (state, ctx: SystemContext) => {
            const Kind = this.replication.Kind;
            const Position = this.Position;
            const MapId = this.MapId;
            const PositionSub = this.PositionSub;
            const Target = this.replication.Target;
            const { MoveQueue, MoveInput, MoveSpeedRemainder } = this.movement;
            const { HitPoints } = this.combat;
            const outbox = state.resources.require(OUTBOX_RESOURCE);
            const seqState = state.resources.require(INTENT_SEQ_STATE_RESOURCE);
            const moveSyncState = state.resources.require(MOVE_SYNC_STATE_RESOURCE);
            const MOVE_SYNC_CADENCE_TICKS = 6;
            const entityStateBatches = state.resources.require(ENTITY_STATE_BATCH_RESOURCE);

            const ups = Math.max(1, this.#world.ups);
            const positionKey = (mapId: string, x: number, y: number) => `${mapId}:${x},${y}`;
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
                const mapId = resolveEntityMapId({ MapId, entityId: id, world: this.#world });
                occupiedBy.set(positionKey(mapId, pos.x, pos.y), id);
            });

            const pushMoveSync = (playerId: EntityId, pos: { x: number; y: number }, flags: number, force: boolean) => {
                const lastSent = moveSyncState.get(playerId) ?? Number.NEGATIVE_INFINITY;
                if (!force && ctx.tick - lastSent < MOVE_SYNC_CADENCE_TICKS) {
                    return;
                }
                const ackSeq = seqState.lastAcceptedByPlayerId.get(playerId) ?? INTENT_SEQ_INITIAL_LAST_ACCEPTED;
                const playerMapId = resolveEntityMapId({ MapId, entityId: playerId, world: this.#world });
                outbox.push({
                    kind: 'to_player',
                    playerId,
                    action: buildMoveSyncAction(ackSeq, pos.x, pos.y, ctx.tick, flags, playerMapId),
                });
                moveSyncState.set(playerId, ctx.tick);
            };

            const enqueueEntityState = (entityId: EntityId, mapId: string, pos: GridPos) => {
                const map = resolveMapForId({ world: this.#world, mapId });
                if (!map) {
                    return;
                }
                const scopedGroupId = mapScopedGroupKey(mapId, map.getGroupIdFromPosition(pos.x, pos.y));
                const bucket = entityStateBatches.get(scopedGroupId);
                const entry = { x: pos.x, y: pos.y, flags: 0 };
                if (bucket) {
                    bucket.set(entityId, entry);
                } else {
                    entityStateBatches.set(scopedGroupId, new Map([[entityId, entry]]));
                }
            };

            const resolveAxisDelta = ({
                mask,
                recentKeys,
                negBit,
                posBit,
            }: {
                mask: number;
                recentKeys: number[];
                negBit: number;
                posBit: number;
            }): -1 | 0 | 1 => {
                const neg = (mask & negBit) !== 0;
                const pos = (mask & posBit) !== 0;
                if (neg && !pos) return -1;
                if (pos && !neg) return 1;
                if (!neg && !pos) return 0;
                // Both pressed: choose the more recent bit.
                const negIdx = recentKeys.lastIndexOf(negBit);
                const posIdx = recentKeys.lastIndexOf(posBit);
                if (negIdx === -1 && posIdx === -1) {
                    return 0;
                }
                if (negIdx > posIdx) return -1;
                if (posIdx > negIdx) return 1;
                return 0;
            };

            const getMoveSpeedSubpxPerTick = (playerId: EntityId, kind: EntityKind): number => {
                const cooldownTicks = resolveMoveCooldownTicks(kind, ups);
                const base = Math.floor(TILE_SUBPX / cooldownTicks);
                const rem = TILE_SUBPX - base * cooldownTicks;
                const prev = MoveSpeedRemainder.store.get(playerId) ?? 0;
                const next = prev + rem;
                if (next >= cooldownTicks) {
                    state.world.addComponent(playerId, MoveSpeedRemainder, next - cooldownTicks);
                    return base + 1;
                }
                state.world.addComponent(playerId, MoveSpeedRemainder, next);
                return base;
            };

            const PLAYER_HALF_EXTENTS = { hx: 6 * SUBPIXELS, hy: 6 * SUBPIXELS };
            const DIAG_NUM = 181;
            const DIAG_DEN = 256;

            const movingIds = new Set<EntityId>();
            MoveInput.store.forEach((id) => movingIds.add(id));
            MoveQueue.store.forEach((id) => movingIds.add(id));

            for (const playerId of movingIds) {
                const kind = Kind.store.get(playerId);
                if (kind === undefined || !Types.isPlayer(kind)) {
                    state.world.removeComponent(playerId, MoveInput);
                    state.world.removeComponent(playerId, MoveQueue);
                    state.world.removeComponent(playerId, MoveSpeedRemainder);
                    continue;
                }

                const hp = HitPoints.store.get(playerId) ?? 0;
                if (hp <= 0) {
                    state.world.removeComponent(playerId, MoveInput);
                    state.world.removeComponent(playerId, MoveQueue);
                    state.world.removeComponent(playerId, MoveSpeedRemainder);
                    continue;
                }

                const currentGrid = Position.store.get(playerId);
                if (!currentGrid) {
                    state.world.removeComponent(playerId, MoveInput);
                    state.world.removeComponent(playerId, MoveQueue);
                    state.world.removeComponent(playerId, MoveSpeedRemainder);
                    continue;
                }
                const currentMapId = resolveEntityMapId({ MapId, entityId: playerId, world: this.#world });
                const mapForPlayer = resolveMapForId({ world: this.#world, mapId: currentMapId });
                if (!mapForPlayer) {
                    state.world.removeComponent(playerId, MoveInput);
                    state.world.removeComponent(playerId, MoveQueue);
                    state.world.removeComponent(playerId, MoveSpeedRemainder);
                    continue;
                }
                const mapWidthTiles =
                    resolvePositiveIntegerOrNull(mapForPlayer.width) ??
                    resolvePositiveIntegerOrNull(mapForPlayer.grid?.[0]?.length);
                const mapHeightTiles =
                    resolvePositiveIntegerOrNull(mapForPlayer.height) ??
                    resolvePositiveIntegerOrNull(mapForPlayer.grid?.length);
                const isBlockedTile = (x: number, y: number) =>
                    !isValidPositionInMap({ world: this.#world, mapId: currentMapId, x, y });

                const input = MoveInput.store.get(playerId);
                if (input) {
                    // Held-key movement is authoritative; cancel click-to-move paths.
                    state.world.removeComponent(playerId, MoveQueue);
                }

                const speed = getMoveSpeedSubpxPerTick(playerId, kind);
                let posSub = PositionSub.store.get(playerId);
                if (!posSub) {
                    posSub = tileToWorldPosCenter(currentGrid.x, currentGrid.y);
                    state.world.addComponent(playerId, PositionSub, posSub);
                }

                let dx: -1 | 0 | 1 = 0;
                let dy: -1 | 0 | 1 = 0;
                let movingToTile: GridPos | null = null;

                if (input) {
                    const mask = input.keysMask >>> 0;
                    const recentKeys = input.recentKeys;
                    dx = resolveAxisDelta({ mask, recentKeys, negBit: MOVE_INPUT_KEY_A, posBit: MOVE_INPUT_KEY_D });
                    dy = resolveAxisDelta({ mask, recentKeys, negBit: MOVE_INPUT_KEY_W, posBit: MOVE_INPUT_KEY_S });
                } else {
                    const queue = MoveQueue.store.get(playerId);
                    if (!queue || queue.entries.length === 0) {
                        state.world.removeComponent(playerId, MoveQueue);
                        state.world.removeComponent(playerId, MoveSpeedRemainder);
                        continue;
                    }

                    // Consume any waypoints already reached (or snapped) at tile center.
                    let entries = queue.entries;
                    for (;;) {
                        const nextTile = entries[0];
                        if (!nextTile) {
                            break;
                        }
                        const targetCenter = tileToWorldPosCenter(nextTile.x, nextTile.y);
                        const dxToTarget = targetCenter.x - posSub.x;
                        const dyToTarget = targetCenter.y - posSub.y;
                        if (Math.abs(dxToTarget) <= 1 && Math.abs(dyToTarget) <= 1) {
                            posSub = targetCenter;
                            entries = entries.slice(1);
                            continue;
                        }
                        movingToTile = nextTile;
                        dx = Math.sign(dxToTarget) as -1 | 0 | 1;
                        dy = Math.sign(dyToTarget) as -1 | 0 | 1;
                        break;
                    }

                    if (entries !== queue.entries) {
                        if (entries.length === 0) {
                            state.world.removeComponent(playerId, MoveQueue);
                            state.world.removeComponent(playerId, MoveSpeedRemainder);
                            state.world.addComponent(playerId, PositionSub, posSub);
                            state.world.addComponent(playerId, Position, worldPosToTile(posSub));
                            continue;
                        }
                        state.world.addComponent(playerId, MoveQueue, { entries });
                    }
                }

                if (dx === 0 && dy === 0) {
                    // No motion requested (possible when opposite keys are held with ambiguous ordering).
                    continue;
                }

                let stepDx = dx * speed;
                let stepDy = dy * speed;
                if (dx !== 0 && dy !== 0) {
                    stepDx = Math.trunc((stepDx * DIAG_NUM) / DIAG_DEN);
                    stepDy = Math.trunc((stepDy * DIAG_NUM) / DIAG_DEN);
                }

                let queuedStepTargetCenter: ReturnType<typeof tileToWorldPosCenter> | null = null;
                if (!input && movingToTile) {
                    queuedStepTargetCenter = tileToWorldPosCenter(movingToTile.x, movingToTile.y);
                    // Prevent queued click-to-move waypoint overshoot; this avoids target-center ping-pong.
                    const remX = queuedStepTargetCenter.x - posSub.x;
                    const remY = queuedStepTargetCenter.y - posSub.y;
                    if (stepDx !== 0) {
                        if (remX === 0) {
                            stepDx = 0;
                        } else if (Math.abs(stepDx) > Math.abs(remX)) {
                            stepDx = remX;
                        }
                    }
                    if (stepDy !== 0) {
                        if (remY === 0) {
                            stepDy = 0;
                        } else if (Math.abs(stepDy) > Math.abs(remY)) {
                            stepDy = remY;
                        }
                    }
                }

                let isBlockedTileForStep = isBlockedTile;
                let allowedBlockedOverlapTiles: ReadonlyArray<{ x: number; y: number }> | undefined;
                if (dx !== 0 && dy !== 0 && !input && movingToTile) {
                    // Keep diagonal corner-cut ignores stable for queued click-to-move steps so waypoint execution
                    // matches path planner intent.
                    const ignoreOrthA = { x: movingToTile.x, y: movingToTile.y - dy };
                    const ignoreOrthB = { x: movingToTile.x - dx, y: movingToTile.y };
                    allowedBlockedOverlapTiles = [ignoreOrthA, ignoreOrthB];
                    isBlockedTileForStep = (x: number, y: number) => {
                        if (x === ignoreOrthA.x && y === ignoreOrthA.y) return false;
                        if (x === ignoreOrthB.x && y === ignoreOrthB.y) return false;
                        return isBlockedTile(x, y);
                    };
                }

                const resolved = resolveSubTileMotionAgainstTiles({
                    pos: posSub,
                    delta: { dx: stepDx, dy: stepDy },
                    halfExtents: PLAYER_HALF_EXTENTS,
                    isBlockedTile: isBlockedTileForStep,
                });

                let nextSub = resolved.pos;
                let nextGrid = worldPosToTile(nextSub);

                // If click-to-move is close enough to the target center, snap to it and consume the waypoint.
                if (!input && movingToTile) {
                    const targetCenter = queuedStepTargetCenter ?? tileToWorldPosCenter(movingToTile.x, movingToTile.y);
                    const dxToTarget = targetCenter.x - nextSub.x;
                    const dyToTarget = targetCenter.y - nextSub.y;
                    if (Math.abs(dxToTarget) <= speed && Math.abs(dyToTarget) <= speed) {
                        nextSub = targetCenter;
                        nextGrid = worldPosToTile(nextSub);

                        const queue = MoveQueue.store.get(playerId);
                        if (queue?.entries[0]) {
                            const remaining = queue.entries.slice(1);
                            if (remaining.length === 0) {
                                state.world.removeComponent(playerId, MoveQueue);
                                state.world.removeComponent(playerId, MoveSpeedRemainder);
                            } else {
                                state.world.addComponent(playerId, MoveQueue, { entries: remaining });
                            }
                        }
                    }
                }

                if (mapWidthTiles !== null && mapHeightTiles !== null) {
                    nextSub = clampWorldPosInsideMap({
                        pos: nextSub,
                        halfExtents: PLAYER_HALF_EXTENTS,
                        mapWidthTiles,
                        mapHeightTiles,
                    });
                    nextGrid = worldPosToTile(nextSub);
                }

                // Safety invariant: never commit penetration into blocked geometry.
                if (
                    worldPosOverlapsBlockedTiles({
                        pos: nextSub,
                        halfExtents: PLAYER_HALF_EXTENTS,
                        isBlockedTile,
                        ignoreTiles: allowedBlockedOverlapTiles,
                    })
                ) {
                    pushMoveSync(playerId, posSub, 1, false);
                    continue;
                }

                // Tile-structured entity collision: block entry into an occupied destination tile.
                const wantsTileChange = nextGrid.x !== currentGrid.x || nextGrid.y !== currentGrid.y;
                if (wantsTileChange) {
                    const occupant = occupiedBy.get(positionKey(currentMapId, nextGrid.x, nextGrid.y));
                    if (occupant !== undefined && occupant !== playerId) {
                        pushMoveSync(playerId, posSub, 1, false);
                        continue;
                    }
                }

                // Commit movement.
                state.world.removeComponent(playerId, Target);
                state.world.addComponent(playerId, PositionSub, nextSub);
                state.world.addComponent(playerId, Position, nextGrid);

                // Periodic authoritative position sync (sub-tile) for client reconciliation.
                pushMoveSync(playerId, nextSub, 0, false);

                if (wantsTileChange) {
                    recordRecentPlayerPosition({ state, playerId, pos: nextGrid, tick: ctx.tick });
                    const oldKey = positionKey(currentMapId, currentGrid.x, currentGrid.y);
                    if (occupiedBy.get(oldKey) === playerId) {
                        occupiedBy.delete(oldKey);
                    }
                    occupiedBy.set(positionKey(currentMapId, nextGrid.x, nextGrid.y), playerId);

                    outbox.push({
                        kind: 'to_player',
                        playerId,
                        action: buildMoveAction(playerId, nextGrid.x, nextGrid.y),
                    });
                    pushMoveSync(playerId, nextSub, 0, true);
                    enqueueEntityState(playerId, currentMapId, nextGrid);

                    const doorDestination = resolveDoorTeleportDestination({
                        world: this.#world,
                        mapId: currentMapId,
                        x: nextGrid.x,
                        y: nextGrid.y,
                    });
                    if (doorDestination) {
                        const validDestination = isValidPositionInMap({
                            world: this.#world,
                            mapId: doorDestination.toMapId,
                            x: doorDestination.to.x,
                            y: doorDestination.to.y,
                        });
                        if (!validDestination) {
                            emitMapTransitionEvent({
                                world: this.#world,
                                event: {
                                    kind: 'reject',
                                    reason: 'invalid_destination',
                                    playerId,
                                    fromMapId: currentMapId,
                                    toMapId: doorDestination.toMapId,
                                    toX: doorDestination.to.x,
                                    toY: doorDestination.to.y,
                                },
                            });
                        } else {
                            const destinationKey = positionKey(
                                doorDestination.toMapId,
                                doorDestination.to.x,
                                doorDestination.to.y
                            );
                            const destinationOccupant = occupiedBy.get(destinationKey);
                            if (destinationOccupant !== undefined && destinationOccupant !== playerId) {
                                emitMapTransitionEvent({
                                    world: this.#world,
                                    event: {
                                        kind: 'reject',
                                        reason: 'destination_occupied',
                                        playerId,
                                        fromMapId: currentMapId,
                                        toMapId: doorDestination.toMapId,
                                        toX: doorDestination.to.x,
                                        toY: doorDestination.to.y,
                                        destinationOccupantId: destinationOccupant,
                                    },
                                });
                            } else {
                                occupiedBy.delete(positionKey(currentMapId, nextGrid.x, nextGrid.y));
                                occupiedBy.set(destinationKey, playerId);

                                const teleport = modules.getOutcomeHandler(OUTCOME_DOOR_TELEPORT);
                                if (!teleport) {
                                    throw new Error(`Missing outcome handler: ${OUTCOME_DOOR_TELEPORT}`);
                                }

                                const player = this.#world.getConnectionPlayerById(playerId);
                                if (!player) {
                                    state.world.removeComponent(playerId, MoveQueue);
                                    emitMapTransitionEvent({
                                        world: this.#world,
                                        event: {
                                            kind: 'reject',
                                            reason: 'player_missing',
                                            playerId,
                                            fromMapId: currentMapId,
                                            toMapId: doorDestination.toMapId,
                                            toX: doorDestination.to.x,
                                            toY: doorDestination.to.y,
                                        },
                                    });
                                    continue;
                                }

                                teleport(
                                    {
                                        modules,
                                        state,
                                        ctx,
                                        world: this.#world,
                                        player,
                                        Position,
                                        MapId,
                                        Target,
                                        movement: this.movement,
                                        mobAi: this.mobAi,
                                        replication: this.replication,
                                    },
                                    {
                                        playerId,
                                        fromMapId: currentMapId,
                                        toMapId: doorDestination.toMapId,
                                        to: gridPos(doorDestination.to.x, doorDestination.to.y),
                                    } satisfies DoorTeleportOutcome
                                );
                            }
                        }
                    }
                }
            }
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
                    const mapId = resolveEntityMapId({ MapId: this.MapId, entityId: id, world: this.#world });
                    const map = resolveMapForId({ world: this.#world, mapId });
                    const fallbackGroupId =
                        pos !== undefined && map
                            ? mapScopedGroupKey(mapId, map.getGroupIdFromPosition(pos.x, pos.y))
                            : undefined;
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
            const MapId = this.MapId;
            const Position = this.Position;
            const PositionSub = this.PositionSub;
            const Target = this.replication.Target;
            const { MobSpawnPos, MobHate, MobReturnAtTick, MobMoveGoal, MobMoveRemainder } = this.mobAi;

            const ups = Math.max(1, this.#world.ups);
            if (ctx.tick === 0) {
                return;
            }

            const returnDelayTicks = ups * 4;
            const leashDistance = 50;
            const positionKey = (mapId: string, x: number, y: number) => `${mapId}:${x},${y}`;
            const occupiedBy = new Map<string, EntityId>();

            Position.store.forEach((id, pos) => {
                const kind = Kind.store.get(id);
                if (kind === undefined) {
                    return;
                }
                if (!Types.isPlayer(kind) && !Types.isMob(kind) && !Types.isChest(kind) && !Types.isNpc(kind)) {
                    return;
                }
                const mapId = resolveEntityMapId({ MapId, entityId: id, world: this.#world });
                occupiedBy.set(positionKey(mapId, pos.x, pos.y), id);
            });

            const canMobMoveTo = (mobId: EntityId, mapId: string, x: number, y: number) => {
                if (!isValidPositionInMap({ world: this.#world, mapId, x, y })) {
                    return false;
                }
                const occupant = occupiedBy.get(positionKey(mapId, x, y));
                return occupant === undefined || occupant === mobId;
            };

            const getMoveSpeedSubpxPerTick = (mobId: EntityId, kind: EntityKind): number => {
                const cooldownTicks = resolveMoveCooldownTicks(kind, ups);
                const base = Math.floor(TILE_SUBPX / cooldownTicks);
                const rem = TILE_SUBPX - base * cooldownTicks;
                const prev = MobMoveRemainder.store.get(mobId) ?? 0;
                const next = prev + rem;
                if (next >= cooldownTicks) {
                    state.world.addComponent(mobId, MobMoveRemainder, next - cooldownTicks);
                    return base + 1;
                }
                state.world.addComponent(mobId, MobMoveRemainder, next);
                return base;
            };

            const MOB_HALF_EXTENTS = { hx: 6 * SUBPIXELS, hy: 6 * SUBPIXELS };
            const DIAG_NUM = 181;
            const DIAG_DEN = 256;

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
                const mobMapId = resolveEntityMapId({ MapId, entityId: mobId, world: this.#world });
                const mapForMob = resolveMapForId({ world: this.#world, mapId: mobMapId });
                if (!mapForMob) {
                    continue;
                }
                const mapWidthTiles =
                    resolvePositiveIntegerOrNull(mapForMob.width) ??
                    resolvePositiveIntegerOrNull(mapForMob.grid?.[0]?.length);
                const mapHeightTiles =
                    resolvePositiveIntegerOrNull(mapForMob.height) ??
                    resolvePositiveIntegerOrNull(mapForMob.grid?.length);
                const isBlockedTile = (x: number, y: number) =>
                    !isValidPositionInMap({ world: this.#world, mapId: mobMapId, x, y });

                let subNow = PositionSub.store.get(mobId) ?? tileToWorldPosCenter(currentPos.x, currentPos.y);
                if (!PositionSub.store.get(mobId)) {
                    state.world.addComponent(mobId, PositionSub, subNow);
                }

                let goal = MobMoveGoal.store.get(mobId);

                let spawn = MobSpawnPos.store.get(mobId);
                if (!spawn) {
                    spawn = currentPos;
                    state.world.addComponent(mobId, MobSpawnPos, spawn);
                }

                const stepTowardsGoal = (): void => {
                    if (!goal) {
                        state.world.removeComponent(mobId, MobMoveRemainder);
                        return;
                    }

                    const dxTile = Math.max(-1, Math.min(1, goal.x - currentPos.x));
                    const dyTile = Math.max(-1, Math.min(1, goal.y - currentPos.y));
                    if (dxTile === 0 && dyTile === 0) {
                        state.world.removeComponent(mobId, MobMoveGoal);
                        goal = undefined;
                        state.world.removeComponent(mobId, MobMoveRemainder);
                        return;
                    }

                    const baseSpeed = getMoveSpeedSubpxPerTick(mobId, mobKind);
                    const stepSpeed =
                        dxTile !== 0 && dyTile !== 0 ? Math.floor((baseSpeed * DIAG_NUM) / DIAG_DEN) : baseSpeed;
                    if (stepSpeed <= 0) {
                        return;
                    }

                    const targetCenter = tileToWorldPosCenter(goal.x, goal.y);
                    const resolved = resolveSubTileMotionAgainstTiles({
                        pos: subNow,
                        delta: { dx: dxTile * stepSpeed, dy: dyTile * stepSpeed },
                        halfExtents: MOB_HALF_EXTENTS,
                        isBlockedTile,
                    });
                    subNow = resolved.pos;

                    // Snap to tile center when sufficiently close (prevents endless residual drift due to rounding).
                    if (
                        Math.abs(targetCenter.x - subNow.x) <= stepSpeed &&
                        Math.abs(targetCenter.y - subNow.y) <= stepSpeed
                    ) {
                        subNow = targetCenter;
                        state.world.removeComponent(mobId, MobMoveGoal);
                        goal = undefined;
                        state.world.removeComponent(mobId, MobMoveRemainder);
                    }

                    if (mapWidthTiles !== null && mapHeightTiles !== null) {
                        subNow = clampWorldPosInsideMap({
                            pos: subNow,
                            halfExtents: MOB_HALF_EXTENTS,
                            mapWidthTiles,
                            mapHeightTiles,
                        });
                    }

                    state.world.addComponent(mobId, PositionSub, subNow);
                    const nextGrid = worldPosToTile(subNow);
                    if (nextGrid.x !== currentPos.x || nextGrid.y !== currentPos.y) {
                        const oldKey = positionKey(mobMapId, currentPos.x, currentPos.y);
                        if (occupiedBy.get(oldKey) === mobId) {
                            occupiedBy.delete(oldKey);
                        }
                        state.world.addComponent(mobId, Position, nextGrid);
                        occupiedBy.set(positionKey(mobMapId, nextGrid.x, nextGrid.y), mobId);
                    }

                    const scopedGroupId = mapScopedGroupKey(
                        mobMapId,
                        mapForMob.getGroupIdFromPosition(nextGrid.x, nextGrid.y)
                    );
                    const batches = state.resources.require(ENTITY_STATE_BATCH_RESOURCE);
                    const bucket = batches.get(scopedGroupId);
                    const entry = { x: nextGrid.x, y: nextGrid.y, flags: 0 };
                    if (bucket) {
                        bucket.set(mobId, entry);
                    } else {
                        batches.set(scopedGroupId, new Map([[mobId, entry]]));
                    }
                };

                const hate = MobHate.store.get(mobId)?.entries ?? [];
                if (hate.length === 0) {
                    const returnAtTick = MobReturnAtTick.store.get(mobId);
                    if (typeof returnAtTick === 'number' && ctx.tick >= returnAtTick) {
                        if (currentPos.x === spawn.x && currentPos.y === spawn.y) {
                            state.world.removeComponent(mobId, MobReturnAtTick);
                            state.world.removeComponent(mobId, MobMoveGoal);
                            goal = undefined;
                            state.world.removeComponent(mobId, MobMoveRemainder);
                        } else {
                            if (!goal) {
                                const next = chooseStepTowards({
                                    from: currentPos,
                                    to: spawn,
                                    avoidExactTargetTile: false,
                                    isValidPosition: (x, y) => canMobMoveTo(mobId, mobMapId, x, y),
                                });
                                if (next) {
                                    state.world.addComponent(mobId, MobMoveGoal, next);
                                    goal = next;
                                }
                            }
                        }
                    }
                    // If returning (or already has a goal), advance motion toward the current goal.
                    stepTowardsGoal();
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
                    const playerMapId = resolveEntityMapId({ MapId, entityId: entry.id, world: this.#world });
                    if (playerMapId !== mobMapId) {
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
                        state.world.removeComponent(mobId, MobMoveGoal);
                        state.world.removeComponent(mobId, MobMoveRemainder);
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
                const targetMapId = resolveEntityMapId({ MapId, entityId: desiredTargetId, world: this.#world });
                if (targetMapId !== mobMapId) {
                    continue;
                }

                if (isAdjacentNonDiagonal(currentPos, targetPos)) {
                    continue;
                }

                if (goal) {
                    stepTowardsGoal();
                    continue;
                }

                let next = chooseStepTowards({
                    from: currentPos,
                    to: targetPos,
                    isValidPosition: (x, y) => canMobMoveTo(mobId, mobMapId, x, y),
                });

                next ??= chooseStepTowardsAdjacentViaBfs({
                    from: currentPos,
                    target: targetPos,
                    spawn,
                    leashDistance,
                    isValidPosition: (x, y) => canMobMoveTo(mobId, mobMapId, x, y),
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

                state.world.addComponent(mobId, MobMoveGoal, next);
                goal = next;
                stepTowardsGoal();
            }
        });
        this.#scheduler.register('sim', 'combat_authority', (state, ctx: SystemContext) => {
            runServerAuthoritativeCombatSystem({
                state,
                ctx,
                combat: this.combat,
                mobAi: this.mobAi,
                replication: this.replication,
                MapId: this.MapId,
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
        this.#scheduler.register('post', 'flush_entity_state_batches', (state, ctx: SystemContext) => {
            const batches = state.resources.require(ENTITY_STATE_BATCH_RESOURCE);
            if (batches.size === 0) {
                return;
            }
            const PositionSub = this.PositionSub;
            const outbox = state.resources.require(OUTBOX_RESOURCE);
            for (const [groupId, entries] of batches.entries()) {
                if (!groupId || entries.size === 0) {
                    continue;
                }
                const first = entries.keys().next().value as EntityId | undefined;
                if (!first) {
                    continue;
                }

                const payload: Array<{ id: EntityId; worldX: number; worldY: number; flags: number }> = [];
                for (const [id, pos] of entries.entries()) {
                    const sub = PositionSub.store.get(id);
                    if (!sub) {
                        // PositionSub should always be present for replicated entities; skip if missing.
                        continue;
                    }
                    payload.push({ id, worldX: sub.x, worldY: sub.y, flags: pos.flags });
                }
                outbox.push({
                    kind: 'broadcast_nearby',
                    actorId: first,
                    fallbackGroupId: groupId,
                    action: buildEntityStateBatchAction({ tick: ctx.tick, entries: payload }),
                });
            }
            batches.clear();
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
        const mapId =
            typeof entity.mapId === 'string' && entity.mapId.trim().length > 0
                ? entity.mapId
                : resolveDefaultMapId(this.#world);
        this.state.world.addComponent(entity.id, this.MapId, mapId);
    }

    seedItemFromSpawn({
        id,
        kind,
        x,
        y,
        mapId,
    }: {
        id: EntityId;
        kind: EntityKind;
        x: number;
        y: number;
        mapId?: string;
    }): void {
        this.state.world.ensureEntity(id);
        this.state.world.addComponent(id, this.MapId, mapId ?? resolveDefaultMapId(this.#world));
        this.state.world.addComponent(id, this.replication.Kind, kind);
        this.state.world.addComponent(id, this.Position, gridPos(x, y));
        this.state.world.addComponent(id, this.PositionSub, tileToWorldPosCenter(x, y));
    }

    seedMobFromPrefabSpawn({
        id,
        kind,
        x,
        y,
        spawnX,
        spawnY,
        mapId,
        orientation,
    }: {
        id: EntityId;
        kind: EntityKind;
        x: number;
        y: number;
        spawnX: number;
        spawnY: number;
        mapId?: string;
        orientation?: number;
    }): void {
        this.seedItemFromSpawn({ id, kind, x, y, mapId });
        this.state.world.addComponent(
            id,
            this.replication.Orientation,
            orientation ?? resolveDeterministicOrientation(id)
        );
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

    syncChestLootEntity(entity: Readonly<{ id: EntityId; kind?: EntityKind; items?: JsonLike }>): void {
        if (entity.kind !== Types.Entities.CHEST) {
            return;
        }

        if (this.chests.ChestLootTable.store.get(entity.id) !== undefined) {
            return;
        }

        const rawItems = entity.items;
        const items = Array.isArray(rawItems) ? rawItems : [];

        const loot: EntityKind[] = [];
        for (let i = 0; i < items.length; i += 1) {
            const item = items[i];
            if (typeof item !== 'number') {
                continue;
            }
            const kind = toKnownEntityKind(item);
            if (kind === null || kind === Types.Entities.CHEST) {
                continue;
            }
            loot.push(kind);
        }

        this.state.world.ensureEntity(entity.id);
        this.state.world.addComponent(entity.id, this.chests.ChestLootTable, { items: loot });
    }

    setChestLootTable(chestId: EntityId, rawItems: JsonLike): void {
        const items = Array.isArray(rawItems) ? rawItems : [];

        const loot: EntityKind[] = [];
        for (let i = 0; i < items.length; i += 1) {
            const item = items[i];
            if (typeof item !== 'number') {
                continue;
            }
            const kind = toKnownEntityKind(item);
            if (kind === null || kind === Types.Entities.CHEST) {
                continue;
            }
            loot.push(kind);
        }

        this.state.world.ensureEntity(chestId);
        this.state.world.addComponent(chestId, this.chests.ChestLootTable, { items: loot });
    }

    removeEntity(id: EntityId): void {
        this.state.resources.get(INTENT_SEQ_STATE_RESOURCE)?.lastAcceptedByPlayerId.delete(id);
        this.state.resources.get(MOVE_SYNC_STATE_RESOURCE)?.delete(id);
        this.state.resources.get(PLAYER_RECENT_POSITION_HISTORY_RESOURCE)?.delete(id);
        this.state.resources.get(CHUNK_AOI_STATE_RESOURCE)?.byPlayerId.delete(id);
        this.state.resources.get(ENTITY_STATE_BATCH_RESOURCE)?.forEach((entries) => entries.delete(id));
        this.state.resources.get(INTEREST_TRACKER_RESOURCE)?.clearObserver(id);
        if (this.state.world.entities.isAlive(id)) {
            this.state.world.destroyEntity(id);
        }
    }

    enqueue(command: Command): boolean {
        if (this.state.commands.size >= this.#maxInboundCommandQueue) {
            return false;
        }
        this.state.commands.push(command);
        return true;
    }

    buildSpawnActionForLegacyEntity(entity: LegacySpawnReplicationEntity): ServerToClientSpawnAction {
        this.syncSpawnReplicationEntity(entity);
        const mapId = resolveEntityMapId({ MapId: this.MapId, entityId: entity.id, world: this.#world });
        return buildSpawnActionFromReplicationState(this.state.world, this.replication, entity.id, mapId);
    }

    buildSpawnActionForEntityId(entityId: EntityId): ServerToClientSpawnAction {
        const mapId = resolveEntityMapId({ MapId: this.MapId, entityId, world: this.#world });
        return buildSpawnActionFromReplicationState(this.state.world, this.replication, entityId, mapId);
    }

    setServerConfig(config: ServerConfig | null | undefined): void {
        // Keep this narrow: this class only needs config for replication caps.
        if (!config) {
            this.#maxChunkSnapshotPayloadUtf8Bytes = resolveMaxChunkSnapshotPayloadUtf8BytesFromEnv();
            this.#maxChunkSnapshotParts = DEFAULT_MAX_CHUNK_SNAPSHOT_PARTS;
            this.#maxInboundCommandQueue = resolveMaxInboundCommandQueueFromEnv();
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

        this.#maxInboundCommandQueue = resolveMaxInboundCommandQueueFromEnv();
        if (process.env.BQ_MAX_INBOUND_COMMAND_QUEUE === undefined) {
            const configInboundQueue = resolvePositiveIntegerOrNull(
                (config as { inbound_command_queue_max?: unknown }).inbound_command_queue_max
            );
            if (configInboundQueue !== null) {
                this.#maxInboundCommandQueue = configInboundQueue;
            }
        }
    }

    tick(): void {
        this.#scheduler.tick(this.state, this.#tick++);

        const idsByGroup = this.#buildGroupIndex();
        replicateInterestVisibility({
            world: this.#world,
            state: this.state,
            Position: this.Position,
            MapId: this.MapId,
            replication: this.replication,
            interest: this.state.resources.require(INTEREST_TRACKER_RESOURCE),
            idsByGroup,
        });
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

            broadcastNearbyOutboxMessage({
                world: this.#world,
                Position: this.Position,
                MapId: this.MapId,
                msg,
                idsByGroup,
            });
        }
    }

    #buildGroupIndex(): Map<string, EntityId[]> {
        const idsByGroup = new Map<string, EntityId[]>();
        const defaultMapId = resolveDefaultMapId(this.#world);

        this.Position.store.forEach((id, pos) => {
            const mapId = this.MapId.store.get(id) ?? defaultMapId;
            const map = resolveMapForId({ world: this.#world, mapId });
            if (!map) {
                return;
            }
            const scopedGroupId = mapScopedGroupKey(mapId, map.getGroupIdFromPosition(pos.x, pos.y));
            const list = idsByGroup.get(scopedGroupId);
            if (list) {
                list.push(id);
            } else {
                idsByGroup.set(scopedGroupId, [id]);
            }
        });

        return idsByGroup;
    }

    #replicateChunkSnapshots(): void {
        replicateChunkSnapshots({
            world: this.#world,
            outbox: this.state.resources.require(OUTBOX_RESOURCE),
            overlays: this.state.resources.require(CHUNK_OVERLAY_STORE_RESOURCE),
            chunkAoi: this.state.resources.require(CHUNK_AOI_STATE_RESOURCE),
            getPlayerPosition: (playerId) => this.Position.store.get(playerId),
            getPlayerMapId: (playerId) =>
                resolveEntityMapId({ MapId: this.MapId, entityId: playerId, world: this.#world }),
            maxChunkSnapshotPayloadUtf8Bytes: this.#maxChunkSnapshotPayloadUtf8Bytes,
            maxChunkSnapshotParts: this.#maxChunkSnapshotParts,
            maxSnapshotsPerTickPerPlayer: MAX_CHUNK_SNAPSHOTS_PER_TICK_PER_PLAYER,
        });
    }

    #replicateChunkDeltas(): void {
        replicateChunkDeltas({
            world: this.#world,
            outbox: this.state.resources.require(OUTBOX_RESOURCE),
            overlays: this.state.resources.require(CHUNK_OVERLAY_STORE_RESOURCE),
            chunkAoi: this.state.resources.require(CHUNK_AOI_STATE_RESOURCE),
            maxChunkSnapshotPayloadUtf8Bytes: this.#maxChunkSnapshotPayloadUtf8Bytes,
            maxChunkSnapshotParts: this.#maxChunkSnapshotParts,
            maxChunkDeltaChangesPerMessage: MAX_CHUNK_DELTA_CHANGES_PER_MESSAGE,
        });
    }
}
