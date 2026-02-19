import { expect, test } from 'bun:test';
import { entityIdFromWire } from '../../../shared/domain/ids';
import { gridPos } from '../../../shared/domain/positions';
import { ClientWorldKernel } from '../../../client/ecs/world-kernel';
import { runClientPlayerMoveOutboxSystem } from '../../../client/ecs/systems/client-player-move-outbox-system';
import Types from '../../../shared/gametypes-browser';

test('outbox emits exactly one clientSendMoveTo for a new move plan and marks it sent', () => {
    const kernel = new ClientWorldKernel();
    const playerId = entityIdFromWire(8101);
    const player = { gridX: 10, gridY: 10 };

    kernel.setClientMovePlan({
        requestedTo: gridPos(20, 30),
        target: gridPos(12, 10),
        steps: [gridPos(11, 10), gridPos(12, 10)],
        stopAdjacentToTarget: false,
    });

    runClientPlayerMoveOutboxSystem({
        started: true,
        kernel,
        playerId,
        player,
        isZoning: () => false,
        isZoningTile: () => false,
    });

    expect(kernel.clientMovePlan?.sent).toBe(true);
    expect(kernel.drainClientCommands()).toEqual([
        { type: 'clientSendMoveTo', x: 20, y: 30, stopAdjacentToTarget: false },
    ]);
});

test('outbox does not resend move.to when the plan is already marked sent', () => {
    const kernel = new ClientWorldKernel();
    const playerId = entityIdFromWire(8102);
    const player = { gridX: 10, gridY: 10 };

    kernel.setClientMovePlan({
        requestedTo: gridPos(15, 10),
        target: gridPos(15, 10),
        steps: [gridPos(11, 10), gridPos(15, 10)],
        stopAdjacentToTarget: false,
    });
    const plan = kernel.clientMovePlan;
    expect(plan).toBeTruthy();
    if (plan) {
        kernel.clientMovePlan = { ...plan, sent: true };
    }

    runClientPlayerMoveOutboxSystem({
        started: true,
        kernel,
        playerId,
        player,
        isZoning: () => false,
        isZoningTile: () => false,
    });

    expect(kernel.drainClientCommands()).toEqual([]);
});

test('outbox clears the plan when the player reached the target and there are no pending move seq acks', () => {
    const kernel = new ClientWorldKernel();
    const playerId = entityIdFromWire(8103);
    const player = { gridX: 12, gridY: 10 };

    kernel.setClientMovePlan({
        requestedTo: gridPos(12, 10),
        target: gridPos(12, 10),
        steps: [gridPos(11, 10), gridPos(12, 10)],
        stopAdjacentToTarget: false,
    });
    const plan = kernel.clientMovePlan;
    expect(plan).toBeTruthy();
    if (plan) {
        kernel.clientMovePlan = { ...plan, sent: true };
    }

    // Outbox uses spatial record to decide whether we are still moving.
    kernel.clientSpatialRecords.set(playerId, {
        gridX: 12,
        gridY: 10,
        nextGridX: -1,
        nextGridY: -1,
        isMoving: false,
        kind: Types.Entities.WARRIOR,
        isPlayer: true,
    });

    runClientPlayerMoveOutboxSystem({
        started: true,
        kernel,
        playerId,
        player,
        isZoning: () => false,
        isZoningTile: () => false,
    });

    expect(kernel.clientMovePlan).toBeNull();
});
