import { expect, test } from 'bun:test';
import Pathfinder from '../../../client/pathfinder';
import { gridPos } from '../../../shared/domain/positions';
import { findBestPathToCandidates, resolveMoveToTargetCandidates } from '../../../shared/world/move-to-planning';

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

test('resolveMoveToTargetCandidates returns 8-neighbor candidates when stopAdjacentToTarget is true', () => {
    const to = gridPos(10, 20);
    const candidates = resolveMoveToTargetCandidates({
        isOutOfBounds: () => false,
        to,
        stopAdjacentToTarget: true,
    });

    expect(candidates).toHaveLength(8);
    const asSet = new Set(candidates.map((p) => `${p.x},${p.y}`));
    expect(asSet.has('11,20')).toBe(true);
    expect(asSet.has('9,20')).toBe(true);
    expect(asSet.has('10,21')).toBe(true);
    expect(asSet.has('10,19')).toBe(true);
    expect(asSet.has('11,21')).toBe(true);
    expect(asSet.has('11,19')).toBe(true);
    expect(asSet.has('9,21')).toBe(true);
    expect(asSet.has('9,19')).toBe(true);
});

test('findBestPathToCandidates can choose a diagonal-adjacent stop tile when all cardinal adjacencies are blocked', () => {
    const width = 5;
    const height = 5;
    const grid = makeGrid(width, height, 0);

    // Target at (2,2). Block all four cardinals around it.
    grid[2]![3] = 1;
    grid[2]![1] = 1;
    grid[3]![2] = 1;
    grid[1]![2] = 1;

    // Of the four diagonal candidates, leave only (1,1) reachable.
    grid[3]![3] = 1;
    grid[1]![3] = 1;
    grid[3]![1] = 1;
    // grid[1]![1] remains free

    const to = gridPos(2, 2);
    const candidates = resolveMoveToTargetCandidates({
        isOutOfBounds: (x, y) => x < 0 || y < 0 || x >= width || y >= height,
        to,
        stopAdjacentToTarget: true,
    });

    const pathfinder = new Pathfinder(width, height);
    const best = findBestPathToCandidates({
        candidates,
        findPathTo: (x, y) => pathfinder.findPath(grid, { gridX: 0, gridY: 0 }, x, y, false),
    });

    expect(best).not.toBeNull();
    expect(best!.at(-1)).toEqual([1, 1]);
});

