import { expect, test } from 'bun:test';
import { ClientWorldKernel } from '../../../client/ecs/world-kernel';
import { runClientClickIntentSystem } from '../../../client/ecs/systems/client-click-intent-system';

test('click intent snaps colliding door-adjacent clicks onto the door tile', () => {
    const kernel = new ClientWorldKernel();
    kernel.setClientClickIntent({ x: 5, y: 5 });

    runClientClickIntentSystem({
        started: true,
        kernel,
        player: { gridX: 1, gridY: 1, isDead: false, isOnPlateau: false, nextGridX: 10, nextGridY: 10 },
        map: {
            isColliding: (x, y) => x === 5 && y === 5,
            isPlateau: () => false,
            isDoor: (x, y) => x === 6 && y === 5,
        },
        isZoning: () => false,
        isZoningTile: () => false,
    });

    expect(kernel.drainClientCommands()).toContainEqual({ type: 'playerGoTo', x: 6, y: 5 });
});

test('click intent allows clicking directly on a colliding door tile', () => {
    const kernel = new ClientWorldKernel();
    kernel.setClientClickIntent({ x: 7, y: 9 });

    runClientClickIntentSystem({
        started: true,
        kernel,
        player: { gridX: 1, gridY: 1, isDead: false, isOnPlateau: false, nextGridX: 10, nextGridY: 10 },
        map: {
            isColliding: (x, y) => x === 7 && y === 9,
            isPlateau: () => false,
            isDoor: (x, y) => x === 7 && y === 9,
        },
        isZoning: () => false,
        isZoningTile: () => false,
    });

    expect(kernel.drainClientCommands()).toContainEqual({ type: 'playerGoTo', x: 7, y: 9 });
});

test('clicking a door tile while standing on it arms door traversal', () => {
    const kernel = new ClientWorldKernel();
    kernel.setClientClickIntent({ x: 3, y: 4 });

    runClientClickIntentSystem({
        started: true,
        kernel,
        player: { gridX: 3, gridY: 4, isDead: false, isOnPlateau: false, nextGridX: 3, nextGridY: 4 },
        map: {
            isColliding: () => false,
            isPlateau: () => false,
            isDoor: (x, y) => x === 3 && y === 4,
        },
        isZoning: () => false,
        isZoningTile: () => false,
    });

    expect(kernel.clientDoorTraversalArmed).toBe(true);
    expect(kernel.drainClientCommands()).toEqual([]);
});
