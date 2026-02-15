import Area from './area';
import type { MusicKey } from './asset-key-domain';
import Types from '../shared/gametypes-browser';
import log from './platform/log';
import { resolveImageAssetPath } from './image-assets';
import { fetchClientRuntimeMap } from './map-source';
import { isOutOfBoundsGridPosition } from '../shared/world/coordinate-contract';

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

function resolveMapWorkerModuleUrl(): string | URL {
    const override = (globalThis as unknown as { __BQ_MAP_WORKER_URL__?: unknown }).__BQ_MAP_WORKER_URL__;
    if (typeof override === 'string' && override.trim().length > 0) {
        return override;
    }
    return new URL('./mapworker.ts', import.meta.url);
}

class Map {
    game: MapGameLike;
    data: Array<number | number[]>;
    isLoaded: boolean;
    tilesetsLoaded: boolean;
    mapLoaded: boolean;
    loadError: string | null;
    loadMultiTilesheets: boolean;
    width: number;
    height: number;
    tilesize: number;
    blocking: number[];
    plateau: number[];
    plateauSet: Set<number>;
    musicAreas: MusicArea[];
    collisions: number[];
    high: number[];
    highSet: Set<number>;
    animated: AnimatedTileConfig;
    doors: Record<number, DoorDestination>;
    checkpoints: CheckpointArea[];
    grid: number[][];
    plateauGrid: number[][];
    tilesets: Array<HTMLImageElement | undefined>;
    tilesetCount: number;
    ready_func: (() => void) | null;
    collisionOverrideResolver: ((x: number, y: number) => number | null) | null;

    constructor(loadMultiTilesheets: boolean, game: MapGameLike) {
        this.game = game;
        this.data = [];
        this.isLoaded = false;
        this.tilesetsLoaded = false;
        this.mapLoaded = false;
        this.loadError = null;
        this.loadMultiTilesheets = loadMultiTilesheets;
        this.width = 0;
        this.height = 0;
        this.tilesize = 0;
        this.blocking = [];
        this.plateau = [];
        this.plateauSet = new Set();
        this.musicAreas = [];
        this.collisions = [];
        this.high = [];
        this.highSet = new Set();
        this.animated = [];
        this.doors = {};
        this.checkpoints = [];
        this.grid = [];
        this.plateauGrid = [];
        this.tilesets = [];
        this.tilesetCount = 0;
        this.ready_func = null;
        this.collisionOverrideResolver = null;

        const useWorker = !(this.game.renderer.mobile || this.game.renderer.tablet);

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
        const self = this;
        this.loadError = null;

        if (useWorker) {
            log.info('Loading map with web worker.');
            const worker = new Worker(resolveMapWorkerModuleUrl(), { type: 'module' });
            let settled = false;

            const fallbackToMainThread = (reason: string): void => {
                if (settled) {
                    return;
                }
                settled = true;
                try {
                    worker.terminate();
                } catch (_e) {
                    // ignore
                }
                log.error(`Map worker failed (${reason}); falling back to main-thread map load.`);
                self._loadMap(false);
            };

            worker.onmessage = function (event: MessageEvent<RuntimeMapPayload>) {
                if (settled) {
                    return;
                }
                settled = true;

                const map = event.data;
                self._initMap(map);
                if (map.grid && map.plateauGrid) {
                    self.grid = map.grid;
                    self.plateauGrid = map.plateauGrid;
                } else {
                    self._generateCollisionGrid();
                    self._generatePlateauGrid();
                }
                self.mapLoaded = true;
                self.loadError = null;
                self._checkReady();

                try {
                    worker.terminate();
                } catch (_e) {
                    // ignore
                }
            };

            worker.onerror = function (event: Event) {
                const message = event instanceof ErrorEvent ? event.message : 'unknown_error';
                fallbackToMainThread(message);
            };
            worker.onmessageerror = function () {
                fallbackToMainThread('message_error');
            };

            worker.postMessage(1);
        } else {
            log.info('Loading map via Tiled world JSON runtime transform.');
            fetchClientRuntimeMap()
                .then(function (runtimeMap) {
                    self._initMap(runtimeMap);
                    self._generateCollisionGrid();
                    self._generatePlateauGrid();
                    self.mapLoaded = true;
                    self.loadError = null;
                    self._checkReady();
                })
                .catch(function (error: unknown) {
                    const message = error instanceof Error ? error.message : String(error);
                    self.loadError = message;
                    log.error('Failed to load map JSON: ' + message);
                });
        }
    }

    getLoadError(): string | null {
        return this.loadError;
    }

    _initTilesets(): void {
        let tileset1: HTMLImageElement | undefined;
        let tileset2: HTMLImageElement | undefined;
        let tileset3: HTMLImageElement | undefined;

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
        this.blocking = map.blocking ?? [];
        this.plateau = map.plateau ?? [];
        this.plateauSet = new Set(this.plateau);
        this.musicAreas = map.musicAreas ?? [];
        this.collisions = map.collisions;
        this.high = map.high;
        this.highSet = new Set(this.high);
        this.animated = map.animated;

        this.doors = this._getDoors(map);
        this.checkpoints = this._getCheckpoints(map);
    }

    _getDoors(map: RuntimeMapPayload): Record<number, DoorDestination> {
        const doors: Record<number, DoorDestination> = {},
            self = this;

        (map.doors ?? []).forEach(function (door: RawDoor) {
            let o = Types.Orientations.DOWN;
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
        const self = this;
        const tileset = new Image();

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
        let x = 0;
        let y = 0;

        const getX = function (num: number, w: number): number {
            if (num === 0) {
                return 0;
            }
            return num % w === 0 ? w - 1 : (num % w) - 1;
        };

        tileNum -= 1;
        x = getX(tileNum + 1, this.width);
        y = Math.floor(tileNum / this.width);

        return { x: x, y: y };
    }

    GridPositionToTileIndex(x: number, y: number): number {
        return y * this.width + x + 1;
    }

    setCollisionOverrideResolver(resolver: ((x: number, y: number) => number | null) | null): void {
        this.collisionOverrideResolver = resolver;
    }

    isColliding(x: number, y: number): boolean {
        if (this.isOutOfBounds(x, y)) {
            return false;
        }
        const override = this.collisionOverrideResolver?.(x, y) ?? null;
        if (override !== null) {
            return override !== 0;
        }
        const row = this.grid[y];
        if (!row) {
            return false;
        }
        return row[x] === 1;
    }

    isPlateau(x: number, y: number): boolean {
        if (this.isOutOfBounds(x, y)) {
            return false;
        }
        const row = this.plateauGrid[y];
        if (!row) {
            return false;
        }
        return row[x] === 1;
    }

    _generateCollisionGrid(): void {
        const self = this;

        this.grid = [];
        for (let i = 0; i < this.height; i++) {
            this.grid[i] = [];
            for (let j = 0; j < this.width; j++) {
                this.grid[i][j] = 0;
            }
        }

        this.collisions.forEach(function (tileIndex: number) {
            const pos = self.tileIndexToGridPosition(tileIndex + 1);
            self.grid[pos.y][pos.x] = 1;
        });

        this.blocking.forEach(function (tileIndex: number) {
            const pos = self.tileIndexToGridPosition(tileIndex + 1);
            if (self.grid[pos.y] !== undefined) {
                self.grid[pos.y][pos.x] = 1;
            }
        });
        log.info('Collision grid generated.');
    }

    _generatePlateauGrid(): void {
        let tileIndex = 0;

        this.plateauGrid = [];
        for (let i = 0; i < this.height; i++) {
            this.plateauGrid[i] = [];
            for (let j = 0; j < this.width; j++) {
                if (this.plateauSet.has(tileIndex)) {
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
     */
    isOutOfBounds(x: number, y: number): boolean {
        return isOutOfBoundsGridPosition(x, y, this.width, this.height);
    }

    /**
     * Returns true if the given tile id is "high", i.e. above all entities.
     * Used by the renderer to know which tiles to draw after all the entities
     * have been drawn.
     *
     * @see Renderer.drawHighTiles
     */
    isHighTile(id: number): boolean {
        return this.highSet.has(id + 1);
    }

    /**
     * Returns true if the tile is animated. Used by the renderer.
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
        const animProperties = this.animated[id + 1];
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
        const checkpoints: CheckpointArea[] = [];
        map.checkpoints.forEach(function (cp: RawCheckpoint) {
            const area = new Area(Number(cp.x), Number(cp.y), Number(cp.w), Number(cp.h));
            area.id = typeof cp.id === 'string' || typeof cp.id === 'number' ? cp.id : undefined;
            checkpoints.push(area);
        });
        return checkpoints;
    }

    getCurrentCheckpoint(entity: { gridX: number; gridY: number }): CheckpointArea | undefined {
        return this.checkpoints.find(function (checkpoint: CheckpointArea) {
            return checkpoint.contains(entity);
        });
    }
}

export default Map;
