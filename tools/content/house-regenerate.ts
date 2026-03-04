import fs from 'node:fs/promises';
import path from 'node:path';
import { parseCliArgs } from '../shared/cli-args';

type UnknownRecord = Record<string, unknown>;

type ScalarValue = string | number | boolean | null;

type TiledProperty = Readonly<{ name: string; value: unknown }>;
type TiledObject = Readonly<{
    id?: number;
    name?: string;
    type?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    properties?: TiledProperty[];
}>;

type TiledLayer =
    | Readonly<{
          id?: number;
          name?: string;
          type: 'tilelayer';
          width?: number;
          height?: number;
          visible?: boolean | number;
          opacity?: number;
          x?: number;
          y?: number;
          data?: number[];
      }>
    | Readonly<{
          id?: number;
          name?: string;
          type: 'objectgroup';
          visible?: boolean | number;
          opacity?: number;
          x?: number;
          y?: number;
          objects?: TiledObject[];
      }>;

type TiledTileset = Readonly<{
    firstgid: number;
    source?: string;
    name?: string;
    tilewidth?: number;
    tileheight?: number;
    tilecount?: number;
    columns?: number;
    image?: string;
    imagewidth?: number;
    imageheight?: number;
    tiles?: unknown[];
}>;

type TiledMap = Readonly<{
    width: number;
    height: number;
    tilewidth: number;
    tileheight: number;
    layers?: TiledLayer[];
    tilesets?: TiledTileset[];
    // Keep unknown top-level metadata stable.
    compressionlevel?: number;
    infinite?: boolean;
    orientation?: string;
    renderorder?: string;
    tiledversion?: string;
    type?: string;
    version?: string | number;
}>;

type LegacyDoor = Readonly<{
    x: number;
    y: number;
    tx: number;
    ty: number;
    to?: string;
    p?: number;
    tcx?: number;
    tcy?: number;
}>;

function fail(message: string): never {
    throw new Error(message);
}

function asRecord(value: unknown): UnknownRecord | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    return value as UnknownRecord;
}

function asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

function asNonEmptyString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function doorProps(obj: TiledObject): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    const props = Array.isArray(obj.properties) ? obj.properties : [];
    for (let i = 0; i < props.length; i += 1) {
        const p = props[i];
        if (!p) {
            continue;
        }
        const name = p ? asNonEmptyString(p.name) : null;
        if (!name) {
            continue;
        }
        out[name] = p.value;
    }
    return out;
}

const GLOBAL_TILE_ID_MASK = 0x1fffffff;
function normalizeGid(value: number | undefined): number {
    return typeof value === 'number' && Number.isFinite(value) ? (value & GLOBAL_TILE_ID_MASK) : 0;
}

function tileIndex(x: number, y: number, width: number): number {
    return y * width + x;
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function isVisibleLayer(layer: { visible?: boolean | number } | null | undefined): boolean {
    if (!layer) {
        return false;
    }
    if (layer.visible === undefined) {
        return true;
    }
    return Boolean(layer.visible);
}

type Window = Readonly<{ x0: number; y0: number; x1: number; y1: number; width: number; height: number }>;
function makeWindow({
    seedX,
    seedY,
    radius,
    mapWidth,
    mapHeight,
}: {
    seedX: number;
    seedY: number;
    radius: number;
    mapWidth: number;
    mapHeight: number;
}): Window {
    const x0 = clamp(seedX - radius, 0, mapWidth - 1);
    const y0 = clamp(seedY - radius, 0, mapHeight - 1);
    const x1 = clamp(seedX + radius, 0, mapWidth - 1);
    const y1 = clamp(seedY + radius, 0, mapHeight - 1);
    return { x0, y0, x1, y1, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

function computeDominantNonZeroGid(data: ReadonlyArray<number>, window: Window, mapWidth: number): number {
    const counts = new Map<number, number>();
    for (let y = window.y0; y <= window.y1; y += 1) {
        const rowBase = y * mapWidth;
        for (let x = window.x0; x <= window.x1; x += 1) {
            const gid = normalizeGid(data[rowBase + x]);
            if (gid === 0) {
                continue;
            }
            counts.set(gid, (counts.get(gid) ?? 0) + 1);
        }
    }
    let bestGid = 0;
    let bestCount = 0;
    for (const [gid, count] of counts.entries()) {
        if (count > bestCount) {
            bestCount = count;
            bestGid = gid;
        }
    }
    return bestGid;
}

type Extraction = Readonly<{
    componentMask: Uint8Array;
    bbox: Readonly<{ x0: number; y0: number; x1: number; y1: number; width: number; height: number }>;
    doorX: number;
    doorY: number;
    radiusUsed: number;
    indoorFillerGid: number;
}>;

function extractHouseComponentFromWorld({
    world,
    seedX,
    seedY,
    radius,
    layerDataByName,
    tileSize,
}: {
    world: TiledMap;
    seedX: number;
    seedY: number;
    radius: number;
    layerDataByName: Readonly<Record<string, ReadonlyArray<number>>>;
    tileSize: number;
}): Extraction {
    const mapWidth = world.width;
    const mapHeight = world.height;
    const window = makeWindow({ seedX, seedY, radius, mapWidth, mapHeight });
    const indoor = layerDataByName['indoor'];
    if (!indoor) {
        fail('world map is missing required tilelayer "indoor"');
    }

    const featureLayerNames = [
        'cave',
        'indoorwalls',
        'indoor doors',
        'carpets',
        'indoor objects',
        'entities',
        'blocking',
    ];

    const windowArea = window.width * window.height;
    const outside = new Uint8Array(windowArea);
    const qx = new Int32Array(windowArea);
    const qy = new Int32Array(windowArea);
    let head = 0;
    let tail = 0;

    const windowIndex = (x: number, y: number): number => (y - window.y0) * window.width + (x - window.x0);
    const inWindow = (x: number, y: number): boolean => x >= window.x0 && y >= window.y0 && x <= window.x1 && y <= window.y1;

    const hasAnyFeature = (i: number): boolean => {
        for (let j = 0; j < featureLayerNames.length; j += 1) {
            const name = featureLayerNames[j];
            if (!name) continue;
            const data = layerDataByName[name];
            if (!data) continue;
            if (normalizeGid(data[i]) !== 0) {
                return true;
            }
        }
        return false;
    };

    // Heuristic: pick a single "filler" indoor GID to treat as background during extraction.
    // We only consider indoor tiles on otherwise-empty cells (no walls/doors/carpets/objects/entities/blocking),
    // so we don't accidentally classify feature tiles as filler.
    const fillerCounts = new Map<number, number>();
    for (let y = window.y0; y <= window.y1; y += 1) {
        const rowBase = y * mapWidth;
        for (let x = window.x0; x <= window.x1; x += 1) {
            const i = rowBase + x;
            if (hasAnyFeature(i)) {
                continue;
            }
            const gid = normalizeGid(indoor[i]);
            if (gid === 0) {
                continue;
            }
            fillerCounts.set(gid, (fillerCounts.get(gid) ?? 0) + 1);
        }
    }
    let indoorFillerGid = 0;
    let bestCount = 0;
    for (const [gid, count] of fillerCounts.entries()) {
        if (count > bestCount) {
            bestCount = count;
            indoorFillerGid = gid;
        }
    }

    const isOutsideFloodCell = (x: number, y: number): boolean => {
        const i = tileIndex(x, y, mapWidth);
        if (hasAnyFeature(i)) {
            return false;
        }
        const gid = normalizeGid(indoor[i]);
        return gid === 0 || (indoorFillerGid !== 0 && gid === indoorFillerGid);
    };

    // Flood the "outside" from the window border, traversing only empty/filler floor and treating
    // walls/doors/objects/entities/blocking as barriers.
    for (let x = window.x0; x <= window.x1; x += 1) {
        for (const y of [window.y0, window.y1]) {
            const wi = windowIndex(x, y);
            if (outside[wi] === 0 && isOutsideFloodCell(x, y)) {
                outside[wi] = 1;
                qx[tail] = x;
                qy[tail] = y;
                tail += 1;
            }
        }
    }
    for (let y = window.y0; y <= window.y1; y += 1) {
        for (const x of [window.x0, window.x1]) {
            const wi = windowIndex(x, y);
            if (outside[wi] === 0 && isOutsideFloodCell(x, y)) {
                outside[wi] = 1;
                qx[tail] = x;
                qy[tail] = y;
                tail += 1;
            }
        }
    }

    const dirs: ReadonlyArray<readonly [number, number]> = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
    ];
    while (head < tail) {
        const x = qx[head]!;
        const y = qy[head]!;
        head += 1;
        for (let i = 0; i < dirs.length; i += 1) {
            const [dx, dy] = dirs[i]!;
            const nx = x + dx;
            const ny = y + dy;
            if (!inWindow(nx, ny)) {
                continue;
            }
            const wi = windowIndex(nx, ny);
            if (outside[wi] === 1) {
                continue;
            }
            if (!isOutsideFloodCell(nx, ny)) {
                continue;
            }
            outside[wi] = 1;
            qx[tail] = nx;
            qy[tail] = ny;
            tail += 1;
        }
    }

    const insideSpace = new Uint8Array(windowArea);
    for (let i = 0; i < windowArea; i += 1) {
        insideSpace[i] = outside[i] === 1 ? 0 : 1;
    }

    // Locate the most plausible door anchor within the inside region. Prefer the exact legacy seed tile, but if it
    // doesn't have an "indoor doors" tile, choose the nearest door tile.
    const indoorDoors = layerDataByName['indoor doors'] ?? null;
    let doorX = seedX;
    let doorY = seedY;
    const seedInWindow = inWindow(seedX, seedY);
    if (!seedInWindow) {
        fail(`seed (${seedX},${seedY}) is out of window bounds`);
    }
    const seedWi = windowIndex(seedX, seedY);
    if (insideSpace[seedWi] !== 1) {
        fail(`seed (${seedX},${seedY}) lies in background filler region (likely wrong legacy mapping)`);
    }
    const seedDoorGid = indoorDoors ? normalizeGid(indoorDoors[tileIndex(seedX, seedY, mapWidth)]) : 0;
    if (!seedDoorGid && indoorDoors) {
        // Spiral search up to a limited radius to find the nearest door tile.
        const maxR = Math.min(24, radius);
        let found = false;
        for (let r = 1; r <= maxR && !found; r += 1) {
            for (let dy = -r; dy <= r && !found; dy += 1) {
                for (let dx = -r; dx <= r; dx += 1) {
                    const nx = seedX + dx;
                    const ny = seedY + dy;
                    if (!inWindow(nx, ny)) continue;
                    const wi = windowIndex(nx, ny);
                    if (insideSpace[wi] !== 1) continue;
                    const gid = normalizeGid(indoorDoors[tileIndex(nx, ny, mapWidth)]);
                    if (gid) {
                        doorX = nx;
                        doorY = ny;
                        found = true;
                        break;
                    }
                }
            }
        }
    }

    // Walkable component extraction on insideSpace, treating walls/blocking as barriers so we don't merge nearby interiors.
    const blocking = layerDataByName['blocking'] ?? null;
    const indoorWalls = layerDataByName['indoorwalls'] ?? null;
    const carpets = layerDataByName['carpets'] ?? null;
    const indoorObjects = layerDataByName['indoor objects'] ?? null;

    const isWalkableInsideCell = (x: number, y: number): boolean => {
        if (!inWindow(x, y)) {
            return false;
        }
        const wi = windowIndex(x, y);
        if (insideSpace[wi] !== 1) {
            return false;
        }
        const i = tileIndex(x, y, mapWidth);
        if (blocking && normalizeGid(blocking[i]) !== 0) {
            return false;
        }
        if (indoorWalls && normalizeGid(indoorWalls[i]) !== 0) {
            return false;
        }
        const hasFloorish =
            normalizeGid(indoor[i]) !== 0 ||
            (carpets ? normalizeGid(carpets[i]) !== 0 : false) ||
            (indoorDoors ? normalizeGid(indoorDoors[i]) !== 0 : false) ||
            (indoorObjects ? normalizeGid(indoorObjects[i]) !== 0 : false);
        return hasFloorish;
    };

    // If the chosen door anchor isn't on a walkable tile, move to the nearest walkable tile inside the interior.
    let startX = doorX;
    let startY = doorY;
    if (!isWalkableInsideCell(startX, startY)) {
        const maxR = Math.min(24, radius);
        let found = false;
        for (let r = 1; r <= maxR && !found; r += 1) {
            for (let dy = -r; dy <= r && !found; dy += 1) {
                for (let dx = -r; dx <= r; dx += 1) {
                    const nx = doorX + dx;
                    const ny = doorY + dy;
                    if (!isWalkableInsideCell(nx, ny)) continue;
                    startX = nx;
                    startY = ny;
                    found = true;
                    break;
                }
            }
        }
        if (!found) {
            fail(`unable to find a walkable interior tile near door seed (${doorX},${doorY})`);
        }
    }

    const walkable = new Uint8Array(windowArea);
    head = 0;
    tail = 0;
    const startWi = windowIndex(startX, startY);
    walkable[startWi] = 1;
    qx[tail] = startX;
    qy[tail] = startY;
    tail += 1;

    while (head < tail) {
        const x = qx[head]!;
        const y = qy[head]!;
        head += 1;
        for (let i = 0; i < dirs.length; i += 1) {
            const [dx, dy] = dirs[i]!;
            const nx = x + dx;
            const ny = y + dy;
            if (!isWalkableInsideCell(nx, ny)) continue;
            const wi = windowIndex(nx, ny);
            if (walkable[wi] === 1) continue;
            walkable[wi] = 1;
            qx[tail] = nx;
            qy[tail] = ny;
            tail += 1;
        }
    }

    // Build a crop mask by dilating the walkable interior region, so we include walls/doors/furniture around it
    // without merging neighboring interiors through wall tiles.
    const pad = 2;
    const cropMask = new Uint8Array(windowArea);
    const hasAnyInteriorTileAt = (i: number): boolean => {
        if (normalizeGid(indoor[i]) !== 0) return true;
        for (let j = 0; j < featureLayerNames.length; j += 1) {
            const name = featureLayerNames[j];
            if (!name) continue;
            const data = layerDataByName[name];
            if (!data) continue;
            if (normalizeGid(data[i]) !== 0) return true;
        }
        return false;
    };

    for (let y = window.y0; y <= window.y1; y += 1) {
        for (let x = window.x0; x <= window.x1; x += 1) {
            const wi = windowIndex(x, y);
            if (walkable[wi] !== 1) continue;
            for (let dy = -pad; dy <= pad; dy += 1) {
                for (let dx = -pad; dx <= pad; dx += 1) {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (!inWindow(nx, ny)) continue;
                    const nwi = windowIndex(nx, ny);
                    if (insideSpace[nwi] !== 1) continue;
                    cropMask[nwi] = 1;
                }
            }
        }
    }

    let bboxX0 = Number.POSITIVE_INFINITY;
    let bboxY0 = Number.POSITIVE_INFINITY;
    let bboxX1 = Number.NEGATIVE_INFINITY;
    let bboxY1 = Number.NEGATIVE_INFINITY;

    for (let y = window.y0; y <= window.y1; y += 1) {
        const rowBase = y * mapWidth;
        for (let x = window.x0; x <= window.x1; x += 1) {
            const wi = windowIndex(x, y);
            if (cropMask[wi] !== 1) continue;
            const i = rowBase + x;
            if (!hasAnyInteriorTileAt(i)) {
                cropMask[wi] = 0;
                continue;
            }
            if (x < bboxX0) bboxX0 = x;
            if (y < bboxY0) bboxY0 = y;
            if (x > bboxX1) bboxX1 = x;
            if (y > bboxY1) bboxY1 = y;
        }
    }

    if (!Number.isFinite(bboxX0) || !Number.isFinite(bboxY0) || !Number.isFinite(bboxX1) || !Number.isFinite(bboxY1)) {
        fail(`empty crop mask for seed (${seedX},${seedY})`);
    }

    const bbox = {
        x0: bboxX0,
        y0: bboxY0,
        x1: bboxX1,
        y1: bboxY1,
        width: bboxX1 - bboxX0 + 1,
        height: bboxY1 - bboxY0 + 1,
    } as const;

    // If we touched a window edge that is not the map edge, callers should expand radius and retry.
    const touchesExpandableEdge =
        (bbox.x0 === window.x0 && window.x0 > 0) ||
        (bbox.y0 === window.y0 && window.y0 > 0) ||
        (bbox.x1 === window.x1 && window.x1 < mapWidth - 1) ||
        (bbox.y1 === window.y1 && window.y1 < mapHeight - 1);
    if (touchesExpandableEdge) {
        fail(`component touches extraction window edge (radius=${radius}); increase radius`);
    }

    return {
        componentMask: cropMask,
        bbox,
        doorX,
        doorY,
        radiusUsed: radius,
        indoorFillerGid,
    };
}

function renderTiledMapJson(map: unknown): string {
    return `${JSON.stringify(map, null, 2)}\n`;
}

async function readJsonFile(filePath: string): Promise<unknown> {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content) as unknown;
}

function resolveWorldDoors(world: TiledMap): Array<{
    x: number;
    y: number;
    doorId: string;
    targetMap: string;
    targetDoor: string;
}> {
    const layers = Array.isArray(world.layers) ? world.layers : [];
    const doorsLayer = layers.find((l) => l.type === 'objectgroup' && l.name === 'doors') as
        | Extract<TiledLayer, { type: 'objectgroup' }>
        | undefined;
    const objects = doorsLayer?.objects ?? [];
    const out: Array<{ x: number; y: number; doorId: string; targetMap: string; targetDoor: string }> = [];
    for (const obj of objects) {
        const px = asNumber(obj.x);
        const py = asNumber(obj.y);
        if (px === null || py === null) {
            continue;
        }
        const props = doorProps(obj);
        const targetMap = asNonEmptyString(props.target_map);
        const targetDoor = asNonEmptyString(props.target_door);
        const doorId = asNonEmptyString(props.door_id) ?? asNonEmptyString(props.id);
        if (!targetMap || !targetDoor || !doorId) {
            continue;
        }
        out.push({ x: Math.floor(px / world.tilewidth), y: Math.floor(py / world.tileheight), doorId, targetMap, targetDoor });
    }
    return out;
}

function resolveLegacyDoorSeeds(legacy: unknown): Map<string, Readonly<{ seedX: number; seedY: number; to: string | null }>> {
    const root = asRecord(legacy);
    if (!root) {
        fail('Invalid legacy world_server.json: expected object root');
    }
    const doors = asArray(root.doors) as unknown[];
    const out = new Map<string, Readonly<{ seedX: number; seedY: number; to: string | null }>>();
    for (const raw of doors) {
        const d = asRecord(raw);
        if (!d) continue;
        const x = asNumber(d.x);
        const y = asNumber(d.y);
        const tx = asNumber(d.tx);
        const ty = asNumber(d.ty);
        const to = asNonEmptyString(d.to);
        if (x === null || y === null || tx === null || ty === null) continue;
        out.set(`${x},${y}`, { seedX: tx, seedY: ty, to });
    }
    return out;
}

function requireTileLayer(world: TiledMap, name: string): ReadonlyArray<number> {
    const layers = Array.isArray(world.layers) ? world.layers : [];
    const layer = layers.find((l) => l.type === 'tilelayer' && l.name === name) as Extract<TiledLayer, { type: 'tilelayer' }> | undefined;
    if (!layer || !isVisibleLayer(layer) || !Array.isArray(layer.data)) {
        // Some layers are intentionally absent in certain regions; treat missing as all-zero.
        return new Array(world.width * world.height).fill(0);
    }
    if (layer.data.length !== world.width * world.height) {
        fail(`Invalid world layer "${name}": expected data length ${world.width * world.height}, got ${layer.data.length}`);
    }
    return layer.data;
}

function buildHouseMap({
    world,
    worldLayerData,
    houseId,
    worldDoor,
    legacySeed,
}: {
    world: TiledMap;
    worldLayerData: Readonly<Record<string, ReadonlyArray<number>>>;
    houseId: string;
    worldDoor: Readonly<{ x: number; y: number; doorId: string; targetDoor: string }>;
    legacySeed: Readonly<{ seedX: number; seedY: number; to?: string | null }>;
}): Readonly<{
    map: unknown;
    meta: Readonly<{
        houseId: string;
        seedX: number;
        seedY: number;
        doorX: number;
        doorY: number;
        bboxWidth: number;
        bboxHeight: number;
        radiusUsed: number;
        indoorFillerGid: number;
    }>;
}> {
    const tileSize = world.tilewidth;
    const seedX = legacySeed.seedX;
    const seedY = legacySeed.seedY;

    const radii = [48, 72, 96, 128, 160];
    let extraction: Extraction | null = null;
    let lastErr: string | null = null;
    for (const r of radii) {
        try {
            extraction = extractHouseComponentFromWorld({
                world,
                seedX,
                seedY,
                radius: r,
                layerDataByName: worldLayerData,
                tileSize,
            });
            break;
        } catch (err) {
            lastErr = err instanceof Error ? err.message : String(err);
        }
    }
    if (!extraction) {
        fail(`Failed to extract ${houseId} from seed (${seedX},${seedY}): ${String(lastErr)}`);
    }

    const { bbox, componentMask, doorX, doorY, radiusUsed, indoorFillerGid } = extraction;
    const mapWidth = world.width;
    const window = makeWindow({ seedX, seedY, radius: extraction.radiusUsed, mapWidth, mapHeight: world.height });
    const windowIndex = (x: number, y: number): number => (y - window.y0) * window.width + (x - window.x0);

    const layerNames: string[] = ['cave', 'indoor', 'indoorwalls', 'indoor doors', 'carpets', 'entities', 'blocking'];

    const indoorObjects = worldLayerData['indoor objects'] ?? null;
    let includeIndoorObjects = false;
    if (indoorObjects) {
        for (let y = bbox.y0; y <= bbox.y1 && !includeIndoorObjects; y += 1) {
            for (let x = bbox.x0; x <= bbox.x1; x += 1) {
                const wi = windowIndex(x, y);
                if (componentMask[wi] !== 1) {
                    continue;
                }
                const gid = normalizeGid(indoorObjects[tileIndex(x, y, mapWidth)] ?? 0);
                if (gid !== 0) {
                    includeIndoorObjects = true;
                    break;
                }
            }
        }
    }
    if (includeIndoorObjects) {
        layerNames.splice(layerNames.indexOf('carpets') + 1, 0, 'indoor objects');
    }

    let nextLayerId = 1;
    const layers: unknown[] = [];
    for (const name of layerNames) {
        const data = worldLayerData[name];
        if (!data) {
            continue;
        }
        const out: number[] = new Array(bbox.width * bbox.height).fill(0);
        for (let y = bbox.y0; y <= bbox.y1; y += 1) {
            for (let x = bbox.x0; x <= bbox.x1; x += 1) {
                const wi = windowIndex(x, y);
                if (componentMask[wi] !== 1) {
                    continue;
                }
                const src = data[tileIndex(x, y, mapWidth)] ?? 0;
                const lx = x - bbox.x0;
                const ly = y - bbox.y0;
                out[ly * bbox.width + lx] = src;
            }
        }
        layers.push({
            data: out,
            height: bbox.height,
            id: nextLayerId++,
            name,
            opacity: 1,
            type: 'tilelayer',
            visible: true,
            width: bbox.width,
            x: 0,
            y: 0,
        });
    }

    const localDoorX = doorX - bbox.x0;
    const localDoorY = doorY - bbox.y0;

    const doorObject: unknown = {
        id: 1,
        name: '',
        type: '',
        x: localDoorX * tileSize,
        y: localDoorY * tileSize,
        width: tileSize,
        height: tileSize,
        properties: [
            { name: 'door_id', type: 'string', value: `${houseId}_entry` },
            { name: 'o', type: 'string', value: 'd' },
            { name: 'x', type: 'string', value: String(worldDoor.x) },
            { name: 'y', type: 'string', value: String(worldDoor.y) },
            { name: 'cx', type: 'string', value: String(worldDoor.x) },
            { name: 'cy', type: 'string', value: String(worldDoor.y) },
            { name: 'target_map', type: 'string', value: 'world' },
            { name: 'target_door', type: 'string', value: worldDoor.doorId },
        ],
    };

    layers.push({
        draworder: 'topdown',
        id: nextLayerId++,
        name: 'doors',
        opacity: 1,
        type: 'objectgroup',
        visible: true,
        x: 0,
        y: 0,
        objects: [doorObject],
    });

    return {
        map: {
            compressionlevel: typeof world.compressionlevel === 'number' ? world.compressionlevel : -1,
            height: bbox.height,
            infinite: false,
            layers,
            nextlayerid: nextLayerId,
        nextobjectid: 2,
        orientation: world.orientation ?? 'orthogonal',
        renderorder: world.renderorder ?? 'right-down',
        tiledversion: world.tiledversion ?? '1.11.2',
        tileheight: world.tileheight,
        tilesets: [
            { firstgid: 1, source: 'tilesheet.wang.tsj' },
            // Preserve any Mobs GIDs present in extracted layers by keeping the second tileset slot compatible.
            { firstgid: 1961, source: 'mobs.tsj' },
        ],
        tilewidth: world.tilewidth,
        type: 'map',
        version: world.version ?? '1.11',
        width: bbox.width,
        },
        meta: {
            houseId,
            seedX,
            seedY,
            doorX,
            doorY,
            bboxWidth: bbox.width,
            bboxHeight: bbox.height,
            radiusUsed,
            indoorFillerGid,
        },
    } as const;
}

async function upsertMobsTilesetTsj({ worldPath, outPath }: { worldPath: string; outPath: string }): Promise<void> {
    const raw = await readJsonFile(worldPath);
    const root = asRecord(raw);
    if (!root) {
        fail(`Invalid world map JSON: ${worldPath}`);
    }
    const tilesets = asArray(root.tilesets);
    const mobs = tilesets.map(asRecord).find((t) => t && t.name === 'Mobs') ?? null;
    if (!mobs) {
        fail(`World map "${worldPath}" is missing tileset "Mobs"`);
    }

    const tsj: UnknownRecord = {};
    // TSJ should not include firstgid; it is provided per-map.
    for (const key of ['name', 'tilewidth', 'tileheight', 'tilecount', 'columns', 'image', 'imagewidth', 'imageheight', 'tiles', 'margin', 'spacing']) {
        if (key in mobs) {
            tsj[key] = mobs[key] as unknown;
        }
    }
    tsj.type = 'tileset';

    const rendered = renderTiledMapJson(tsj);
    const existing = await fs.readFile(outPath, 'utf8').catch(() => '');
    if (existing !== rendered) {
        await fs.writeFile(outPath, rendered, 'utf8');
    }
}

async function runCheckOrGenerate({
    command,
    worldPath,
    legacyPath,
    outDir,
    onlyHouseIds,
}: {
    command: 'check' | 'generate' | 'report';
    worldPath: string;
    legacyPath: string;
    outDir: string;
    onlyHouseIds: ReadonlySet<string> | null;
}): Promise<void> {
    const rawWorld = await readJsonFile(worldPath);
    const world = rawWorld as TiledMap;
    if (!Number.isInteger(world.width) || !Number.isInteger(world.height) || !Number.isInteger(world.tilewidth) || !Number.isInteger(world.tileheight)) {
        fail(`Invalid world map "${worldPath}": missing width/height/tilewidth/tileheight`);
    }
    if (world.tilewidth !== 16 || world.tileheight !== 16) {
        fail(`Unsupported tilesize in world map: expected 16x16, got ${world.tilewidth}x${world.tileheight}`);
    }

    // Ensure the shared Mobs tileset exists for generated house maps.
    await upsertMobsTilesetTsj({ worldPath, outPath: path.join(outDir, 'mobs.tsj') });

    const legacyRaw = await readJsonFile(legacyPath);
    const legacySeedsByWorldDoorXY = resolveLegacyDoorSeeds(legacyRaw);

    const worldDoors = resolveWorldDoors(world).filter((d) => d.targetMap.startsWith('house_'));
    if (worldDoors.length === 0) {
        fail(`No house doors found in world map "${worldPath}"`);
    }

    const requiredLayers = ['cave', 'indoor', 'indoorwalls', 'indoor doors', 'carpets', 'entities', 'blocking', 'indoor objects'];
    const worldLayerData: Record<string, ReadonlyArray<number>> = {};
    for (const name of requiredLayers) {
        // "indoor objects" may be absent on some worlds; treat missing as zeros.
        worldLayerData[name] = requireTileLayer(world, name);
    }

    const planned = worldDoors
        .map((d) => ({ ...d }))
        .sort((a, b) => a.targetMap.localeCompare(b.targetMap));

    let mismatches = 0;
    const mismatchedHouseIds: string[] = [];
    const metas: Array<ReturnType<typeof buildHouseMap>['meta']> = [];
    for (const wd of planned) {
        const houseId = wd.targetMap;
        if (onlyHouseIds && !onlyHouseIds.has(houseId)) {
            continue;
        }
        const seed = legacySeedsByWorldDoorXY.get(`${wd.x},${wd.y}`);
        if (!seed) {
            fail(`Missing legacy seed mapping for world door at (${wd.x},${wd.y}) targeting ${houseId}`);
        }
        const built = buildHouseMap({
            world,
            worldLayerData,
            houseId,
            worldDoor: { x: wd.x, y: wd.y, doorId: wd.doorId, targetDoor: wd.targetDoor },
            legacySeed: seed,
        });
        metas.push(built.meta);
        const json = renderTiledMapJson(built.map);
        const outPath = path.join(outDir, `${houseId}.json`);
        if (command === 'report') {
            continue;
        }
        if (command === 'generate') {
            await fs.writeFile(outPath, json, 'utf8');
            continue;
        }
        const existing = await fs.readFile(outPath, 'utf8').catch(() => '');
        if (existing !== json) {
            mismatches += 1;
            mismatchedHouseIds.push(houseId);
        }
    }

    if (command === 'report') {
        const sorted = [...metas].sort((a, b) => a.houseId.localeCompare(b.houseId));
        console.log(
            JSON.stringify(
                sorted.map((m) => ({
                    houseId: m.houseId,
                    seed: { x: m.seedX, y: m.seedY },
                    door: { x: m.doorX, y: m.doorY },
                    size: { w: m.bboxWidth, h: m.bboxHeight },
                    radiusUsed: m.radiusUsed,
                    indoorFillerGid: m.indoorFillerGid,
                })),
                null,
                2
            )
        );
        return;
    }

    if (command === 'check') {
        if (mismatches > 0) {
            fail(
                `House maps are out of date (${mismatches} mismatched). Example: ${mismatchedHouseIds.slice(0, 5).join(', ')}. Run: bun tools/content/house-regenerate.ts generate`
            );
        }
        console.log('House maps are up to date.');
        return;
    }
    console.log('Regenerated house maps.');
}

async function main(): Promise<void> {
    const command = process.argv[2];
    if (command !== 'check' && command !== 'generate' && command !== 'report') {
        fail('Usage: bun tools/content/house-regenerate.ts <check|generate|report> [--world <path>] [--legacy <path>] [--outDir <path>] [--houses <csv>]');
    }

    const parsed = parseCliArgs(process.argv.slice(3), [
        { key: 'world', kind: 'string', defaultValue: 'assets/maps/tiled/world.json' },
        { key: 'legacy', kind: 'string', defaultValue: 'assets/maps/legacy/world_server.json' },
        { key: 'outDir', kind: 'string', defaultValue: 'assets/maps/tiled' },
        { key: 'houses', kind: 'string' },
    ]);

    const worldPath = path.resolve(String(parsed.world));
    const legacyPath = path.resolve(String(parsed.legacy));
    const outDir = path.resolve(String(parsed.outDir));

    const housesCsv = typeof parsed.houses === 'string' ? parsed.houses.trim() : '';
    const onlyHouseIds =
        housesCsv.length > 0
            ? new Set(
                  housesCsv
                      .split(',')
                      .map((v) => v.trim())
                      .filter(Boolean)
              )
            : null;

    await runCheckOrGenerate({
        command,
        worldPath,
        legacyPath,
        outDir,
        onlyHouseIds,
    });
}

void main();
