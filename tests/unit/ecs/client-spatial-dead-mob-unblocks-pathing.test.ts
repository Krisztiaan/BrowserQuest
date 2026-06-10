import { expect, test } from 'bun:test';
import Types from '../../../shared/gametypes-browser';
import { entityIdFromWire } from '../../../shared/domain/ids';
import { ClientWorldKernel } from '../../../client/ecs/world-kernel';
import { runClientCommandApplySystem } from '../../../client/ecs/systems/client-command-apply-system';

function createEmptyGrid(width: number, height: number): number[][] {
    const grid: number[][] = [];
    for (let y = 0; y < height; y += 1) {
        grid[y] = [];
        for (let x = 0; x < width; x += 1) {
            grid[y][x] = 0;
        }
    }
    return grid;
}

test('dead mobs stop blocking dynamic pathing immediately on spatial record update', () => {
    const kernel = new ClientWorldKernel();
    const mobId = entityIdFromWire(123);

    const grid = createEmptyGrid(10, 10);
    const map = {
        grid,
        isOutOfBounds(x: number, y: number) {
            return x < 0 || y < 0 || x >= 10 || y >= 10;
        },
    };

    const aliveRecord = {
        gridX: 5,
        gridY: 6,
        nextGridX: -1,
        nextGridY: -1,
        isMoving: false,
        isDead: false,
        kind: Types.Entities.RAT,
        isPlayer: false,
    } as const;

    kernel.enqueueClientCommand({ type: 'spatialAddRecord', entityId: mobId, record: aliveRecord });

    const host = {
        kernel,
        map,
        entities: {},
        started: false,
        client: null,
        playerId: null,
        player: null,
    } as Parameters<typeof runClientCommandApplySystem>[0];

    runClientCommandApplySystem(host);

    expect(kernel.clientPathingGrid?.[6]?.[5]).toBe(1);

    const deadRecord = { ...aliveRecord, isDead: true } as const;
    kernel.enqueueClientCommand({ type: 'spatialRemoveRecord', entityId: mobId, record: aliveRecord });
    kernel.enqueueClientCommand({ type: 'spatialAddRecord', entityId: mobId, record: deadRecord });

    runClientCommandApplySystem(host);

    expect(kernel.clientPathingGrid?.[6]?.[5]).toBe(0);
});
