import AStar, { type AStarOptions } from './astar';

type GridPoint = [number, number];
type GridPath = GridPoint[];
type PathCandidatePoint = readonly [number, number] | readonly number[];
type PathCandidate = readonly PathCandidatePoint[] | null | undefined;

export type PathEntity = Readonly<{
    gridX: number;
    gridY: number;
    isMoving?: () => boolean;
    nextGridX?: number;
    nextGridY?: number;
}>;

type FindPathOptions = Readonly<{
    maxVisited?: number;
    // Keep this as an AStar option surface so client/server can share planning semantics.
    variant?: AStarOptions['variant'];
}>;

const isGridPoint = (point: PathCandidatePoint): point is GridPoint =>
    Array.isArray(point) && point.length === 2 && typeof point[0] === 'number' && typeof point[1] === 'number';

const toGridPath = (value: PathCandidate): GridPath => (Array.isArray(value) ? value.filter(isGridPoint) : []);

function expandDiagonalSteps(path: GridPath): GridPath {
    if (path.length <= 1) {
        return path;
    }
    const expanded: GridPath = [path[0] as GridPoint];
    for (let i = 1; i < path.length; i += 1) {
        const prev = expanded[expanded.length - 1];
        const cur = path[i];
        if (!prev || !cur) {
            continue;
        }
        const dx = cur[0] - prev[0];
        const dy = cur[1] - prev[1];
        if (Math.abs(dx) === 1 && Math.abs(dy) === 1) {
            // Deterministic expansion for client/server parity: horizontal, then vertical.
            expanded.push([prev[0] + dx, prev[1]]);
        }
        expanded.push(cur);
    }
    return expanded;
}

class Pathfinder {
    width: number;
    height: number;
    grid: number[][] | null;
    blankGrid: number[][];
    ignored: PathEntity[];
    ignoredOriginalValues: Map<string, number>;

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.grid = null;
        this.blankGrid = [];
        this.initBlankGrid_();
        this.ignored = [];
        this.ignoredOriginalValues = new Map();
    }

    initBlankGrid_(): void {
        for (let i = 0; i < this.height; i += 1) {
            const row: number[] = [];
            for (let j = 0; j < this.width; j += 1) {
                row[j] = 0;
            }
            this.blankGrid[i] = row;
        }
    }

    findPath(
        grid: number[][],
        entity: PathEntity,
        x: number,
        y: number,
        findIncomplete: boolean,
        options?: FindPathOptions
    ): GridPath {
        const start: GridPoint = [entity.gridX, entity.gridY];
        const end: GridPoint = [x, y];

        this.grid = grid;
        this.applyIgnoreList_(true);
        const maxVisited = options?.maxVisited;
        const variant = options?.variant;
        const astarOpts: AStarOptions | undefined =
            maxVisited !== undefined || variant !== undefined ? { maxVisited, variant } : undefined;
        let path = toGridPath(AStar(this.grid, start, end, astarOpts));
        if (options?.variant === 'Diagonal' || options?.variant === 'DiagonalFree') {
            path = expandDiagonalSteps(path);
        }

        if (path.length === 0 && findIncomplete === true) {
            // If no path was found, try and find an incomplete one
            // to at least get closer to destination.
            path = this.findIncompletePath_(start, end, astarOpts);
        }

        return path;
    }

    /**
     * Finds a path which leads the closest possible to an unreachable x, y position.
     *
     * Whenever A* returns an empty path, it means that the destination tile is unreachable.
     * We would like the entities to move the closest possible to it though, instead of
     * staying where they are without moving at all. That's why we have this function which
     * returns an incomplete path to the chosen destination.
     */
    findIncompletePath_(start: GridPoint, end: GridPoint, astarOpts: AStarOptions | undefined): GridPath {
        let perfect = toGridPath(AStar(this.blankGrid, start, end, astarOpts));
        if (astarOpts?.variant === 'Diagonal' || astarOpts?.variant === 'DiagonalFree') {
            perfect = expandDiagonalSteps(perfect);
        }
        let incomplete: GridPath = [];

        for (let i = perfect.length - 1; i > 0; i -= 1) {
            const point = perfect[i];
            if (!point) {
                continue;
            }
            const x = point[0];
            const y = point[1];

            if (this.grid && this.grid[y]?.[x] === 0) {
                incomplete = toGridPath(AStar(this.grid, start, [x, y], astarOpts));
                if (astarOpts?.variant === 'Diagonal' || astarOpts?.variant === 'DiagonalFree') {
                    incomplete = expandDiagonalSteps(incomplete);
                }
                break;
            }
        }
        return incomplete;
    }

    /**
     * Removes colliding tiles corresponding to the given entity's position in the pathing grid.
     */
    ignoreEntity(entity: PathEntity | null): void {
        if (entity) {
            this.ignored.push(entity);
        }
    }

    applyIgnoreList_(ignored: boolean): void {
        if (!this.grid) {
            return;
        }

        if (!ignored) {
            for (const [key, original] of this.ignoredOriginalValues.entries()) {
                const [xs, ys] = key.split(',');
                const x = Number(xs);
                const y = Number(ys);
                if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0) {
                    continue;
                }
                if (this.grid[y]?.[x] === undefined) {
                    continue;
                }
                this.grid[y][x] = original;
            }
            this.ignoredOriginalValues.clear();
            return;
        }

        // Defensive: if a caller forgot to restore, restore now before applying again.
        if (this.ignoredOriginalValues.size > 0) {
            this.applyIgnoreList_(false);
        }

        for (const entity of this.ignored) {
            const positions: Array<{ x: number; y: number }> = [{ x: entity.gridX, y: entity.gridY }];
            if (entity.isMoving?.()) {
                const nx = entity.nextGridX ?? entity.gridX;
                const ny = entity.nextGridY ?? entity.gridY;
                if (nx !== entity.gridX || ny !== entity.gridY) {
                    positions.push({ x: nx, y: ny });
                }
            }

            for (const pos of positions) {
                const x = pos.x;
                const y = pos.y;
                if (x < 0 || y < 0) {
                    continue;
                }
                const row = this.grid[y];
                if (row?.[x] === undefined) {
                    continue;
                }

                const key = `${x},${y}`;
                if (!this.ignoredOriginalValues.has(key)) {
                    this.ignoredOriginalValues.set(key, row[x] ?? 0);
                }
                row[x] = 0;
            }
        }
    }

    clearIgnoreList(): void {
        this.applyIgnoreList_(false);
        this.ignored = [];
    }
}

export default Pathfinder;
