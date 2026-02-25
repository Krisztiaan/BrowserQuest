import { expect, test } from 'bun:test';
import { gridPos } from '../../../shared/domain/positions';
import { INTENT_MOVE_TO } from '../../../shared/protocol/intents';
import { createResourceKey } from '../../../server/ecs/resources';
import { WorldState } from '../../../server/ecs/world-state';
import { SparseSetStore } from '../../../server/ecs/component-store';
import { registerMobAiComponents } from '../../../server/ecs/mob-ai-components';
import { registerMovementComponents } from '../../../server/ecs/movement-components';
import type { Command } from '../../../server/ecs/commands';
import type { DomainEvent } from '../../../server/ecs/events';
import {
    createCoreServerModuleRegistry,
    type InboundIntentContext,
} from '../../../server/world/ecs-command-pipeline/core-module-registry';
import { registerSpawnReplicationComponents } from '../../../server/replication/spawn-replication';
import Types from '../../../shared/gametypes-browser';
import type { EntityId } from '../../../shared/domain/ids';
import type { PlayerLike } from '../../../server/world/player-like';

test('core module registry decodes MOVE_TO payload records for INTENT(move.to)', () => {
    const calls: Array<{ cmd: unknown }> = [];

    const modules = createCoreServerModuleRegistry({
        chunkOverlayStoreResource: createResourceKey('test.chunk_overlays'),
        resolvePlayerIdentityKey: () => null,
        applyMoveIntentCommand: () => {},
        applyMoveToIntentCommand: ({ cmd }) => {
            calls.push({ cmd });
        },
        applyMoveInputIntentCommand: () => {},
        applyTeleportOutcome: () => {},
    });

    const handler = modules.getIntentHandler(INTENT_MOVE_TO);
    expect(handler).toBeTruthy();

    function makePlayerLike(id: EntityId, x: number, y: number): PlayerLike {
        function on(eventName: 'move', callback: (x: number, y: number) => void): void;
        function on(eventName: 'lootMove', callback: (x: number, y: number) => void): void;
        function on(eventName: 'exit', callback: () => void): void;
        function on(
            _eventName: 'move' | 'lootMove' | 'exit',
            _callback: ((x: number, y: number) => void) | (() => void)
        ): void {
            // no-op for unit tests
        }

        function emit(eventName: 'exit'): void;
        function emit(eventName: 'zone'): void;
        function emit(eventName: 'move', x: number, y: number): void;
        function emit(eventName: 'lootMove', x: number, y: number): void;
        function emit(_eventName: 'exit' | 'zone' | 'move' | 'lootMove', _x?: number, _y?: number): void {
            // no-op for unit tests
        }

        const player: PlayerLike = {
            id,
            x,
            y,
            kind: Types.Entities.WARRIOR,
            name: 'p',
            orientation: Types.Orientations.DOWN,
            armor: Types.Entities.CLOTHARMOR,
            weapon: Types.Entities.SWORD1,
            armorLevel: 1,
            weaponLevel: 1,
            maxHitPoints: 100,
            hitPoints: 100,
            hasEnteredGame: true,
            isDead: false,
            lastCheckpoint: null,
            setPositionResolver: () => {},
            on,
            updatePosition: () => {},
            setPosition: (nx, ny) => {
                player.x = nx;
                player.y = ny;
            },
            setTarget: () => {},
            clearTarget: () => {},
            emit,
        };
        return player;
    }

    const state = new WorldState<Command, DomainEvent>();
    const replication = registerSpawnReplicationComponents(state.world);
    const movement = registerMovementComponents(state.world);
    const mobAi = registerMobAiComponents(state.world);
    const MapId = state.world.components.register('MapId', new SparseSetStore<string>());

    const playerId = state.world.createEntity();
    const player = makePlayerLike(playerId, 0, 0);
    state.world.addComponent(playerId, replication.Position, gridPos(0, 0));
    state.world.addComponent(playerId, replication.Kind, Types.Entities.WARRIOR);

    const ctx: InboundIntentContext = {
        modules,
        state,
        ctx: { tick: 1 },
        world: { map: { getDoorDestination: () => null }, isValidPosition: () => true },
        player,
        Position: replication.Position,
        MapId,
        Target: replication.Target,
        movement,
        mobAi,
        replication,
    };

    const cmd = {
        type: 'MOVE_TO',
        source: { connectionId: 'c1', playerId },
        to: gridPos(12, 34),
        stopAdjacentToTarget: true,
    } satisfies Extract<Command, { type: 'MOVE_TO' }>;

    // NOTE: The registry's decode layer intentionally only asserts record shapes + cmd.type; this is wiring-only.
    handler?.(ctx, cmd);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.cmd).toEqual(cmd);
});
