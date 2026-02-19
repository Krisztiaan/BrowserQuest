import AStar, { type AStarOptions } from '../../shared/world/pathfinding/astar';

type Grid = number[][];
type Point = readonly [number, number];

function nowMs(): number {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        return performance.now();
    }
    return Date.now();
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
    const n = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

function xorshift32(seed: number): () => number {
    let x = seed >>> 0;
    return () => {
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        return (x >>> 0) / 0xffffffff;
    };
}

function makeGrid(width: number, height: number, obstacleRate: number, seed: number): Grid {
    const rand = xorshift32(seed);
    const grid: Grid = [];
    for (let y = 0; y < height; y += 1) {
        const row: number[] = [];
        for (let x = 0; x < width; x += 1) {
            row.push(rand() < obstacleRate ? 1 : 0);
        }
        grid.push(row);
    }
    return grid;
}

function isWalkable(grid: Grid, x: number, y: number): boolean {
    const row = grid[y];
    return !!row && row[x] === 0;
}

function randomWalkablePoint(grid: Grid, width: number, height: number, rand: () => number): Point {
    for (let i = 0; i < 10_000; i += 1) {
        const x = Math.floor(rand() * width);
        const y = Math.floor(rand() * height);
        if (isWalkable(grid, x, y)) {
            return [x, y];
        }
    }
    // Extremely dense grid; fall back to origin (bench should make grid less dense).
    return [0, 0];
}

function benchOnce(opts: {
    label: string;
    grid: Grid;
    width: number;
    height: number;
    pairs: number;
    seed: number;
    variant?: AStarOptions['variant'];
}): { elapsedMs: number; totalPathPoints: number } {
    const rand = xorshift32(opts.seed);
    const pairs: Array<{ start: Point; end: Point }> = [];

    for (let i = 0; i < opts.pairs; i += 1) {
        const start = randomWalkablePoint(opts.grid, opts.width, opts.height, rand);
        const end = randomWalkablePoint(opts.grid, opts.width, opts.height, rand);
        pairs.push({ start, end });
    }

    // Warmup: 1 pass to let JIT settle.
    for (let i = 0; i < pairs.length; i += 1) {
        const p = pairs[i];
        if (!p) continue;
        AStar(opts.grid, p.start, p.end, opts.variant);
    }

    const startedAt = nowMs();
    let totalPathPoints = 0;
    for (let i = 0; i < pairs.length; i += 1) {
        const p = pairs[i];
        if (!p) continue;
        const path = AStar(opts.grid, p.start, p.end, opts.variant);
        totalPathPoints += path.length;
    }
    const elapsedMs = nowMs() - startedAt;

    return { elapsedMs, totalPathPoints };
}

const width = parsePositiveInt(process.argv[2], 128);
const height = parsePositiveInt(process.argv[3], 128);
const pairs = parsePositiveInt(process.argv[4], 800);
const obstaclePct = Number(process.argv[5] ?? '0.22');
const seed = parsePositiveInt(process.argv[6], 12345);

const obstacleRate = Number.isFinite(obstaclePct) ? Math.min(0.9, Math.max(0, obstaclePct)) : 0.22;
const grid = makeGrid(width, height, obstacleRate, seed);
const firstRow = grid[0];
if (firstRow?.[0] !== undefined) {
    firstRow[0] = 0;
}
const lastRow = grid[height - 1];
if (lastRow?.[width - 1] !== undefined) {
    lastRow[width - 1] = 0;
}

const manhattan = benchOnce({ label: 'manhattan', grid, width, height, pairs, seed: seed ^ 0xabc, variant: undefined });
const diagonal = benchOnce({ label: 'Diagonal', grid, width, height, pairs, seed: seed ^ 0xdef, variant: 'Diagonal' });

console.log(
    JSON.stringify(
        {
            bench: 'pathfinding_astar',
            grid: { width, height, obstacleRate },
            pairs,
            seed,
            variants: {
                manhattan: {
                    elapsedMs: Number(manhattan.elapsedMs.toFixed(2)),
                    avgMsPerPath: Number((manhattan.elapsedMs / pairs).toFixed(4)),
                    totalPathPoints: manhattan.totalPathPoints,
                },
                Diagonal: {
                    elapsedMs: Number(diagonal.elapsedMs.toFixed(2)),
                    avgMsPerPath: Number((diagonal.elapsedMs / pairs).toFixed(4)),
                    totalPathPoints: diagonal.totalPathPoints,
                },
            },
        },
        null,
        2
    )
);
