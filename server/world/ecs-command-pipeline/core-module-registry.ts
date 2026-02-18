import { entityIdFromWire, type EntityId } from '../../../shared/domain/ids';
import { gridPos, type GridPos } from '../../../shared/domain/positions';
import { GameModuleRegistry } from '../../../shared/modules/module-registry';
import {
    INTENT_CLAIM_CREATE,
    INTENT_CLAIM_DELETE,
    INTENT_CLAIM_UPDATE,
    INTENT_DOOR_TELEPORT,
    INTENT_MOVE_TO,
    INTENT_MOVE_STEP,
    INTENT_TILE_EDIT,
    OUTCOME_DOOR_TELEPORT,
} from '../../../shared/protocol/intents';
export {
    INTENT_CLAIM_CREATE,
    INTENT_CLAIM_DELETE,
    INTENT_CLAIM_UPDATE,
    INTENT_DOOR_TELEPORT,
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

type JsonScalar = string | number | boolean | null;
type JsonLike = JsonScalar | JsonLike[] | { [key: string]: JsonLike };
type JsonRecord = { [key: string]: JsonLike };
type LooseValue = string | number | boolean | bigint | symbol | null | undefined | object;

export type IntentWorldHost = Readonly<{
    map: {
        getDoorDestination(x: number, y: number): { x: number; y: number } | null;
        // Server-side movement intents (e.g. move.to) need collision grid + bounds, but older host
        // surfaces may omit them. Handlers must guard at runtime and reject if unavailable.
        grid?: number[][];
        width?: number;
        height?: number;
        isOutOfBounds?(x: number, y: number): boolean;
    };
    isValidPosition(x: number, y: number): boolean;
    ensureChunkOverlayLoadedForTile?(x: number, y: number): boolean;
    persistClaimUpsert?(claim: RectClaim): void;
    persistClaimDelete?(claimId: number): void;
}>;

export type InboundIntentContext = {
    modules: GameModuleRegistry;
    state: WorldState<Command, DomainEvent>;
    ctx: SystemContext;
    world: IntentWorldHost;
    player: PlayerLike;
    Position: ComponentType<GridPos>;
    Target: ComponentType<EntityId>;
    movement: ReturnType<typeof registerMovementComponents>;
    mobAi: ReturnType<typeof registerMobAiComponents>;
    replication: ReturnType<typeof registerSpawnReplicationComponents>;
};

type ApplyMoveIntentCommand = (params: {
    state: WorldState<Command, DomainEvent>;
    Position: ComponentType<GridPos>;
    player: PlayerLike;
    movement: ReturnType<typeof registerMovementComponents>;
    world: IntentWorldHost;
    cmd: Extract<Command, { type: 'MOVE' }>;
}) => { ok: false; reason: string } | void;

type ApplyMoveToIntentCommand = (params: {
    state: WorldState<Command, DomainEvent>;
    Position: ComponentType<GridPos>;
    Kind: ComponentType<EntityKind>;
    player: PlayerLike;
    movement: ReturnType<typeof registerMovementComponents>;
    world: IntentWorldHost;
    cmd: Extract<Command, { type: 'MOVE_TO' }>;
}) => { ok: false; reason: string } | void;

type ApplyTeleportOutcome = (params: {
    state: WorldState<Command, DomainEvent>;
    ctx: SystemContext;
    Position: ComponentType<GridPos>;
    Target: ComponentType<EntityId>;
    mobAi: ReturnType<typeof registerMobAiComponents>;
    movement: ReturnType<typeof registerMovementComponents>;
    replication: ReturnType<typeof registerSpawnReplicationComponents>;
    world: IntentWorldHost;
    playerId: EntityId;
    to: GridPos;
}) => void;

type CoreModuleRegistryOptions = Readonly<{
    chunkOverlayStoreResource: ResourceKey<ChunkOverlayStore>;
    resolvePlayerIdentityKey(player: PlayerLike): string | null;
    applyMoveIntentCommand: ApplyMoveIntentCommand;
    applyMoveToIntentCommand: ApplyMoveToIntentCommand;
    applyTeleportOutcome: ApplyTeleportOutcome;
}>;

function isRecord(value: LooseValue): value is JsonRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
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
                        typeof playerIdCandidate !== 'number'
                        || !Number.isInteger(playerIdCandidate)
                        || !isRecord(to)
                        || typeof to.x !== 'number'
                        || typeof to.y !== 'number'
                    ) {
                        return;
                    }
                    const playerId = entityIdFromWire(playerIdCandidate);
                    options.applyTeleportOutcome({
                        state: ctx.state,
                        ctx: ctx.ctx,
                        Position: ctx.Position,
                        Target: ctx.Target,
                        mobAi: ctx.mobAi,
                        movement: ctx.movement,
                        replication: ctx.replication,
                        world: ctx.world,
                        playerId,
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
                        Kind: ctx.replication.Kind,
                        player: ctx.player,
                        movement: ctx.movement,
                        world: ctx.world,
                        cmd,
                    });
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
                    teleport(ctx, { playerId: ctx.player.id, to: cmd.to });
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
                    const claims = ctx.state.resources.require(CLAIMS_STORE_RESOURCE);
                    const claim = claims.getClaimAt(cmd.x, cmd.y);
                    const decision = canEditTile({
                        actorName: options.resolvePlayerIdentityKey(ctx.player) ?? ctx.player.name,
                        claim,
                    });
                    if (!decision.ok) {
                        return { ok: false, reason: `PERMISSION:${decision.code}` };
                    }

                    const overlays = ctx.state.resources.require(options.chunkOverlayStoreResource);
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
                    const ctx = decodeInboundIntentContext(rawCtx as LooseValue);
                    const cmd = decodeCommandByType(rawPayload as LooseValue, 'CLAIM_CREATE');
                    if (!ctx || !cmd) {
                        return;
                    }
                    return applyClaimCreateIntent({
                        state: ctx.state,
                        world: ctx.world,
                        player: ctx.player,
                        cmd,
                        limits: DEFAULT_CLAIM_INTENT_CONFIG,
                    });
                });
                registry.registerIntentHandler(INTENT_CLAIM_UPDATE, (rawCtx, rawPayload) => {
                    const ctx = decodeInboundIntentContext(rawCtx as LooseValue);
                    const cmd = decodeCommandByType(rawPayload as LooseValue, 'CLAIM_UPDATE');
                    if (!ctx || !cmd) {
                        return;
                    }
                    return applyClaimUpdateIntent({
                        state: ctx.state,
                        world: ctx.world,
                        player: ctx.player,
                        cmd,
                        limits: DEFAULT_CLAIM_INTENT_CONFIG,
                    });
                });
                registry.registerIntentHandler(INTENT_CLAIM_DELETE, (rawCtx, rawPayload) => {
                    const ctx = decodeInboundIntentContext(rawCtx as LooseValue);
                    const cmd = decodeCommandByType(rawPayload as LooseValue, 'CLAIM_DELETE');
                    if (!ctx || !cmd) {
                        return;
                    }
                    return applyClaimDeleteIntent({ state: ctx.state, world: ctx.world, player: ctx.player, cmd });
                });
            },
        },
    ]);

    return modules;
}
