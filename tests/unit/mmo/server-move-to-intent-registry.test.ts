import { expect, test } from 'bun:test';
import { entityIdFromWire } from '../../../shared/domain/ids';
import { gridPos } from '../../../shared/domain/positions';
import { INTENT_MOVE_TO } from '../../../shared/protocol/intents';
import { createResourceKey } from '../../../server/ecs/resources';
import { WorldState } from '../../../server/ecs/world-state';
import { createCoreServerModuleRegistry } from '../../../server/world/ecs-command-pipeline/core-module-registry';

test('core module registry decodes MOVE_TO payload records for INTENT(move.to)', () => {
    const calls: Array<{ cmd: unknown }> = [];

    const modules = createCoreServerModuleRegistry({
        chunkOverlayStoreResource: createResourceKey('test.chunk_overlays'),
        resolvePlayerIdentityKey: () => null,
        applyMoveIntentCommand: () => {},
        applyMoveToIntentCommand: ({ cmd }) => {
            calls.push({ cmd });
        },
        applyTeleportOutcome: () => {},
    });

    const handler = modules.getIntentHandler(INTENT_MOVE_TO);
    expect(handler).toBeTruthy();

    const playerId = entityIdFromWire(42);
    const cmd = {
        type: 'MOVE_TO',
        source: { connectionId: 'c1', playerId },
        to: gridPos(12, 34),
        stopAdjacentToTarget: true,
    } as const;

    // NOTE: The registry's decode layer intentionally only asserts record shapes + cmd.type;
    // it casts the rest. This test checks handler wiring, not gameplay semantics.
    handler?.(
        {
            modules,
            state: new WorldState<any, any>(),
            ctx: { tick: 1 },
            world: { map: { getDoorDestination: () => null }, isValidPosition: () => true },
            player: { id: playerId, x: 0, y: 0, name: 'p' },
            Position: {},
            Target: {},
            movement: {},
            mobAi: {},
            replication: { Kind: {} },
        } as any,
        cmd as any
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]?.cmd).toEqual(cmd);
});

