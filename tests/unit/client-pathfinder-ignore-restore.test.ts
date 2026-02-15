import { expect, test } from 'bun:test';
import Pathfinder from '../../client/pathfinder';

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

test('Pathfinder.clearIgnoreList restores original values (does not poison grid)', () => {
    const grid = makeGrid(5, 5, 0);
    const pathfinder = new Pathfinder(5, 5);

    const entity = { gridX: 2, gridY: 2 };
    pathfinder.ignoreEntity(entity);
    pathfinder.findPath(grid, entity, 4, 4, false);
    pathfinder.clearIgnoreList();

    expect(grid[2]?.[2]).toBe(0);
});

test('Pathfinder.clearIgnoreList restores blocked cells back to blocked', () => {
    const grid = makeGrid(5, 5, 0);
    grid[4][4] = 1;

    const pathfinder = new Pathfinder(5, 5);
    const entity = { gridX: 2, gridY: 2 };
    const target = { gridX: 4, gridY: 4 };

    pathfinder.ignoreEntity(entity);
    pathfinder.ignoreEntity(target);
    pathfinder.findPath(grid, entity, 4, 4, false);
    pathfinder.clearIgnoreList();

    expect(grid[2]?.[2]).toBe(0);
    expect(grid[4]?.[4]).toBe(1);
});

