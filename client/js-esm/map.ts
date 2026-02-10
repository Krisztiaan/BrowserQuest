import Area from './area';
import type { MusicKey } from './asset-key-domain';
import Types from './compat/gametypes';
import log from './compat/log';
import { resolveImageAssetPath } from './image-assets';
import { fetchClientRuntimeMap } from './map-source';

type MapGameLike = {
    renderer: {
        mobile: boolean;
        tablet: boolean;
    };
};
type MusicArea = { x: number; y: number; w: number; h: number; id: MusicKey };
type AnimatedTileConfig = Record<number, { l?: number; d?: number }>;
type DoorDestination = {
    x: number;
    y: number;
    orientation: number;
    cameraX?: number;
    cameraY?: number;
    portal: boolean;
};
type RawDoor = {
    [key: string]: unknown;
};
type RawCheckpoint = {
    [key: string]: unknown;
};
type RuntimeMapPayload = {
    width: number;
    height: number;
    tilesize: number;
    data: Array<number | number[]>;
    blocking?: number[];
    plateau?: number[];
    musicAreas?: MusicArea[];
    collisions: number[];
    high: number[];
    animated: AnimatedTileConfig;
    doors?: RawDoor[];
    checkpoints: RawCheckpoint[];
    grid?: number[][];
    plateauGrid?: number[][];
};
type CheckpointArea = Area & { id?: string | number };

class Map {
    game: MapGameLike;
    data: Array<number | number[]>;
    isLoaded: boolean;
    tilesetsLoaded: boolean;
    mapLoaded: boolean;
    loadMultiTilesheets: boolean;
    width: number;
    height: number;
    tilesize: number;
    blocking: number[];
    plateau: number[];
    musicAreas: MusicArea[];
    collisions: number[];
    high: number[];
    animated: AnimatedTileConfig;
    doors: Record<number, DoorDestination>;
    checkpoints: CheckpointArea[];
    grid: number[][];
    plateauGrid: number[][];
    tilesets: Array<HTMLImageElement | undefined>;
    tilesetCount: number;
    ready_func: (() => void) | null;

    constructor(loadMultiTilesheets: boolean, game: MapGameLike) {
        this.game = game;
        this.data = [];
        this.isLoaded = false;
        this.tilesetsLoaded = false;
        this.mapLoaded = false;
        this.loadMultiTilesheets = loadMultiTilesheets;
        this.width = 0;
        this.height = 0;
        this.tilesize = 0;
        this.blocking = [];
        this.plateau = [];
        this.musicAreas = [];
        this.collisions = [];
        this.high = [];
        this.animated = [];
        this.doors = {};
        this.checkpoints = [];
        this.grid = [];
        this.plateauGrid = [];
        this.tilesets = [];
        this.tilesetCount = 0;
        this.ready_func = null;

        var useWorker = !(this.game.renderer.mobile || this.game.renderer.tablet);

        this._loadMap(useWorker);
        this._initTilesets();
    }

    _checkReady(): void {
        if (this.tilesetsLoaded && this.mapLoaded) {
            this.isLoaded = true;
            if (this.ready_func) {
                this.ready_func();
            }
        }
    }

    _loadMap(useWorker: boolean): void {
        var self = this;

        if (useWorker) {
            log.info('Loading map with web worker.');
            var worker = new Worker(new URL('./mapworker', import.meta.url), { type: 'module' });
            worker.postMessage(1);

            worker.onmessage = function (event) {
                var map = event.data;
                self._initMap(map);
                self.grid = map.grid;
                self.plateauGrid = map.plateauGrid;
                self.mapLoaded = true;
                self._checkReady();
            };
        } else {
            log.info('Loading map via Tiled world JSON runtime transform.');
            fetchClientRuntimeMap()
                .then(function (runtimeMap) {
                    self._initMap(runtimeMap);
                    self._generateCollisionGrid();
                    self._generatePlateauGrid();
                    self.mapLoaded = true;
                    self._checkReady();
                })
                .catch(function (error) {
                    log.error('Failed to load map JSON: ' + error.message);
                });
        }
    }

    _initTilesets(): void {
        var tileset1, tileset2, tileset3;

        if (!this.loadMultiTilesheets) {
            this.tilesetCount = 1;
            tileset1 = this._loadTileset(resolveImageAssetPath(1, 'tilesheet'));
        } else {
            if (this.game.renderer.mobile || this.game.renderer.tablet) {
                this.tilesetCount = 1;
                tileset2 = this._loadTileset(resolveImageAssetPath(2, 'tilesheet'));
            } else {
                this.tilesetCount = 2;
                tileset2 = this._loadTileset(resolveImageAssetPath(2, 'tilesheet'));
                tileset3 = this._loadTileset(resolveImageAssetPath(3, 'tilesheet'));
            }
        }

        this.tilesets = [tileset1, tileset2, tileset3];
    }

    _initMap(map: RuntimeMapPayload): void {
        this.width = map.width;
        this.height = map.height;
        this.tilesize = map.tilesize;
        this.data = map.data;
        this.blocking = map.blocking || [];
        this.plateau = map.plateau || [];
        this.musicAreas = map.musicAreas || [];
        this.collisions = map.collisions;
        this.high = map.high;
        this.animated = map.animated;

        this.doors = this._getDoors(map);
        this.checkpoints = this._getCheckpoints(map);
    }

    _getDoors(map: RuntimeMapPayload): Record<number, DoorDestination> {
        var doors: Record<number, DoorDestination> = {},
            self = this;

        (map.doors || []).forEach(function (door) {
            var o;
            const fromX = Number(door.x);
            const fromY = Number(door.y);
            const toX = Number(door.tx);
            const toY = Number(door.ty);
            const to = typeof door.to === 'string' ? door.to : '';

            switch (to) {
                case 'u':
                    o = Types.Orientations.UP;
                    break;
                case 'd':
                    o = Types.Orientations.DOWN;
                    break;
                case 'l':
                    o = Types.Orientations.LEFT;
                    break;
                case 'r':
                    o = Types.Orientations.RIGHT;
                    break;
                default:
                    o = Types.Orientations.DOWN;
            }

            doors[self.GridPositionToTileIndex(fromX, fromY)] = {
                x: toX,
                y: toY,
                orientation: o,
                cameraX: typeof door.tcx === 'number' ? door.tcx : undefined,
                cameraY: typeof door.tcy === 'number' ? door.tcy : undefined,
                portal: door.p === 1,
            };
        });

        return doors;
    }

    _loadTileset(filepath: string): HTMLImageElement {
        var self = this;
        var tileset = new Image();

        tileset.crossOrigin = 'Anonymous';
        tileset.src = filepath;

        log.info('Loading tileset: ' + filepath);

        tileset.onload = function () {
            if (tileset.width % self.tilesize > 0) {
                throw Error('Tileset size should be a multiple of ' + self.tilesize);
            }
            log.info('Map tileset loaded.');

            self.tilesetCount -= 1;
            if (self.tilesetCount === 0) {
                log.debug('All map tilesets loaded.');

                self.tilesetsLoaded = true;
                self._checkReady();
            }
        };

        return tileset;
    }

    ready(f: () => void): void {
        this.ready_func = f;
    }

    tileIndexToGridPosition(tileNum: number): { x: number; y: number } {
        var x = 0,
            y = 0;

        var getX = function (num, w) {
            if (num == 0) {
                return 0;
            }
            return num % w == 0 ? w - 1 : (num % w) - 1;
        };

        tileNum -= 1;
        x = getX(tileNum + 1, this.width);
        y = Math.floor(tileNum / this.width);

        return { x: x, y: y };
    }

    GridPositionToTileIndex(x: number, y: number): number {
        return y * this.width + x + 1;
    }

    isColliding(x: number, y: number): boolean {
        if (this.isOutOfBounds(x, y) || !this.grid) {
            return false;
        }
        return this.grid[y][x] === 1;
    }

    isPlateau(x: number, y: number): boolean {
        if (this.isOutOfBounds(x, y) || !this.plateauGrid) {
            return false;
        }
        return this.plateauGrid[y][x] === 1;
    }

    _generateCollisionGrid(): void {
        var tileIndex = 0,
            self = this;

        this.grid = [];
        for (var j, i = 0; i < this.height; i++) {
            this.grid[i] = [];
            for (j = 0; j < this.width; j++) {
                this.grid[i][j] = 0;
            }
        }

        this.collisions.forEach(function (tileIndex) {
            var pos = self.tileIndexToGridPosition(tileIndex + 1);
            self.grid[pos.y][pos.x] = 1;
        });

        this.blocking.forEach(function (tileIndex) {
            var pos = self.tileIndexToGridPosition(tileIndex + 1);
            if (self.grid[pos.y] !== undefined) {
                self.grid[pos.y][pos.x] = 1;
            }
        });
        log.info('Collision grid generated.');
    }

    _generatePlateauGrid(): void {
        var tileIndex = 0;

        this.plateauGrid = [];
        for (var j, i = 0; i < this.height; i++) {
            this.plateauGrid[i] = [];
            for (j = 0; j < this.width; j++) {
                if (this.plateau.includes(tileIndex)) {
                    this.plateauGrid[i][j] = 1;
                } else {
                    this.plateauGrid[i][j] = 0;
                }
                tileIndex += 1;
            }
        }
        log.info('Plateau grid generated.');
    }

    /**
     * Returns true if the given position is located within the dimensions of the map.
     *
     * @returns {Boolean} Whether the position is out of bounds.
     */
    isOutOfBounds(x: number, y: number): boolean {
        return Number.isInteger(x) && Number.isInteger(y) && (x < 0 || x >= this.width || y < 0 || y >= this.height);
    }

    /**
     * Returns true if the given tile id is "high", i.e. above all entities.
     * Used by the renderer to know which tiles to draw after all the entities
     * have been drawn.
     *
     * @param {Number} id The tile id in the tileset
     * @see Renderer.drawHighTiles
     */
    isHighTile(id: number): boolean {
        return this.high.includes(id + 1);
    }

    /**
     * Returns true if the tile is animated. Used by the renderer.
     * @param {Number} id The tile id in the tileset
     */
    isAnimatedTile(id: number): boolean {
        return id + 1 in this.animated;
    }

    /**
     *
     */
    getTileAnimationLength(id: number): number | undefined {
        return this.animated[id + 1].l;
    }

    /**
     *
     */
    getTileAnimationDelay(id: number): number {
        var animProperties = this.animated[id + 1];
        if (animProperties.d) {
            return animProperties.d;
        } else {
            return 100;
        }
    }

    isDoor(x: number, y: number): boolean {
        return this.doors[this.GridPositionToTileIndex(x, y)] !== undefined;
    }

    getDoorDestination(x: number, y: number): DoorDestination {
        return this.doors[this.GridPositionToTileIndex(x, y)];
    }

    _getCheckpoints(map: RuntimeMapPayload): CheckpointArea[] {
        var checkpoints: CheckpointArea[] = [];
        map.checkpoints.forEach(function (cp) {
            const area = new Area(Number(cp.x), Number(cp.y), Number(cp.w), Number(cp.h));
            area.id = typeof cp.id === 'string' || typeof cp.id === 'number' ? cp.id : undefined;
            checkpoints.push(area);
        });
        return checkpoints;
    }

    getCurrentCheckpoint(entity: { gridX: number; gridY: number }): CheckpointArea | undefined {
        return this.checkpoints.find(function (checkpoint) {
            return checkpoint.contains(entity);
        });
    }
}

export default Map;
