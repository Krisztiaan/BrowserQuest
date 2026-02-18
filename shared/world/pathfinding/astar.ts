type GridPoint = Readonly<{ x: number; y: number }>;
type GridNode = GridPoint & {
    f: number;
    g: number;
    v: number;
    p?: GridNode;
};

type PathPoint = [number, number];
type PathGrid = ReadonlyArray<ReadonlyArray<number>>;
type DistanceMode = 'manhattan' | 'diagonal' | 'euclidean';
type DiagonalMode = 'none' | 'constrained' | 'free';

type AStarVariant = 'Diagonal' | 'DiagonalFree' | 'Euclidean' | 'EuclideanFree';

export type AStarOptions = Readonly<{
    variant?: AStarVariant | string;
    maxVisited?: number;
}>;

function isWalkable(grid: PathGrid, x: number, y: number): boolean {
    const row = grid[y];
    return !!row && row[x] === 0;
}

function inBounds(x: number, y: number, rows: number, cols: number): boolean {
    return x >= 0 && y >= 0 && x < cols && y < rows;
}

function resolveDistanceMode(variant: string | undefined): DistanceMode {
    if (variant === 'Diagonal' || variant === 'DiagonalFree') {
        return 'diagonal';
    }
    if (variant === 'Euclidean' || variant === 'EuclideanFree') {
        return 'euclidean';
    }
    return 'manhattan';
}

function resolveDiagonalMode(variant: string | undefined): DiagonalMode {
    if (variant === 'Diagonal' || variant === 'Euclidean') {
        return 'constrained';
    }
    if (variant === 'DiagonalFree' || variant === 'EuclideanFree') {
        return 'free';
    }
    return 'none';
}

function distance(a: GridPoint, b: GridPoint, mode: DistanceMode): number {
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    if (mode === 'diagonal') {
        return Math.max(dx, dy);
    }
    if (mode === 'euclidean') {
        return Math.sqrt(dx * dx + dy * dy);
    }
    return dx + dy;
}

function collectSuccessors(
    grid: PathGrid,
    current: GridPoint,
    rows: number,
    cols: number,
    diagonalMode: DiagonalMode
): GridPoint[] {
    const { x, y } = current;
    const result: GridPoint[] = [];

    const northY = y - 1;
    const southY = y + 1;
    const eastX = x + 1;
    const westX = x - 1;

    const north = northY >= 0 && isWalkable(grid, x, northY);
    const south = southY < rows && isWalkable(grid, x, southY);
    const east = eastX < cols && isWalkable(grid, eastX, y);
    const west = westX >= 0 && isWalkable(grid, westX, y);

    if (north) {
        result.push({ x, y: northY });
    }
    if (east) {
        result.push({ x: eastX, y });
    }
    if (south) {
        result.push({ x, y: southY });
    }
    if (west) {
        result.push({ x: westX, y });
    }

    if (diagonalMode === 'none') {
        return result;
    }

    const canUse = (diagX: number, diagY: number): boolean => {
        if (!inBounds(diagX, diagY, rows, cols)) {
            return false;
        }
        return isWalkable(grid, diagX, diagY);
    };

    if (diagonalMode === 'constrained') {
        if (north && east && canUse(eastX, northY)) {
            result.push({ x: eastX, y: northY });
        }
        if (north && west && canUse(westX, northY)) {
            result.push({ x: westX, y: northY });
        }
        if (south && east && canUse(eastX, southY)) {
            result.push({ x: eastX, y: southY });
        }
        if (south && west && canUse(westX, southY)) {
            result.push({ x: westX, y: southY });
        }
        return result;
    }

    if (canUse(eastX, northY)) {
        result.push({ x: eastX, y: northY });
    }
    if (canUse(westX, northY)) {
        result.push({ x: westX, y: northY });
    }
    if (canUse(eastX, southY)) {
        result.push({ x: eastX, y: southY });
    }
    if (canUse(westX, southY)) {
        result.push({ x: westX, y: southY });
    }

    return result;
}

function reconstructPath(node: GridNode): PathPoint[] {
    const result: PathPoint[] = [];
    let current: GridNode | undefined = node;

    while (current) {
        result.push([current.x, current.y]);
        current = current.p;
    }

    result.reverse();
    return result;
}

function decodeOptions(variantOrOptions?: AStarVariant | string | AStarOptions): AStarOptions {
    if (!variantOrOptions) {
        return {};
    }
    if (typeof variantOrOptions === 'object') {
        return variantOrOptions;
    }
    return { variant: variantOrOptions };
}

function AStar(
    grid: PathGrid,
    start: readonly [number, number],
    end: readonly [number, number],
    variantOrOptions?: AStarVariant | string | AStarOptions
): PathPoint[] {
    const rows = grid.length;
    const cols = grid[0]?.length ?? 0;

    if (rows === 0 || cols === 0) {
        return [];
    }

    const options = decodeOptions(variantOrOptions);

    const startNode: GridPoint = { x: start[0], y: start[1] };
    const endNode: GridPoint = { x: end[0], y: end[1] };

    if (
        !inBounds(startNode.x, startNode.y, rows, cols)
        || !inBounds(endNode.x, endNode.y, rows, cols)
        || !isWalkable(grid, startNode.x, startNode.y)
        || !isWalkable(grid, endNode.x, endNode.y)
    ) {
        return [];
    }

    const limit = cols * rows;
    const distanceMode = resolveDistanceMode(options.variant);
    const diagonalMode = resolveDiagonalMode(options.variant);
    const maxVisited = options.maxVisited;

    const open: GridNode[] = [
        {
            x: startNode.x,
            y: startNode.y,
            f: 0,
            g: 0,
            v: startNode.x + startNode.y * cols,
        },
    ];
    const visited = new Set<number>();
    const endV = endNode.x + endNode.y * cols;

    while (open.length > 0) {
        if (typeof maxVisited === 'number' && Number.isFinite(maxVisited) && visited.size > maxVisited) {
            return [];
        }

        let minIndex = 0;
        let minScore = limit;
        for (let i = 0; i < open.length; i += 1) {
            const node = open[i];
            if (node && node.f < minScore) {
                minScore = node.f;
                minIndex = i;
            }
        }

        const current = open.splice(minIndex, 1)[0];
        if (!current) {
            continue;
        }

        if (current.v === endV) {
            return reconstructPath(current);
        }

        const next = collectSuccessors(grid, current, rows, cols, diagonalMode);
        for (let i = 0; i < next.length; i += 1) {
            const adj = next[i];
            if (!adj) {
                continue;
            }
            const v = adj.x + adj.y * cols;
            if (visited.has(v)) {
                continue;
            }

            const g = current.g + distance(adj, current, distanceMode);
            const f = g + distance(adj, endNode, distanceMode);
            open.push({ x: adj.x, y: adj.y, g, f, v, p: current });
            visited.add(v);
        }
    }

    return [];
}

export default AStar;

