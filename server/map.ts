import fs from 'node:fs/promises';
import Log from './log';
import Utils from './utils';
import Checkpoint from './checkpoint';
import { getZoneGroupIdFromGrid, isOutOfBoundsGridPosition } from '../shared/world/coordinate-contract';

interface Position {
    x: number;
    y: number;
}

interface DoorDefinition {
    x: number;
    y: number;
    tx: number;
    ty: number;
}

interface CheckpointDefinition {
    id: number | string;
    x: number;
    y: number;
    w: number;
    h: number;
    s?: number;
}

interface CheckpointContract {
    id: number | string;
    getRandomPosition(): Position;
}

interface MapDefinition {
    width: number;
    height: number;
    collisions: number[];
    roamingAreas: unknown[];
    chestAreas: unknown[];
    staticChests: unknown[];
    staticEntities: Record<string, string>;
    doors?: DoorDefinition[];
    checkpoints?: CheckpointDefinition[];
}

const log = Log.getLogger();
const mapDefinitionCache = new globalThis.Map<string, Promise<MapDefinition | null>>();

function cloneMapDefinition(mapDefinition: MapDefinition): MapDefinition {
    if (typeof structuredClone === 'function') {
        return structuredClone(mapDefinition);
    }
    return JSON.parse(JSON.stringify(mapDefinition)) as MapDefinition;
}

interface TiledMapSource {
    width: number;
    height: number;
    tilewidth: number;
    layers?: unknown[];
}

function isTiledMapSource(payload: unknown): payload is TiledMapSource {
    return (
        typeof payload === 'object' &&
        payload !== null &&
        typeof (payload as { width?: unknown }).width === 'number' &&
        typeof (payload as { height?: unknown }).height === 'number' &&
        typeof (payload as { tilewidth?: unknown }).tilewidth === 'number' &&
        'layers' in payload &&
        Array.isArray((payload as { layers?: unknown }).layers)
    );
}

async function normalizeMapDefinition(rawMap: unknown): Promise<MapDefinition> {
    if (!isTiledMapSource(rawMap)) {
        return rawMap as MapDefinition;
    }

    const processMapModule = await import('../shared/maps/processmap');
    return processMapModule.default(rawMap as never, { mode: 'server', quiet: true }) as unknown as MapDefinition;
}

async function readAndNormalizeMapDefinition(filepath: string): Promise<MapDefinition | null> {
    try {
        await fs.access(filepath);
    } catch (_) {
        log.error(filepath + " doesn't exist.");
        return null;
    }

    let file: string;
    try {
        file = await fs.readFile(filepath, 'utf8');
    } catch (_) {
        log.error('Could not read map file: ' + filepath);
        return null;
    }

    try {
        const parsed = JSON.parse(file) as unknown;
        return await normalizeMapDefinition(parsed);
    } catch (parseErr: unknown) {
        const parseMessage = parseErr instanceof Error ? parseErr.message : String(parseErr);
        log.error('Invalid map JSON: ' + filepath + ' (' + parseMessage + ')');
        return null;
    }
}

function getMapDefinition(filepath: string): Promise<MapDefinition | null> {
    const cached = mapDefinitionCache.get(filepath);
    if (cached) {
        return cached;
    }

    const pending = readAndNormalizeMapDefinition(filepath)
        .then((mapDefinition) => {
            if (mapDefinition === null) {
                mapDefinitionCache.delete(filepath);
            }
            return mapDefinition;
        })
        .catch((error) => {
            mapDefinitionCache.delete(filepath);
            throw error;
        });
    mapDefinitionCache.set(filepath, pending);
    return pending;
}

class Map {
    isLoaded: boolean;
    width: number;
    height: number;
    collisions: number[];
    mobAreas: unknown[];
    chestAreas: unknown[];
    staticChests: unknown[];
    staticEntities: Record<string, string>;
    doors: DoorDefinition[];
    doorIndex: globalThis.Map<number, DoorDefinition>;
    zoneWidth: number;
    zoneHeight: number;
    groupWidth: number;
    groupHeight: number;
    grid: number[][];
    connectedGroups: Record<string, Position[]>;
    checkpoints: Record<string | number, CheckpointContract>;
    startingAreas: CheckpointContract[];
    readyCallbacks: Array<() => void>;

    constructor(filepath: string) {
        this.isLoaded = false;
        this.width = 0;
        this.height = 0;
        this.collisions = [];
        this.mobAreas = [];
        this.chestAreas = [];
        this.staticChests = [];
        this.staticEntities = {};
        this.doors = [];
        this.doorIndex = new globalThis.Map();
        this.zoneWidth = 0;
        this.zoneHeight = 0;
        this.groupWidth = 0;
        this.groupHeight = 0;
        this.grid = [];
        this.connectedGroups = {};
        this.checkpoints = {};
        this.startingAreas = [];
        this.readyCallbacks = [];

        void this.loadMap(filepath);
    }

    async loadMap(filepath: string): Promise<void> {
        const mapDefinition = await getMapDefinition(filepath);
        if (!mapDefinition) {
            return;
        }
        this.initMap(cloneMapDefinition(mapDefinition));
    }

    initMap(map: MapDefinition): void {
        this.width = map.width;
        this.height = map.height;
        this.collisions = map.collisions;
        this.mobAreas = map.roamingAreas;
        this.chestAreas = map.chestAreas;
        this.staticChests = map.staticChests;
        this.staticEntities = map.staticEntities;
        this.isLoaded = true;

        this.initDoors(map.doors);

        // zone groups
        this.zoneWidth = 28;
        this.zoneHeight = 12;
        this.groupWidth = Math.floor(this.width / this.zoneWidth);
        this.groupHeight = Math.floor(this.height / this.zoneHeight);

        this.initConnectedGroups(map.doors);
        this.initCheckpoints(map.checkpoints);

        if (!Array.isArray(this.readyCallbacks)) {
            this.readyCallbacks = [];
        }

        if (this.readyCallbacks.length > 0) {
            const callbacks = this.readyCallbacks.slice();
            this.readyCallbacks.length = 0;
            for (let i = 0; i < callbacks.length; i += 1) {
                callbacks[i]?.();
            }
        }
    }

    ready(f: () => void): void {
        if (this.isLoaded) {
            f();
            return;
        }
        if (!Array.isArray(this.readyCallbacks)) {
            this.readyCallbacks = [];
        }
        this.readyCallbacks.push(f);
    }

    initDoors(doors?: DoorDefinition[]): void {
        this.doors = doors ?? [];
        this.doorIndex = new globalThis.Map();

        for (const door of this.doors) {
            this.doorIndex.set(this.GridPositionToTileIndex(door.x, door.y), door);
        }
    }

    isDoor(x: number, y: number): boolean {
        return this.doorIndex.has(this.GridPositionToTileIndex(x, y));
    }

    getDoorDestination(x: number, y: number): Position | null {
        const door = this.doorIndex.get(this.GridPositionToTileIndex(x, y));
        if (!door) {
            return null;
        }
        return { x: door.tx, y: door.ty };
    }

    tileIndexToGridPosition(tileNum: number): Position {
        let x = 0;
        let y = 0;

        const getX = function (num: number, w: number) {
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

    generateCollisionGrid(): void {
        this.grid = [];

        if (this.isLoaded) {
            const collisionSet = new Set(this.collisions);
            let tileIndex = 0;
            for (let i = 0; i < this.height; i++) {
                const row: number[] = [];
                this.grid[i] = row;
                for (let j = 0; j < this.width; j++) {
                    if (collisionSet.has(tileIndex)) {
                        row[j] = 1;
                    } else {
                        row[j] = 0;
                    }
                    tileIndex += 1;
                }
            }
            //log.info("Collision grid generated.");
        }
    }

    isOutOfBounds(x: number, y: number): boolean {
        return isOutOfBoundsGridPosition(x, y, this.width, this.height);
    }

    isColliding(x: number, y: number): boolean {
        if (this.isOutOfBounds(x, y)) {
            return false;
        }
        return this.grid[y]?.[x] === 1;
    }

    GroupIdToGroupPosition(id: string): Position {
        const posArray = id.split('-');
        const x = Number.parseInt(posArray[0] ?? '0', 10);
        const y = Number.parseInt(posArray[1] ?? '0', 10);
        return pos(x, y);
    }

    forEachGroup(callback: (groupId: string) => void): void {
        const width = this.groupWidth;
        const height = this.groupHeight;

        for (let x = 0; x < width; x += 1) {
            for (let y = 0; y < height; y += 1) {
                callback(x + '-' + y);
            }
        }
    }

    getGroupIdFromPosition(x: number, y: number): string {
        return getZoneGroupIdFromGrid(x, y, this.zoneWidth, this.zoneHeight);
    }

    getAdjacentGroupPositions(id: string): Position[] {
        const self = this;
        const position = this.GroupIdToGroupPosition(id);
        const x = position.x;
        const y = position.y;
        // surrounding groups
        const list = [
            pos(x - 1, y - 1),
            pos(x, y - 1),
            pos(x + 1, y - 1),
            pos(x - 1, y),
            pos(x, y),
            pos(x + 1, y),
            pos(x - 1, y + 1),
            pos(x, y + 1),
            pos(x + 1, y + 1),
        ];

        // groups connected via doors
        (this.connectedGroups[id] ?? []).forEach(function (position) {
            // don't add a connected group if it's already part of the surrounding ones.
            if (
                !list.some(function (groupPos) {
                    return equalPositions(groupPos, position);
                })
            ) {
                list.push(position);
            }
        });

        return list.filter(function (groupPosition) {
            return (
                groupPosition.x >= 0 &&
                groupPosition.y >= 0 &&
                groupPosition.x < self.groupWidth &&
                groupPosition.y < self.groupHeight
            );
        });
    }

    forEachAdjacentGroup(groupId: string | null | undefined, callback: (groupId: string) => void): void {
        if (groupId) {
            this.getAdjacentGroupPositions(groupId).forEach(function (groupPosition) {
                callback(groupPosition.x + '-' + groupPosition.y);
            });
        }
    }

    initConnectedGroups(doors?: DoorDefinition[]): void {
        const self = this;

        this.connectedGroups = {};
        (doors ?? []).forEach(function (door) {
            const groupId = self.getGroupIdFromPosition(door.x, door.y);
            const connectedGroupId = self.getGroupIdFromPosition(door.tx, door.ty);
            const connectedPosition = self.GroupIdToGroupPosition(connectedGroupId);

            const connected = self.connectedGroups[groupId];
            if (connected) {
                connected.push(connectedPosition);
            } else {
                self.connectedGroups[groupId] = [connectedPosition];
            }
        });
    }

    initCheckpoints(cpList?: CheckpointDefinition[]): void {
        const self = this;

        this.checkpoints = {};
        this.startingAreas = [];

        (cpList ?? []).forEach(function (cp) {
            const checkpoint = new Checkpoint(cp.id, cp.x, cp.y, cp.w, cp.h);
            self.checkpoints[checkpoint.id] = checkpoint;
            if (cp.s === 1) {
                self.startingAreas.push(checkpoint);
            }
        });
    }

    getCheckpoint(id: string | number): CheckpointContract | undefined {
        return this.checkpoints[id];
    }

    getRandomStartingPosition(): Position {
        const nbAreas = this.startingAreas.length;
        if (nbAreas === 0) {
            throw new Error('Map has no starting area.');
        }
        const fixedIndexRaw = process.env.BQ_FIXED_START_AREA_INDEX;
        const fixedIndex = typeof fixedIndexRaw === 'string' ? Number.parseInt(fixedIndexRaw, 10) : Number.NaN;
        const i =
            Number.isFinite(fixedIndex) && Number.isInteger(fixedIndex)
                ? Utils.clamp(0, nbAreas - 1, fixedIndex)
                : Utils.randomInt(0, nbAreas - 1);
        const area = this.startingAreas[i];
        if (!area) {
            throw new Error('Failed to resolve starting area.');
        }

        if (process.env.BQ_FIXED_START_CENTER === '1') {
            const anyArea = area as unknown as { x?: unknown; y?: unknown; width?: unknown; height?: unknown };
            if (
                typeof anyArea.x === 'number'
                && typeof anyArea.y === 'number'
                && typeof anyArea.width === 'number'
                && typeof anyArea.height === 'number'
                && Number.isFinite(anyArea.x)
                && Number.isFinite(anyArea.y)
                && Number.isFinite(anyArea.width)
                && Number.isFinite(anyArea.height)
            ) {
                return {
                    x: Math.floor(anyArea.x + anyArea.width / 2),
                    y: Math.floor(anyArea.y + anyArea.height / 2),
                };
            }
        }

        return area.getRandomPosition();
    }
}

function pos(x: number, y: number): Position {
    return { x: x, y: y };
}

function equalPositions(pos1: Position, pos2: Position): boolean {
    return pos1.x === pos2.x && pos1.y === pos2.y;
}

export default Map;
