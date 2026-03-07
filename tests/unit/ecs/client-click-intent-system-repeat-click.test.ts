import { expect, test } from 'bun:test';
import { entityIdFromWire } from '../../../shared/domain/ids';
import { gridPos } from '../../../shared/domain/positions';
import Types from '../../../shared/gametypes-browser';
import { ClientWorldKernel } from '../../../client/ecs/world-kernel';
import { runClientClickIntentSystem } from '../../../client/ecs/systems/client-click-intent-system';

test('re-clicking the same tile can switch from attack to move when the target disappears', () => {
    const kernel = new ClientWorldKernel();
    const mobId = entityIdFromWire(42);

    const record = {
        gridX: 5,
        gridY: 6,
        nextGridX: 5,
        nextGridY: 6,
        isMoving: false,
        isDead: false,
        kind: Types.Entities.RAT,
        isPlayer: false,
    };

    kernel.clientSpatialRecords.set(mobId, record);
    kernel.applySpatialAddRecord(mobId, record);

    const host = {
        started: true,
        kernel,
        player: { gridX: 1, gridY: 1, isDead: false, isOnPlateau: false, nextGridX: 1, nextGridY: 1 },
        map: {
            isColliding: () => false,
            isPlateau: () => false,
        },
        isZoning: () => false,
        isZoningTile: () => false,
    };

    kernel.setClientClickIntent({ x: 5, y: 6 });
    runClientClickIntentSystem(host);
    expect(kernel.clientInteractionIntent?.kind).toBe('attack');
    kernel.drainClientCommands();

    kernel.applySpatialRemoveRecord(mobId, record);
    kernel.clientSpatialRecords.delete(mobId);

    kernel.setClientClickIntent({ x: 5, y: 6 });
    runClientClickIntentSystem(host);
    expect(kernel.drainClientCommands()).toContainEqual({ type: 'playerGoTo', x: 5, y: 6 });
});

test('re-clicking the same walkable tile enqueues movement again', () => {
    const kernel = new ClientWorldKernel();

    const host = {
        started: true,
        kernel,
        player: { gridX: 1, gridY: 1, isDead: false, isOnPlateau: false, nextGridX: 1, nextGridY: 1 },
        map: {
            isColliding: () => false,
            isPlateau: () => false,
        },
        isZoning: () => false,
        isZoningTile: () => false,
    };

    kernel.setClientClickIntent({ x: 9, y: 9 });
    runClientClickIntentSystem(host);
    expect(kernel.drainClientCommands()).toEqual([{ type: 'playerGoTo', x: 9, y: 9 }]);

    kernel.setClientClickIntent({ x: 9, y: 9 });
    runClientClickIntentSystem(host);
    expect(kernel.drainClientCommands()).toEqual([{ type: 'playerGoTo', x: 9, y: 9 }]);
});

test('re-clicking the same walkable tile while an identical plan is active does not enqueue another move', () => {
    const kernel = new ClientWorldKernel();

    const host = {
        started: true,
        kernel,
        player: { gridX: 1, gridY: 1, isDead: false, isOnPlateau: false, nextGridX: 1, nextGridY: 1 },
        map: {
            isColliding: () => false,
            isPlateau: () => false,
        },
        isZoning: () => false,
        isZoningTile: () => false,
    };

    kernel.setClientMovePlan({
        requestedTo: gridPos(9, 9),
        target: gridPos(9, 9),
        steps: [gridPos(2, 2), gridPos(9, 9)],
        stopAdjacentToTarget: false,
    });

    kernel.setClientClickIntent({ x: 9, y: 9 });
    runClientClickIntentSystem(host);
    expect(kernel.drainClientCommands()).toEqual([]);
});
