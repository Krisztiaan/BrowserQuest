import { expect, test } from 'bun:test';
import { validateReachability } from '../../../tools/content/world-map-validator';

// 5x5 grid; border cells blocked, interior open except (2,2).
const W = 5;
const H = 5;
const collisions: number[] = [];
for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
        if (x === 0 || y === 0 || x === W - 1 || y === H - 1 || (x === 2 && y === 2)) {
            collisions.push(y * W + x);
        }
    }
}

const base = {
    width: W,
    height: H,
    collisions,
    doors: [] as Array<{ x: number; y: number; tx: number; ty: number }>,
    checkpoints: [] as Array<{ x: number; y: number; w: number; h: number }>,
    chestSpawns: [] as Array<{ x: number; y: number }>,
    resourceNodes: [] as Array<{ x: number; y: number }>,
    roamingAreas: [] as Array<{ x: number; y: number; width: number; height: number; mobKind?: string }>,
};

test('validateReachability passes for well-placed objects', () => {
    const problems = validateReachability({
        ...base,
        doors: [{ x: 1, y: 1, tx: 3, ty: 3 }],
        checkpoints: [{ x: 1, y: 1, w: 2, h: 2 }],
        chestSpawns: [{ x: 3, y: 1 }],
        resourceNodes: [{ x: 2, y: 2 }], // node itself blocked is fine; (2,1) etc. adjacent walkable
        roamingAreas: [{ x: 1, y: 1, width: 3, height: 3 }],
    });
    expect(problems).toEqual([]);
});

test('validateReachability flags doors on blocked tiles and blocked destinations', () => {
    const problems = validateReachability({
        ...base,
        doors: [
            { x: 0, y: 0, tx: 1, ty: 1 },
            { x: 1, y: 1, tx: 2, ty: 2 },
            { x: 3, y: 1, tx: 9, ty: 9 },
        ],
    });
    expect(problems.some((p) => p.includes('door at (0,0)'))).toBe(true);
    expect(problems.some((p) => p.includes('destination (2,2)'))).toBe(true);
    expect(problems.some((p) => p.includes('destination (9,9)'))).toBe(true);
});

test('validateReachability flags fully blocked checkpoints and roaming areas', () => {
    const problems = validateReachability({
        ...base,
        checkpoints: [{ x: 0, y: 0, w: 1, h: 1 }],
        roamingAreas: [{ x: 2, y: 2, width: 1, height: 1, mobKind: 'rat' }],
    });
    expect(problems.some((p) => p.includes('checkpoint at (0,0)'))).toBe(true);
    expect(problems.some((p) => p.includes('roaming area'))).toBe(true);
});

test('validateReachability flags chest spawns on blocked tiles and unreachable resource nodes', () => {
    const blockedAround = [...collisions];
    // wall in (3,3) neighbours so a node there has no walkable adjacency
    for (const [x, y] of [
        [3, 2],
        [3, 4],
        [2, 3],
        [4, 3],
    ] as const) {
        blockedAround.push(y * W + x);
    }
    const problems = validateReachability({
        ...base,
        collisions: blockedAround,
        chestSpawns: [{ x: 2, y: 2 }],
        resourceNodes: [{ x: 3, y: 3 }],
    });
    expect(problems.some((p) => p.includes('chest spawn at (2,2)'))).toBe(true);
    expect(problems.some((p) => p.includes('resource node at (3,3)'))).toBe(true);
});
