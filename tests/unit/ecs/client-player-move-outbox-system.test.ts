import { expect, test } from 'bun:test';
import { entityIdFromWire } from '../../../shared/domain/ids';
import { gridPos } from '../../../shared/domain/positions';
import { ClientWorldKernel } from '../../../client/ecs/world-kernel';
import { runClientPlayerMoveOutboxSystem } from '../../../client/ecs/systems/client-player-move-outbox-system';

test('outbox sends at most two queued steps per frame', () => {
    const kernel = new ClientWorldKernel();
    const playerId = entityIdFromWire(8101);
    const player = { gridX: 10, gridY: 10 };

    kernel.setClientMovePlan({
        target: gridPos(13, 10),
        steps: [gridPos(11, 10), gridPos(12, 10), gridPos(13, 10)],
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

    expect(kernel.clientPendingMoveAcks).toEqual([gridPos(11, 10), gridPos(12, 10)]);
    expect(kernel.clientMovePlan?.nextStepIndex).toBe(2);
    expect(kernel.drainClientCommands()).toEqual([{ type: 'clientSendMove', x: 11, y: 10 }, { type: 'clientSendMove', x: 12, y: 10 }]);
});

test('outbox pauses invalid non-adjacent plan step without clearing plan', () => {
    const kernel = new ClientWorldKernel();
    const playerId = entityIdFromWire(8102);
    const player = { gridX: 10, gridY: 10 };

    kernel.setClientMovePlan({
        target: gridPos(12, 10),
        steps: [gridPos(12, 10)],
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

    expect(kernel.clientMovePlan).not.toBeNull();
    expect(kernel.clientMovePlan?.nextStepIndex).toBe(0);
    expect(kernel.clientPendingMoveAcks.length).toBe(0);
    expect(kernel.drainClientCommands()).toEqual([]);
});

test('outbox skips duplicate baseline step and advances to next valid step', () => {
    const kernel = new ClientWorldKernel();
    const playerId = entityIdFromWire(8103);
    const player = { gridX: 11, gridY: 10 };

    kernel.setClientMovePlan({
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

    expect(kernel.clientPendingMoveAcks).toEqual([gridPos(12, 10)]);
    expect(kernel.clientMovePlan?.nextStepIndex).toBe(2);
    expect(kernel.drainClientCommands()).toEqual([{ type: 'clientSendMove', x: 12, y: 10 }]);
});

test('outbox uses authoritative kernel position baseline when rendered player position lags', () => {
    const kernel = new ClientWorldKernel();
    const playerId = entityIdFromWire(8104);
    const player = { gridX: 10, gridY: 10 };

    kernel.position.set(playerId, gridPos(11, 10));
    kernel.setClientMovePlan({
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

    expect(kernel.clientPendingMoveAcks).toEqual([gridPos(12, 10)]);
    expect(kernel.clientMovePlan?.nextStepIndex).toBe(2);
    expect(kernel.drainClientCommands()).toEqual([{ type: 'clientSendMove', x: 12, y: 10 }]);
});
