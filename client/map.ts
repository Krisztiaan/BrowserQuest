import Area from './area';
import type { MusicKey } from './asset-key-domain';
import Types from '../shared/gametypes-browser';
import log from './platform/log';
import { resolveImageAssetPath } from './image-assets';
import { fetchClientRuntimeMap } from './map-source';
import { computeCameraRegions, type CameraRegionBounds, type CameraRegions } from './camera-regions';
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
    targetMapId?: string;
    cameraX?: number;
    cameraY?: number;
    portal: boolean;
};
type JsonScalar = string | number | boolean | null;
type JsonLike = JsonScalar | JsonLike[] | { [key: string]: JsonLike };
type RawDoor = { [key: string]: JsonLike | undefined };
type RawCheckpoint = { [key: string]: JsonLike | undefined };
type MapGlobals = typeof globalThis & { __BQ_MAP_WORKER_URL__?: string };
type RuntimeMapPayload = {
    mapId?: string;
    width: number;
    height: number;
    tilesize: number;
    data: Array<number | number[]>;
    foreground: Array<number | number[]>;
    renderProps?: Array<{
        depth: number;
        minTileX: number;
        minTileY: number;
        maxTileX: number;
        maxTileY: number;
        parts: Array<{ index: number; gid: number }>;
        meta?: {
            layer: string;
            layerPath: string;
            groupPath?: string[];
            family?: string;
            kind?: string;
            biome?: string;
            tags?: string[];
            template?: string;
            depthMode?: string;
            depthOffset?: number;
            depthRow?: number;
        };
    }>;
    blocking?: number[];
    plateau?: number[];
    navIslandByTile?: number[];
    navIslandCount?: number;
    primaryNavIslandId?: number;
    musicAreas?: MusicArea[];
    collisions: number[];
    animated: AnimatedTileConfig;
    doors?: RawDoor[];
    checkpoints: RawCheckpoint[];
    grid?: number[][];
    plateauGrid?: number[][];
};
type CheckpointArea = Area;

function resolveMapWorkerModuleUrl(): string | URL {
    const override = (globalThis as MapGlobals).__BQ_MAP_WORKER_URL__;
    if (typeof override === 'string' && override.trim().length > 0) {
        return override;
    }
    return new URL('./mapworker.ts', import.meta.url);
}

class Map {
    game: MapGameLike;
    mapId: string;
    data: Array<number | number[]>;
    foreground: Array<number | number[]>;
    renderProps: Array<{
        depth: number;
        minTileX: number;
        minTileY: number;
        maxTileX: number;
        maxTileY: number;
        parts: Array<{ index: number; gid: number }>;
        meta?: {
            layer: string;
            layerPath: string;
            groupPath?: string[];
            family?: string;
            kind?: string;
            biome?: string;
            tags?: string[];
            template?: string;
            depthMode?: string;
            depthOffset?: number;
            depthRow?: number;
        };
    }>;
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
    navIslandByTile: number[];
    navIslandCount: number;
    primaryNavIslandId: number;
    cameraRegions: CameraRegions | null = null;
    musicAreas: MusicArea[];
    collisions: number[];
    foregroundTileIdSet: Set<number>;
    animated: AnimatedTileConfig;
    doors: Record<number, DoorDestination>;
    checkpoints: CheckpointArea[];
    grid: number[][];
    plateauGrid: number[][];
    tilesets: Array<HTMLImageElement | undefined>;
    tilesetCount: number;
    ready_func: (() => void) | null;
    collisionOverrideResolver: ((x: number, y: number) => number | null) | null;

    constructor(loadMultiTilesheets: boolean, game: MapGameLike, mapId: string) {
        this.game = game;
        this.mapId = mapId.trim().length > 0 ? mapId.trim() : 'world_01';
        this.data = [];
        this.foreground = [];
        this.renderProps = [];
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
        this.navIslandByTile = [];
        this.navIslandCount = 0;
        this.primaryNavIslandId = 0;
        this.musicAreas = [];
        this.collisions = [];
        this.foregroundTileIdSet = new Set();
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

        this._loadMap(useWorker, this.mapId);
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

    _loadMap(useWorker: boolean, mapId: string): void {
        const self = this;
        this.loadError = null;

        if (useWorker) {
            log.info('Loading map with web worker.');
            let worker: Worker;
            try {
                worker = new Worker(resolveMapWorkerModuleUrl(), { type: 'module' });
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                self.loadError = `worker_init:${message}`;
                log.error(`Map worker failed to initialize (${message}).`);
                return;
            }
            let settled = false;

            const failWorkerLoad = (reason: string): void => {
                if (settled) {
                    return;
                }
                settled = true;
                try {
                    worker.terminate();
                } catch (_e) {
                    // ignore
                }
                self.loadError = `worker_failure:${reason}`;
                log.error(`Map worker failed (${reason}).`);
            };

            worker.onmessage = function (event: MessageEvent<RuntimeMapPayload>) {
                if (settled) {
                    return;
                }
                try {
                    const map = event.data;
                    const payloadMapId = typeof map.mapId === 'string' && map.mapId.trim().length > 0 ? map.mapId : mapId;
                    self._initMap(map, payloadMapId);
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
                    settled = true;
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    failWorkerLoad(`payload_error:${message}`);
                    return;
                }

                try {
                    worker.terminate();
                } catch (_e) {
                    // ignore
                }
            };

            worker.onerror = function (event: Event) {
                const message = event instanceof ErrorEvent ? event.message : 'unknown_error';
                failWorkerLoad(message);
            };
            worker.onmessageerror = function () {
                failWorkerLoad('message_error');
            };

            worker.postMessage({ mapId });
        } else {
            log.info('Loading map via Tiled world JSON runtime transform.');
            fetchClientRuntimeMap(mapId)
                .then(function (runtimeMap) {
                    self._initMap(runtimeMap, mapId);
                    self._generateCollisionGrid();
                    self._generatePlateauGrid();
                    self.mapLoaded = true;
                    self.loadError = null;
                    self._checkReady();
                })
                .catch(function (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    self.loadError = message;
                    log.error('Failed to load map JSON: ' + message);
                });
        }
    }

    getLoadError(): string | null {
        return this.loadError;
    }

    async loadRuntimeMapById(mapId: string): Promise<void> {
        const resolvedMapId = mapId.trim();
        if (resolvedMapId.length === 0) {
            throw new Error('Runtime map id must be a non-empty string.');
        }
        this.loadError = null;
        this.mapLoaded = false;
        this.isLoaded = false;
        try {
            const runtimeMap = await fetchClientRuntimeMap(resolvedMapId);
            this._initMap(runtimeMap, resolvedMapId);
            this._generateCollisionGrid();
            this._generatePlateauGrid();
            this.mapLoaded = true;
            this._checkReady();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.loadError = message;
            throw new Error(`Failed to activate runtime map "${resolvedMapId}": ${message}`);
        }
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

    _initMap(map: RuntimeMapPayload, mapId: string): void {
        this.mapId = mapId;
        this.width = map.width;
        this.height = map.height;
        this.tilesize = map.tilesize;
        this.data = map.data;
        this.foreground = map.foreground;
        this.renderProps = [...(map.renderProps ?? [])].sort((a, b) => a.depth - b.depth || a.minTileY - b.minTileY || a.minTileX - b.minTileX);
        this.blocking = map.blocking ?? [];
        this.plateau = map.plateau ?? [];
        this.plateauSet = new Set(this.plateau);
        this.navIslandByTile = map.navIslandByTile ?? [];
        this.navIslandCount = map.navIslandCount ?? 0;
        this.primaryNavIslandId = map.primaryNavIslandId ?? 0;
        this.musicAreas = map.musicAreas ?? [];
        this.collisions = map.collisions;
        this.foregroundTileIdSet = new Set();
        for (let i = 0; i < this.foreground.length; i += 1) {
            const cell = this.foreground[i];
            if (Array.isArray(cell)) {
                for (let j = 0; j < cell.length; j += 1) {
                    const gid = cell[j];
                    if (typeof gid === 'number' && Number.isFinite(gid) && gid > 0) {
                        this.foregroundTileIdSet.add(gid - 1);
                    }
                }
                continue;
            }
            if (typeof cell === 'number' && Number.isFinite(cell) && cell > 0) {
                this.foregroundTileIdSet.add(cell - 1);
            }
        }
        this.animated = map.animated;

        this.doors = this._getDoors(map);
        this.checkpoints = this._getCheckpoints(map);
        this.cameraRegions = computeCameraRegions(this.data, this.width, this.height);
    }

    getCameraRegionBounds(gridX: number, gridY: number): CameraRegionBounds | null {
        return this.cameraRegions?.boundsAt(gridX, gridY) ?? null;
    }

    _getDoors(map: RuntimeMapPayload): Record<number, DoorDestination> {
        const doors: Record<number, DoorDestination> = {},
            self = this;

        (map.doors ?? []).forEach(function (door: RawDoor) {
            let o: number = Types.Orientations.DOWN;
            const fromX = Number(door.x);
            const fromY = Number(door.y);
            const toX = Number(door.tx);
            const toY = Number(door.ty);
            if (!Number.isFinite(fromX) || !Number.isFinite(fromY) || !Number.isFinite(toX) || !Number.isFinite(toY)) {
                return;
            }
            const to = typeof door.to === 'string' ? door.to : '';
            const targetMapId = typeof door.ttarget_map === 'string' && door.ttarget_map.trim().length > 0
                ? door.ttarget_map
                : undefined;

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
                ...(targetMapId ? { targetMapId } : {}),
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
            if (self.tilesize > 0 && tileset.width % self.tilesize > 0) {
                const message = 'Tileset size should be a multiple of ' + self.tilesize;
                self.loadError = message;
                log.error(message);
                return;
            }
            log.info('Map tileset loaded.');

            self.tilesetCount -= 1;
            if (self.tilesetCount === 0) {
                log.debug('All map tilesets loaded.');

                self.tilesetsLoaded = true;
                self._checkReady();
            }
        };
        tileset.onerror = function () {
            const message = 'Failed to load map tileset: ' + filepath;
            self.loadError = message;
            log.error(message);
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

    getNavigationIslandId(x: number, y: number): number {
        if (this.isOutOfBounds(x, y)) {
            return 0;
        }
        const idx = y * this.width + x;
        const value = this.navIslandByTile[idx];
        return Number.isInteger(value) ? (value as number) : 0;
    }

    isSameNavigationIsland(fromX: number, fromY: number, toX: number, toY: number): boolean {
        if (this.navIslandByTile.length < this.width * this.height) {
            return true;
        }
        const fromIsland = this.getNavigationIslandId(fromX, fromY);
        const toIsland = this.getNavigationIslandId(toX, toY);
        return fromIsland > 0 && toIsland > 0 && fromIsland === toIsland;
    }

    _generateCollisionGrid(): void {
        const self = this;

        this.grid = [];
        for (let i = 0; i < this.height; i++) {
            this.grid[i] = [];
            for (let j = 0; j < this.width; j++) {
                const row = this.grid[i];
                if (row) {
                    row[j] = 0;
                }
            }
        }

        this.collisions.forEach(function (tileIndex: number) {
            const pos = self.tileIndexToGridPosition(tileIndex + 1);
            const row = self.grid[pos.y];
            if (row?.[pos.x] !== undefined) {
                row[pos.x] = 1;
            }
        });

        this.blocking.forEach(function (tileIndex: number) {
            const pos = self.tileIndexToGridPosition(tileIndex + 1);
            const row = self.grid[pos.y];
            if (row?.[pos.x] !== undefined) {
                row[pos.x] = 1;
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
                const row = this.plateauGrid[i];
                if (!row) {
                    continue;
                }
                if (this.plateauSet.has(tileIndex)) {
                    row[j] = 1;
                } else {
                    row[j] = 0;
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

    isForegroundTileId(id: number): boolean {
        return this.foregroundTileIdSet.has(id);
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
        return this.animated[id + 1]?.l;
    }

    /**
     *
     */
    getTileAnimationDelay(id: number): number {
        const animProperties = this.animated[id + 1];
        if (animProperties?.d) {
            return animProperties.d;
        } else {
            return 100;
        }
    }

    isDoor(x: number, y: number): boolean {
        return this.doors[this.GridPositionToTileIndex(x, y)] !== undefined;
    }

    getDoorDestination(x: number, y: number): DoorDestination | undefined {
        return this.doors[this.GridPositionToTileIndex(x, y)];
    }

    _getCheckpoints(map: RuntimeMapPayload): CheckpointArea[] {
        const checkpoints: CheckpointArea[] = [];
        map.checkpoints.forEach(function (cp: RawCheckpoint) {
            const area = new Area(Number(cp.x), Number(cp.y), Number(cp.w), Number(cp.h));
            area.id = typeof cp.id === 'string' || typeof cp.id === 'number' ? cp.id : null;
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
