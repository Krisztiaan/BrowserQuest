import { expect, test } from 'bun:test';
import Types from '../../shared/gametypes-browser';
import Pathfinder from '../../client/pathfinder';
import { applyDynamicOccupancyOverlayToGrid } from '../../client/runtime/pathing-dynamic-occupancy';

type OccupancyRecord = {
    gridX: number;
    gridY: number;
    nextGridX: number;
    nextGridY: number;
    isMoving: boolean;
    kind: number;
    isDead: boolean;
};

function makeGrid(width: number, height: number, fill = 0): number[][] {
    const grid: number[][] = [];
    for (let y = 0; y < height; y += 1) {
        const row: number[] = [];
        for (let x = 0; x < width; x += 1) {
            row.push(fill);
        }
        grid.push(row);
    }
    return grid;
}

test('dynamic occupancy overlay blocks live entities and restores the shared grid', () => {
    const grid = makeGrid(5, 5, 0);
    const records = new Map<number, OccupancyRecord>();

    records.set(100, {
        gridX: 2,
        gridY: 2,
        nextGridX: -1,
        nextGridY: -1,
        isMoving: false,
        kind: Types.Entities.RAT,
        isDead: false,
    });
    records.set(101, {
        gridX: 2,
        gridY: 1,
        nextGridX: -1,
        nextGridY: -1,
        isMoving: false,
        kind: Types.Entities.FLASK,
        isDead: false,
    });
    records.set(102, {
        gridX: 2,
        gridY: 3,
        nextGridX: -1,
        nextGridY: -1,
        isMoving: false,
        kind: Types.Entities.RAT,
        isDead: true,
    });
    records.set(103, {
        gridX: 1,
        gridY: 1,
        nextGridX: 1,
        nextGridY: 2,
        isMoving: true,
        kind: Types.Entities.WARRIOR,
        isDead: false,
    });

    const restore = applyDynamicOccupancyOverlayToGrid({ grid, records: records.entries() });

    expect(grid[2]?.[2]).toBe(1);
    expect(grid[1]?.[2]).toBe(0); // items do not block
    expect(grid[3]?.[2]).toBe(0); // dead entities do not block
    expect(grid[1]?.[1]).toBe(1);
    expect(grid[2]?.[1]).toBe(1);

    const pathfinder = new Pathfinder(5, 5);
    const path = pathfinder.findPath(grid, { gridX: 0, gridY: 2 }, 4, 2, false);
    expect(path.some(([x, y]) => x === 2 && y === 2)).toBe(false);

    restore();
    expect(grid[2]?.[2]).toBe(0);
    expect(grid[1]?.[1]).toBe(0);
    expect(grid[2]?.[1]).toBe(0);
});
