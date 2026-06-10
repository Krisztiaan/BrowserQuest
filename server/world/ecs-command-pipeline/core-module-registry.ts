import { entityIdFromWire, type EntityId } from '../../../shared/domain/ids';
import { gridPos, type GridPos } from '../../../shared/domain/positions';
import { GameModuleRegistry } from '../../../shared/modules/module-registry';
import {
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
} from '../../../shared/protocol/intents';
export {
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
} from '../../../shared/protocol/intents';
import type { EntityKind } from '../../../shared/entity-kind-domain';
import type { Command } from '../../ecs/commands';
import type { ComponentType } from '../../ecs/component-registry';
import type { DomainEvent } from '../../ecs/events';
import type { ResourceKey } from '../../ecs/resources';
import type { SystemContext } from '../../ecs/scheduler';
import type { WorldState } from '../../ecs/world-state';
import type { registerMobAiComponents } from '../../ecs/mob-ai-components';
import type { registerMovementComponents } from '../../ecs/movement-components';
import type { registerSpawnReplicationComponents } from '../../replication/spawn-replication';
import {
    applyClaimCreateIntent,
    applyClaimDeleteIntent,
    applyClaimUpdateIntent,
    DEFAULT_CLAIM_INTENT_CONFIG,
} from './claim-intents';
import { CLAIMS_STORE_RESOURCE } from '../claims/claims-resource';
import type { RectClaim } from '../claims/claims-store';
import { canEditTile } from '../claims/permissions';
import type { ChunkOverlayStore } from '../chunks/chunk-overlay-store';
import type { PlayerLike } from '../player-like';
import { recordMapTransitionEvent, type MapTransitionEvent } from '../map-transition-observability';

type JsonScalar = string | number | boolean | null;
type JsonLike = JsonScalar | JsonLike[] | { [key: string]: JsonLike };
type JsonRecord = { [key: string]: JsonLike };
type LooseValue = string | number | boolean | bigint | symbol | null | undefined | object;

export type IntentWorldHost = Readonly<{
    id?: string;
    map: {
        getDoorDestination(x: number, y: number): { x: number; y: number } | null;
        // Server-side movement intents (e.g. move.to) need collision grid + bounds, but older host
        // surfaces may omit them. Handlers must guard at runtime and reject if unavailable.
        grid?: number[][];
        width?: number;
        height?: number;
        isOutOfBounds?(x: number, y: number): boolean;
        isSameNavigationIsland?(fromX: number, fromY: number, toX: number, toY: number): boolean;
    };
    getDefaultMapId?(): string;
    getMapById?(mapId: string): {
        getDoorDestination(x: number, y: number): { x: number; y: number } | null;
        grid?: number[][];
        width?: number;
        height?: number;
        isOutOfBounds?(x: number, y: number): boolean;
        isSameNavigationIsland?(fromX: number, fromY: number, toX: number, toY: number): boolean;
    } | null;
    isValidPositionForMap?(mapId: string, x: number, y: number): boolean;
    resolveDoorTeleport?(
        mapId: string,
        x: number,
        y: number
    ): Readonly<{ toMapId: string; to: { x: number; y: number } }> | null;
    isValidPosition(x: number, y: number): boolean;
    ensureChunkOverlayLoadedForTile?(x: number, y: number, mapId?: string): boolean;
    persistClaimUpsert?(claim: RectClaim): void;
    persistClaimDelete?(claimId: number): void;
    recordMapTransitionEvent?(event: MapTransitionEvent): void;
}>;

export type InboundIntentContext = {
    modules: GameModuleRegistry;
    state: WorldState<Command, DomainEvent>;
    ctx: SystemContext;
    world: IntentWorldHost;
    player: PlayerLike;
    Position: ComponentType<GridPos>;
    MapId: ComponentType<string>;
    Target: ComponentType<EntityId>;
    movement: ReturnType<typeof registerMovementComponents>;
    mobAi: ReturnType<typeof registerMobAiComponents>;
    replication: ReturnType<typeof registerSpawnReplicationComponents>;
};

type ApplyMoveIntentCommand = (params: {
    state: WorldState<Command, DomainEvent>;
    Position: ComponentType<GridPos>;
    MapId: ComponentType<string>;
    player: PlayerLike;
    movement: ReturnType<typeof registerMovementComponents>;
    world: IntentWorldHost;
    cmd: Extract<Command, { type: 'MOVE' }>;
}) => { ok: false; reason: string } | void;

type ApplyMoveToIntentCommand = (params: {
    state: WorldState<Command, DomainEvent>;
    Position: ComponentType<GridPos>;
    MapId: ComponentType<string>;
    Kind: ComponentType<EntityKind>;
    player: PlayerLike;
    movement: ReturnType<typeof registerMovementComponents>;
    world: IntentWorldHost;
    cmd: Extract<Command, { type: 'MOVE_TO' }>;
}) => { ok: false; reason: string } | void;

type ApplyMoveInputIntentCommand = (params: {
    state: WorldState<Command, DomainEvent>;
    player: PlayerLike;
    movement: ReturnType<typeof registerMovementComponents>;
    cmd: Extract<Command, { type: 'MOVE_INPUT' }>;
}) => { ok: false; reason: string } | void;

type ApplyTeleportOutcome = (params: {
    state: WorldState<Command, DomainEvent>;
    ctx: SystemContext;
    Position: ComponentType<GridPos>;
    MapId: ComponentType<string>;
    Target: ComponentType<EntityId>;
    mobAi: ReturnType<typeof registerMobAiComponents>;
    movement: ReturnType<typeof registerMovementComponents>;
    replication: ReturnType<typeof registerSpawnReplicationComponents>;
    world: IntentWorldHost;
    playerId: EntityId;
    fromMapId: string;
    toMapId: string;
    to: GridPos;
}) => void;

type CoreModuleRegistryOptions = Readonly<{
    chunkOverlayStoreResource: ResourceKey<ChunkOverlayStore>;
    resolvePlayerIdentityKey(player: PlayerLike): string | null;
    applyMoveIntentCommand: ApplyMoveIntentCommand;
    applyMoveToIntentCommand: ApplyMoveToIntentCommand;
    applyMoveInputIntentCommand: ApplyMoveInputIntentCommand;
    applyTeleportOutcome: ApplyTeleportOutcome;
}>;

function isRecord(value: LooseValue): value is JsonRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value: LooseValue): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function decodeInboundIntentContext(value: LooseValue): InboundIntentContext | null {
    return isRecord(value) ? (value as object as InboundIntentContext) : null;
}

function decodeCommandByType<TType extends Command['type']>(
    value: LooseValue,
    expectedType: TType
): Extract<Command, { type: TType }> | null {
    if (!isRecord(value) || value.type !== expectedType) {
        return null;
    }
    return value as Extract<Command, { type: TType }>;
}

function isTileEditOutOfBounds({
    world,
    mapId,
    x,
    y,
}: {
    world: IntentWorldHost;
    mapId: string;
    x: number;
    y: number;
}): boolean {
    if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) {
        return true;
    }

    const map = world.getMapById?.(mapId) ?? world.map;
    if (typeof map.isOutOfBounds === 'function') {
        return map.isOutOfBounds(x, y);
    }

    if (Number.isInteger(map.width) && Number.isInteger(map.height) && (map.width ?? 0) > 0 && (map.height ?? 0) > 0) {
        return x < 0 || y < 0 || x >= (map.width ?? 0) || y >= (map.height ?? 0);
    }

    // Fail closed: without map bounds, tile edits can allocate unbounded overlay chunks.
    return true;
}

export function createCoreServerModuleRegistry(options: CoreModuleRegistryOptions): GameModuleRegistry {
    const modules = new GameModuleRegistry();
    modules.registerModules([
        {
            id: 'core.teleport',
            register(registry) {
                registry.registerOutcomeHandler(OUTCOME_DOOR_TELEPORT, (rawCtx, rawPayload) => {
                    const ctx = decodeInboundIntentContext(rawCtx as LooseValue);
                    if (!ctx || !isRecord(rawPayload as LooseValue)) {
                        return;
                    }
                    const payload = rawPayload as JsonRecord;
                    const playerIdCandidate = payload.playerId;
                    const to = payload.to;
                    if (
                        typeof playerIdCandidate !== 'number' ||
                        !Number.isInteger(playerIdCandidate) ||
                        !isRecord(to) ||
                        typeof to.x !== 'number' ||
                        typeof to.y !== 'number'
                    ) {
                        return;
                    }
                    const playerId = entityIdFromWire(playerIdCandidate);
                    const toMapId = asNonEmptyString(payload.toMapId as LooseValue);
                    const fromMapId = asNonEmptyString(payload.fromMapId as LooseValue);
                    if (!toMapId || !fromMapId) {
                        return;
                    }
                    options.applyTeleportOutcome({
                        state: ctx.state,
                        ctx: ctx.ctx,
                        Position: ctx.Position,
                        MapId: ctx.MapId,
                        Target: ctx.Target,
                        mobAi: ctx.mobAi,
                        movement: ctx.movement,
                        replication: ctx.replication,
                        world: ctx.world,
                        playerId,
                        fromMapId,
                        toMapId,
                        to: gridPos(to.x, to.y),
                    });
                });
            },
        },
        {
            id: 'core.move',
            deps: ['core.teleport'],
            register(registry) {
                registry.registerIntentHandler(INTENT_MOVE_STEP, (rawCtx, rawPayload) => {
                    const ctx = decodeInboundIntentContext(rawCtx as LooseValue);
                    const cmd = decodeCommandByType(rawPayload as LooseValue, 'MOVE');
                    if (!ctx || !cmd) {
                        return;
                    }
                    return options.applyMoveIntentCommand({
                        state: ctx.state,
                        Position: ctx.Position,
                        MapId: ctx.MapId,
                        player: ctx.player,
                        movement: ctx.movement,
                        world: ctx.world,
                        cmd,
                    });
                });

                registry.registerIntentHandler(INTENT_MOVE_TO, (rawCtx, rawPayload) => {
                    const ctx = decodeInboundIntentContext(rawCtx as LooseValue);
                    const cmd = decodeCommandByType(rawPayload as LooseValue, 'MOVE_TO');
                    if (!ctx || !cmd) {
                        return;
                    }
                    return options.applyMoveToIntentCommand({
                        state: ctx.state,
                        Position: ctx.Position,
                        MapId: ctx.MapId,
                        Kind: ctx.replication.Kind,
                        player: ctx.player,
                        movement: ctx.movement,
                        world: ctx.world,
                        cmd,
                    });
                });

                registry.registerIntentHandler(INTENT_MOVE_INPUT, (rawCtx, rawPayload) => {
                    const ctx = decodeInboundIntentContext(rawCtx as LooseValue);
                    const cmd = decodeCommandByType(rawPayload as LooseValue, 'MOVE_INPUT');
                    if (!ctx || !cmd) {
                        return;
                    }
                    return options.applyMoveInputIntentCommand({
                        state: ctx.state,
                        player: ctx.player,
                        movement: ctx.movement,
                        cmd,
                    });
                });

                registry.registerIntentHandler(INTENT_ATTACK, () => {
                    // ATTACK is executed via the bridged command path in the command pipeline.
                    return;
                });
            },
        },
        {
            id: 'core.doors',
            deps: ['core.teleport'],
            register(registry) {
                registry.registerIntentHandler(INTENT_DOOR_TELEPORT, (rawCtx, rawPayload) => {
                    const ctx = decodeInboundIntentContext(rawCtx as LooseValue);
                    const cmd = decodeCommandByType(rawPayload as LooseValue, 'TELEPORT');
                    if (!ctx || !cmd) {
                        return;
                    }

                    const currentPos = ctx.Position.store.get(ctx.player.id) ?? gridPos(ctx.player.x, ctx.player.y);
                    const currentMapId =
                        ctx.MapId.store.get(ctx.player.id) ?? ctx.world.getDefaultMapId?.() ?? 'world_01';
                    const doorDestination =
                        ctx.world.resolveDoorTeleport?.(currentMapId, currentPos.x, currentPos.y) ?? null;
                    if (!doorDestination) {
                        return;
                    }
                    if (doorDestination.to.x !== cmd.to.x || doorDestination.to.y !== cmd.to.y) {
                        recordMapTransitionEvent(ctx.world, {
                            kind: 'reject',
                            reason: 'invalid_destination',
                            playerId: ctx.player.id,
                            fromMapId: currentMapId,
                            toMapId: doorDestination.toMapId,
                            toX: cmd.to.x,
                            toY: cmd.to.y,
                        });
                        return;
                    }
                    const isValidDestination = ctx.world.isValidPositionForMap
                        ? ctx.world.isValidPositionForMap(doorDestination.toMapId, cmd.to.x, cmd.to.y)
                        : ctx.world.isValidPosition(cmd.to.x, cmd.to.y);
                    if (!isValidDestination) {
                        recordMapTransitionEvent(ctx.world, {
                            kind: 'reject',
                            reason: 'invalid_destination',
                            playerId: ctx.player.id,
                            fromMapId: currentMapId,
                            toMapId: doorDestination.toMapId,
                            toX: cmd.to.x,
                            toY: cmd.to.y,
                        });
                        return;
                    }

                    const teleport = ctx.modules.getOutcomeHandler(OUTCOME_DOOR_TELEPORT);
                    if (!teleport) {
                        throw new Error(`Missing outcome handler: ${OUTCOME_DOOR_TELEPORT}`);
                    }
                    teleport(ctx, {
                        playerId: ctx.player.id,
                        fromMapId: currentMapId,
                        toMapId: doorDestination.toMapId,
                        to: cmd.to,
                    });
                });
            },
        },
        {
            id: 'core.tiles',
            register(registry) {
                registry.registerIntentHandler(INTENT_TILE_EDIT, (rawCtx, rawPayload) => {
                    const ctx = decodeInboundIntentContext(rawCtx as LooseValue);
                    const cmd = decodeCommandByType(rawPayload as LooseValue, 'TILE_EDIT');
                    if (!ctx || !cmd) {
                        return;
                    }
                    const actorMapId =
                        ctx.MapId.store.get(ctx.player.id) ?? ctx.world.getDefaultMapId?.() ?? 'world_01';
                    if (isTileEditOutOfBounds({ world: ctx.world, mapId: actorMapId, x: cmd.x, y: cmd.y })) {
                        return { ok: false, reason: 'TILE_EDIT:out_of_bounds' };
                    }
                    const claims = ctx.state.resources.require(CLAIMS_STORE_RESOURCE);
                    const claim = claims.getClaimAt(cmd.x, cmd.y, actorMapId);
                    const decision = canEditTile({
                        actorName: options.resolvePlayerIdentityKey(ctx.player) ?? ctx.player.name,
                        claim,
                    });
                    if (!decision.ok) {
                        return { ok: false, reason: `PERMISSION:${decision.code}` };
                    }

                    const overlays = ctx.state.resources.require(options.chunkOverlayStoreResource);
                    ctx.world.ensureChunkOverlayLoadedForTile?.(cmd.x, cmd.y, actorMapId);
                    try {
                        if (cmd.value === null) {
                            overlays.clearGlobal(cmd.x, cmd.y, actorMapId);
                        } else {
                            overlays.setGlobal(cmd.x, cmd.y, cmd.value, actorMapId);
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
                    const ctx = decodeInboundIntentContext(rawCtx as LooseValue);
                    const cmd = decodeCommandByType(rawPayload as LooseValue, 'CLAIM_CREATE');
                    if (!ctx || !cmd) {
                        return;
                    }
                    const actorMapId =
                        ctx.MapId.store.get(ctx.player.id) ?? ctx.world.getDefaultMapId?.() ?? 'world_01';
                    return applyClaimCreateIntent({
                        state: ctx.state,
                        world: ctx.world,
                        player: ctx.player,
                        cmd,
                        limits: DEFAULT_CLAIM_INTENT_CONFIG,
                        mapId: actorMapId,
                    });
                });
                registry.registerIntentHandler(INTENT_CLAIM_UPDATE, (rawCtx, rawPayload) => {
                    const ctx = decodeInboundIntentContext(rawCtx as LooseValue);
                    const cmd = decodeCommandByType(rawPayload as LooseValue, 'CLAIM_UPDATE');
                    if (!ctx || !cmd) {
                        return;
                    }
                    const actorMapId =
                        ctx.MapId.store.get(ctx.player.id) ?? ctx.world.getDefaultMapId?.() ?? 'world_01';
                    return applyClaimUpdateIntent({
                        state: ctx.state,
                        world: ctx.world,
                        player: ctx.player,
                        cmd,
                        limits: DEFAULT_CLAIM_INTENT_CONFIG,
                        mapId: actorMapId,
                    });
                });
                registry.registerIntentHandler(INTENT_CLAIM_DELETE, (rawCtx, rawPayload) => {
                    const ctx = decodeInboundIntentContext(rawCtx as LooseValue);
                    const cmd = decodeCommandByType(rawPayload as LooseValue, 'CLAIM_DELETE');
                    if (!ctx || !cmd) {
                        return;
                    }
                    const actorMapId =
                        ctx.MapId.store.get(ctx.player.id) ?? ctx.world.getDefaultMapId?.() ?? 'world_01';
                    return applyClaimDeleteIntent({
                        state: ctx.state,
                        world: ctx.world,
                        player: ctx.player,
                        cmd,
                        mapId: actorMapId,
                    });
                });
            },
        },
    ]);

    return modules;
}
