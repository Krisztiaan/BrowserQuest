type PathPoint = [number, number];
type PathGrid = ReadonlyArray<ReadonlyArray<number>>;

type DistanceMode = 'manhattan' | 'diagonal' | 'euclidean';
type DiagonalMode = 'none' | 'constrained' | 'free';

type AStarVariant = 'Diagonal' | 'DiagonalFree' | 'Euclidean' | 'EuclideanFree';

export type AStarOptions = Readonly<{
    variant?: AStarVariant;
    maxVisited?: number;
}>;

function isWalkable(grid: PathGrid, x: number, y: number): boolean {
    const row = grid[y];
    return !!row && row[x] === 0;
}

function inBounds(x: number, y: number, rows: number, cols: number): boolean {
    return x >= 0 && y >= 0 && x < cols && y < rows;
}

function resolveDistanceMode(variant: AStarVariant | undefined): DistanceMode {
    if (variant === 'Diagonal' || variant === 'DiagonalFree') {
        return 'diagonal';
    }
    if (variant === 'Euclidean' || variant === 'EuclideanFree') {
        return 'euclidean';
    }
    return 'manhattan';
}

function resolveDiagonalMode(variant: AStarVariant | undefined): DiagonalMode {
    if (variant === 'Diagonal' || variant === 'Euclidean') {
        return 'constrained';
    }
    if (variant === 'DiagonalFree' || variant === 'EuclideanFree') {
        return 'free';
    }
    return 'none';
}

function decodeOptions(variantOrOptions?: AStarVariant | AStarOptions): AStarOptions {
    if (!variantOrOptions) {
        return {};
    }
    if (typeof variantOrOptions === 'object') {
        return variantOrOptions;
    }
    return { variant: variantOrOptions };
}

function heuristicDistance(mode: DistanceMode, x: number, y: number, endX: number, endY: number): number {
    const dx = Math.abs(x - endX);
    const dy = Math.abs(y - endY);
    if (mode === 'diagonal') {
        return Math.max(dx, dy);
    }
    if (mode === 'euclidean') {
        return Math.sqrt(dx * dx + dy * dy);
    }
    return dx + dy;
}

type HeapEntry = { v: number; f: number; seq: number };

class MinHeap {
    #v: number[] = [];
    #f: number[] = [];
    #seq: number[] = [];

    get size(): number {
        return this.#v.length;
    }

    push(entry: HeapEntry): void {
        const i = this.#v.length;
        this.#v.push(entry.v);
        this.#f.push(entry.f);
        this.#seq.push(entry.seq);
        this.#bubbleUp(i);
    }

    pop(): HeapEntry | null {
        const n = this.#v.length;
        if (n === 0) {
            return null;
        }
        const v = this.#v[0] as number;
        const f = this.#f[0] as number;
        const seq = this.#seq[0] as number;

        const last = n - 1;
        if (last === 0) {
            this.#v.pop();
            this.#f.pop();
            this.#seq.pop();
            return { v, f, seq };
        }

        this.#v[0] = this.#v[last] as number;
        this.#f[0] = this.#f[last] as number;
        this.#seq[0] = this.#seq[last] as number;
        this.#v.pop();
        this.#f.pop();
        this.#seq.pop();
        this.#sinkDown(0);

        return { v, f, seq };
    }

    #less(i: number, j: number): boolean {
        const fi = this.#f[i] as number;
        const fj = this.#f[j] as number;
        if (fi < fj) return true;
        if (fi > fj) return false;
        return (this.#seq[i] as number) < (this.#seq[j] as number);
    }

    #swap(i: number, j: number): void {
        let tmp = this.#v[i] as number;
        this.#v[i] = this.#v[j] as number;
        this.#v[j] = tmp;

        tmp = this.#f[i] as number;
        this.#f[i] = this.#f[j] as number;
        this.#f[j] = tmp;

        tmp = this.#seq[i] as number;
        this.#seq[i] = this.#seq[j] as number;
        this.#seq[j] = tmp;
    }

    #bubbleUp(index: number): void {
        let i = index;
        while (i > 0) {
            const p = ((i - 1) / 2) | 0;
            if (!this.#less(i, p)) {
                break;
            }
            this.#swap(i, p);
            i = p;
        }
    }

    #sinkDown(index: number): void {
        let i = index;
        for (;;) {
            const left = i * 2 + 1;
            const right = left + 1;
            let smallest = i;

            if (left < this.#v.length && this.#less(left, smallest)) {
                smallest = left;
            }
            if (right < this.#v.length && this.#less(right, smallest)) {
                smallest = right;
            }
            if (smallest === i) {
                break;
            }
            this.#swap(i, smallest);
            i = smallest;
        }
    }
}

function reconstructPath(parent: Int32Array, cols: number, endV: number): PathPoint[] {
    const result: PathPoint[] = [];
    let v = endV;
    while (v >= 0) {
        const x = v % cols;
        const y = (v / cols) | 0;
        result.push([x, y]);
        v = parent[v] as number;
    }
    result.reverse();
    return result;
}

function AStar(
    grid: PathGrid,
    start: readonly [number, number],
    end: readonly [number, number],
    variantOrOptions?: AStarVariant | AStarOptions
): PathPoint[] {
    const rows = grid.length;
    const cols = grid[0]?.length ?? 0;
    if (rows === 0 || cols === 0) {
        return [];
    }

    const options = decodeOptions(variantOrOptions);
    const distanceMode = resolveDistanceMode(options.variant);
    const diagonalMode = resolveDiagonalMode(options.variant);
    const maxVisited = options.maxVisited;

    const startX = start[0];
    const startY = start[1];
    const endX = end[0];
    const endY = end[1];

    if (
        !inBounds(startX, startY, rows, cols) ||
        !inBounds(endX, endY, rows, cols) ||
        !isWalkable(grid, startX, startY) ||
        !isWalkable(grid, endX, endY)
    ) {
        return [];
    }

    const startV = startX + startY * cols;
    const endV = endX + endY * cols;
    if (startV === endV) {
        return [[startX, startY]];
    }

    const limit = cols * rows;
    const state = new Uint8Array(limit); // 0=unseen, 1=open, 2=closed
    const gScore = new Float64Array(limit);
    const parent = new Int32Array(limit);
    parent[startV] = -1;
    gScore[startV] = 0;
    state[startV] = 1;

    const open = new MinHeap();
    let seq = 0;
    open.push({ v: startV, f: heuristicDistance(distanceMode, startX, startY, endX, endY), seq: seq++ });

    let visited = 0;
    while (open.size > 0) {
        const currentEntry = open.pop();
        if (!currentEntry) {
            break;
        }

        const currentV = currentEntry.v;
        if (state[currentV] === 2) {
            continue; // stale heap entry
        }
        state[currentV] = 2;
        visited += 1;

        if (typeof maxVisited === 'number' && Number.isFinite(maxVisited) && visited > maxVisited) {
            return [];
        }

        if (currentV === endV) {
            return reconstructPath(parent, cols, endV);
        }

        const x = currentV % cols;
        const y = (currentV / cols) | 0;
        const g = gScore[currentV] as number;

        const northY = y - 1;
        const southY = y + 1;
        const eastX = x + 1;
        const westX = x - 1;

        const north = northY >= 0 && isWalkable(grid, x, northY);
        const south = southY < rows && isWalkable(grid, x, southY);
        const east = eastX < cols && isWalkable(grid, eastX, y);
        const west = westX >= 0 && isWalkable(grid, westX, y);

        const relax = (nx: number, ny: number, isDiag: boolean): void => {
            const nv = nx + ny * cols;
            if (state[nv] === 2) {
                return;
            }
            const step = distanceMode === 'euclidean' && isDiag ? Math.SQRT2 : 1;
            const tentative = g + step;
            if (state[nv] === 0 || tentative < (gScore[nv] as number)) {
                gScore[nv] = tentative;
                parent[nv] = currentV;
                state[nv] = 1;
                const f = tentative + heuristicDistance(distanceMode, nx, ny, endX, endY);
                open.push({ v: nv, f, seq: seq++ });
            }
        };

        if (north) relax(x, northY, false);
        if (east) relax(eastX, y, false);
        if (south) relax(x, southY, false);
        if (west) relax(westX, y, false);

        if (diagonalMode === 'none') {
            continue;
        }

        const canUseDiag = (diagX: number, diagY: number): boolean => {
            if (!inBounds(diagX, diagY, rows, cols)) {
                return false;
            }
            return isWalkable(grid, diagX, diagY);
        };

        if (diagonalMode === 'constrained') {
            if (north && east && canUseDiag(eastX, northY)) relax(eastX, northY, true);
            if (north && west && canUseDiag(westX, northY)) relax(westX, northY, true);
            if (south && east && canUseDiag(eastX, southY)) relax(eastX, southY, true);
            if (south && west && canUseDiag(westX, southY)) relax(westX, southY, true);
            continue;
        }

        if (canUseDiag(eastX, northY)) relax(eastX, northY, true);
        if (canUseDiag(westX, northY)) relax(westX, northY, true);
        if (canUseDiag(eastX, southY)) relax(eastX, southY, true);
        if (canUseDiag(westX, southY)) relax(westX, southY, true);
    }

    return [];
}

export default AStar;
