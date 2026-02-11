import AStar from './lib/astar';

type GridPoint = [number, number];
type GridPath = GridPoint[];
type PathEntity = {
    gridX: number;
    gridY: number;
    isMoving?: () => boolean;
    nextGridX?: number;
    nextGridY?: number;
};
const isGridPoint = (point: unknown): point is GridPoint =>
    Array.isArray(point) && point.length === 2 && typeof point[0] === 'number' && typeof point[1] === 'number';
const toGridPath = (value: unknown): GridPath => (Array.isArray(value) ? value.filter(isGridPoint) : []);

class Pathfinder {
    width: number;
    height: number;
    grid: number[][] | null;
    blankGrid: number[][];
    ignored: PathEntity[];

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.grid = null;
        this.blankGrid = [];
        this.initBlankGrid_();
        this.ignored = [];
    }

    initBlankGrid_(): void {
        for (let i = 0; i < this.height; i += 1) {
            this.blankGrid[i] = [];
            for (let j = 0; j < this.width; j += 1) {
                this.blankGrid[i][j] = 0;
            }
        }
    }

    findPath(grid: number[][], entity: PathEntity, x: number, y: number, findIncomplete: boolean): GridPath {
        const start: GridPoint = [entity.gridX, entity.gridY],
            end: GridPoint = [x, y];
        let path = toGridPath(AStar(grid, start, end));

        this.grid = grid;
        this.applyIgnoreList_(true);
        path = toGridPath(AStar(this.grid, start, end));

        if (path.length === 0 && findIncomplete === true) {
            // If no path was found, try and find an incomplete one
            // to at least get closer to destination.
            path = this.findIncompletePath_(start, end);
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
    findIncompletePath_(start: GridPoint, end: GridPoint): GridPath {
        const perfect = toGridPath(AStar(this.blankGrid, start, end));
        let incomplete: GridPath = [];

        for (let i = perfect.length - 1; i > 0; i -= 1) {
            const x = perfect[i][0];
            const y = perfect[i][1];

            if (this.grid && this.grid[y]?.[x] === 0) {
                incomplete = toGridPath(AStar(this.grid, start, [x, y]));
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
        const self = this;

        if (!this.grid) {
            return;
        }

        this.ignored.forEach(function (entity) {
            const x = entity.isMoving?.() ? (entity.nextGridX ?? entity.gridX) : entity.gridX;
            const y = entity.isMoving?.() ? (entity.nextGridY ?? entity.gridY) : entity.gridY;

            if (x !== undefined && y !== undefined && x >= 0 && y >= 0) {
                self.grid[y][x] = ignored ? 0 : 1;
            }
        });
    }

    clearIgnoreList(): void {
        this.applyIgnoreList_(false);
        this.ignored = [];
    }
}

export default Pathfinder;
