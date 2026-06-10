import fs from 'node:fs/promises';
import path from 'node:path';
import { parseCliArgs } from '../shared/cli-args';

type UnknownRecord = Record<string, unknown>;

type ScalarValue = string | number | boolean | null;
type TiledProperty = Readonly<{ name: string; value: unknown; type?: string }>;

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
          draworder?: string;
      }>
    // Parsed JSON may contain layer kinds this tool does not process (e.g. imagelayer/group);
    // keep them representable so runtime type checks stay meaningful.
    | Readonly<{
          id?: number;
          name?: string;
          type: 'imagelayer' | 'group';
          visible?: boolean | number;
          opacity?: number;
          x?: number;
          y?: number;
      }>;

type TiledTileset = Readonly<{
    firstgid: number;
    source?: string;
    name?: string;
    tiles?: unknown[];
}>;

type TiledMap = Readonly<{
    width: number;
    height: number;
    tilewidth: number;
    tileheight: number;
    layers?: TiledLayer[];
    tilesets?: TiledTileset[];
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

type Component = Readonly<{
    id: number;
    area: number;
    bbox: Readonly<{ x0: number; y0: number; x1: number; y1: number; w: number; h: number }>;
}>;

type Domain = 'world' | 'indoor' | 'cave' | 'mase';

const GLOBAL_TILE_ID_MASK = 0x1fffffff;
function normalizeGid(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value & GLOBAL_TILE_ID_MASK : 0;
}

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

function tileIndex(x: number, y: number, width: number): number {
    return y * width + x;
}

function pad2(n: number): string {
    return String(n).padStart(2, '0');
}

function propMap(obj: { properties?: TiledProperty[] } | null | undefined): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    const props = Array.isArray(obj?.properties) ? obj.properties : [];
    for (let i = 0; i < props.length; i += 1) {
        const p = props[i];
        if (!p) continue;
        const name = asNonEmptyString(p.name);
        if (!name) continue;
        out[name] = p.value;
    }
    return out;
}

function upsertProp(
    properties: TiledProperty[] | undefined,
    name: string,
    type: string,
    value: ScalarValue
): TiledProperty[] {
    const next = Array.isArray(properties) ? [...properties] : [];
    const idx = next.findIndex((p) => p.name === name);
    const entry: TiledProperty = { name, type, value };
    if (idx >= 0) {
        next[idx] = entry;
    } else {
        next.push(entry);
    }
    return next;
}

async function readJson(filePath: string): Promise<unknown> {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as unknown;
}

function requireTileLayerData(world: TiledMap, name: string): ReadonlyArray<number> {
    const layers = Array.isArray(world.layers) ? world.layers : [];
    const layer = layers.find((l) => l.type === 'tilelayer' && l.name === name) as
        | Extract<TiledLayer, { type: 'tilelayer' }>
        | undefined;
    // Note: Tiled `visible=false` is an editor hint. Gameplay-critical layers like `entities` and `blocking`
    // are frequently authored as invisible; we must still preserve their data when regenerating maps.
    if (!layer || !Array.isArray(layer.data)) {
        return new Array<number>(world.width * world.height).fill(0);
    }
    if (layer.data.length !== world.width * world.height) {
        fail(`Invalid world layer "${name}": expected ${world.width * world.height}, got ${layer.data.length}`);
    }
    return layer.data;
}

function collectTileLayerNames(world: TiledMap): string[] {
    const layers = Array.isArray(world.layers) ? world.layers : [];
    const out: string[] = [];
    for (const layer of layers) {
        if (layer.type === 'tilelayer' && typeof layer.name === 'string') {
            out.push(layer.name);
        }
    }
    return out;
}

function collectObjectLayers(world: TiledMap): Array<Extract<TiledLayer, { type: 'objectgroup' }>> {
    const layers = Array.isArray(world.layers) ? world.layers : [];
    return layers.filter((l) => l.type === 'objectgroup');
}

function makeMaskFromLayers({
    width,
    height,
    layers,
}: {
    width: number;
    height: number;
    layers: ReadonlyArray<ReadonlyArray<number>>;
}): Uint8Array {
    const out = new Uint8Array(width * height);
    for (let i = 0; i < out.length; i += 1) {
        for (let j = 0; j < layers.length; j += 1) {
            const layer = layers[j];
            if (layer && normalizeGid(layer[i]) !== 0) {
                out[i] = 1;
                break;
            }
        }
    }
    return out;
}

function labelComponents({ width, height, mask }: { width: number; height: number; mask: Uint8Array }): {
    labels: Uint16Array;
    components: Component[];
} {
    const labels = new Uint16Array(width * height);
    const comps: Array<{ id: number; area: number; x0: number; y0: number; x1: number; y1: number }> = [];
    const q = new Int32Array(width * height);
    const dirs = [1, -1, width, -width];
    let nextId = 1;

    for (let i = 0; i < mask.length; i += 1) {
        if (mask[i] !== 1 || labels[i] !== 0) continue;

        const id = nextId++;
        labels[i] = id;
        let head = 0;
        let tail = 0;
        q[tail++] = i;

        let area = 0;
        let x0 = i % width;
        let y0 = Math.floor(i / width);
        let x1 = x0;
        let y1 = y0;

        while (head < tail) {
            const cur = q[head];
            head += 1;
            if (cur === undefined) continue;
            area += 1;
            const cx = cur % width;
            const cy = Math.floor(cur / width);
            if (cx < x0) x0 = cx;
            if (cy < y0) y0 = cy;
            if (cx > x1) x1 = cx;
            if (cy > y1) y1 = cy;

            for (let d = 0; d < dirs.length; d += 1) {
                const delta = dirs[d];
                if (delta === undefined) continue;
                const ni = cur + delta;
                if (ni < 0 || ni >= mask.length) continue;
                // Prevent wrapping at row edges for +-1.
                if ((delta === 1 && cx === width - 1) || (delta === -1 && cx === 0)) continue;
                if (mask[ni] !== 1 || labels[ni] !== 0) continue;
                labels[ni] = id;
                q[tail++] = ni;
            }
        }

        comps.push({ id, area, x0, y0, x1, y1 });
    }

    const components: Component[] = comps
        .sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0 || b.area - a.area || a.id - b.id)
        .map((c, idx) => ({
            id: idx + 1,
            area: c.area,
            bbox: { x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1, w: c.x1 - c.x0 + 1, h: c.y1 - c.y0 + 1 },
        }));

    // Remap labels to match the sorted component ordering for deterministic ids.
    const idRemap = new Map<number, number>();
    for (let i = 0; i < components.length; i += 1) {
        const sourceComp = comps[i];
        const sortedComp = components[i];
        if (!sourceComp || !sortedComp) continue;
        idRemap.set(sourceComp.id, sortedComp.id);
    }
    for (let i = 0; i < labels.length; i += 1) {
        const v = labels[i] ?? 0;
        if (v === 0) continue;
        labels[i] = idRemap.get(v) ?? 0;
    }

    return { labels, components };
}

function domainForCell({
    idx,
    indoorMask,
    caveMask,
    maseMask,
    worldMask,
}: {
    idx: number;
    indoorMask: Uint8Array;
    caveMask: Uint8Array;
    maseMask: Uint8Array;
    worldMask: Uint8Array;
}): Domain {
    if (indoorMask[idx] === 1) return 'indoor';
    if (caveMask[idx] === 1) return 'cave';
    if (maseMask[idx] === 1) return 'mase';
    if (worldMask[idx] === 1) return 'world';
    return 'world';
}

function findNearestLabeledCell({
    width,
    height,
    labels,
    startX,
    startY,
    maxR,
}: {
    width: number;
    height: number;
    labels: Uint16Array;
    startX: number;
    startY: number;
    maxR: number;
}): number {
    const startIdx = tileIndex(startX, startY, width);
    const startLabel = labels[startIdx] ?? 0;
    if (startLabel !== 0) return startLabel;
    for (let r = 1; r <= maxR; r += 1) {
        for (let dy = -r; dy <= r; dy += 1) {
            for (let dx = -r; dx <= r; dx += 1) {
                const x = startX + dx;
                const y = startY + dy;
                if (x < 0 || y < 0 || x >= width || y >= height) continue;
                const v = labels[tileIndex(x, y, width)] ?? 0;
                if (v !== 0) return v;
            }
        }
    }
    return 0;
}

function computeIncludedTileLayers({
    world,
    bbox,
    cropMask,
    allTileLayerDataByName,
}: {
    world: TiledMap;
    bbox: Component['bbox'];
    cropMask: Uint8Array;
    allTileLayerDataByName: Readonly<Record<string, ReadonlyArray<number>>>;
}): string[] {
    const layers = Array.isArray(world.layers) ? world.layers : [];
    const included: string[] = [];
    for (const layer of layers) {
        if (layer.type !== 'tilelayer' || typeof layer.name !== 'string') continue;
        const data = allTileLayerDataByName[layer.name];
        if (!data) continue;
        let any = false;
        for (let y = bbox.y0; y <= bbox.y1 && !any; y += 1) {
            for (let x = bbox.x0; x <= bbox.x1; x += 1) {
                const i = tileIndex(x, y, world.width);
                if (cropMask[i] !== 1) continue;
                if (normalizeGid(data[i]) !== 0) {
                    any = true;
                    break;
                }
            }
        }
        if (any) {
            included.push(layer.name);
        }
    }
    return included;
}

function buildCropMask({
    width,
    height,
    labels,
    componentId,
    pad,
    hasTileAt,
    extraKeepCells,
}: {
    width: number;
    height: number;
    labels: Uint16Array;
    componentId: number;
    pad: number;
    hasTileAt: (idx: number) => boolean;
    extraKeepCells: ReadonlyArray<number>;
}): { cropMask: Uint8Array; bbox: Component['bbox'] } {
    const base = new Uint8Array(width * height);
    for (let i = 0; i < labels.length; i += 1) {
        if (labels[i] === componentId) base[i] = 1;
    }
    for (let i = 0; i < extraKeepCells.length; i += 1) {
        const idx = extraKeepCells[i];
        if (idx === undefined) continue;
        if (idx >= 0 && idx < base.length) base[idx] = 1;
    }

    const crop = new Uint8Array(width * height);
    let x0 = Number.POSITIVE_INFINITY;
    let y0 = Number.POSITIVE_INFINITY;
    let x1 = Number.NEGATIVE_INFINITY;
    let y1 = Number.NEGATIVE_INFINITY;

    // Dilation around base, but only retain cells that actually carry tiles (or are explicit keep cells).
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const i = tileIndex(x, y, width);
            if (base[i] !== 1) continue;

            for (let dy = -pad; dy <= pad; dy += 1) {
                for (let dx = -pad; dx <= pad; dx += 1) {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                    const ni = tileIndex(nx, ny, width);
                    if (crop[ni] === 1) continue;
                    if (!hasTileAt(ni) && base[ni] !== 1) continue;
                    crop[ni] = 1;
                }
            }
        }
    }

    for (let i = 0; i < crop.length; i += 1) {
        if (crop[i] !== 1) continue;
        const x = i % width;
        const y = Math.floor(i / width);
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
    }

    if (!Number.isFinite(x0) || !Number.isFinite(y0)) {
        fail(`Empty crop mask for component ${componentId}`);
    }

    return {
        cropMask: crop,
        bbox: { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 },
    };
}

function renderJson(value: unknown): string {
    return `${JSON.stringify(value, null, 2)}\n`;
}

type DoorResolved = Readonly<{
    globalX: number;
    globalY: number;
    globalIdx: number;
    doorId: string;
    mapId: string;
    localX: number;
    localY: number;
    to: string;
}>;

async function run({
    command,
    worldPath,
    legacyPath,
    outDir,
    writeConfig,
}: {
    command: 'report' | 'generate';
    worldPath: string;
    legacyPath: string;
    outDir: string;
    writeConfig: boolean;
}): Promise<void> {
    const rawWorld = await readJson(worldPath);
    const world = rawWorld as TiledMap;
    if (
        !Number.isInteger(world.width) ||
        !Number.isInteger(world.height) ||
        !Number.isInteger(world.tilewidth) ||
        !Number.isInteger(world.tileheight)
    ) {
        fail(`Invalid world map "${worldPath}": missing width/height/tilewidth/tileheight`);
    }
    if (world.tilewidth !== 16 || world.tileheight !== 16) {
        fail(`Unsupported tilesize in world map: expected 16x16, got ${world.tilewidth}x${world.tileheight}`);
    }

    const rawLegacy = await readJson(legacyPath);
    const legacyRoot = asRecord(rawLegacy);
    if (!legacyRoot) {
        fail(`Invalid legacy JSON: ${legacyPath}`);
    }
    const legacyDoorsRaw = asArray(legacyRoot.doors);
    // Legacy JSON entries are unvalidated; keep null in the element type so the runtime guards below stay meaningful.
    const legacyDoors: Array<LegacyDoor | null> = legacyDoorsRaw.map((d) => d as LegacyDoor | null);
    const legacyByXY = new Map<string, LegacyDoor>();
    for (const d of legacyDoors) {
        if (!d || !Number.isInteger(d.x) || !Number.isInteger(d.y)) continue;
        legacyByXY.set(`${d.x},${d.y}`, d);
    }

    const width = world.width;
    const height = world.height;
    const layerNames = collectTileLayerNames(world);
    const allTileLayerDataByName: Record<string, ReadonlyArray<number>> = {};
    for (const name of layerNames) {
        allTileLayerDataByName[name] = requireTileLayerData(world, name);
    }

    const indoorNames = ['indoor', 'indoorwalls', 'indoor doors', 'carpets', 'indoor objects'];
    const caveNames = ['cave', 'cavewalls', 'caveriver'];
    const maseNames = ['mase', 'mase walls'];
    const interiorNames = new Set<string>([...indoorNames, ...caveNames, ...maseNames]);

    const indoorMask = makeMaskFromLayers({
        width,
        height,
        layers: indoorNames.map((n) => allTileLayerDataByName[n] ?? []),
    });
    const caveMask = makeMaskFromLayers({
        width,
        height,
        layers: caveNames.map((n) => allTileLayerDataByName[n] ?? []),
    });
    const maseMask = makeMaskFromLayers({
        width,
        height,
        layers: maseNames.map((n) => allTileLayerDataByName[n] ?? []),
    });

    const outdoorLayerNames = layerNames.filter(
        (n) => !interiorNames.has(n) && n !== 'entities' && n !== 'blocking' && n !== 'plateau'
    );
    const worldMask = makeMaskFromLayers({
        width,
        height,
        layers: outdoorLayerNames.map((n) => allTileLayerDataByName[n] ?? []),
    });

    const labeledIndoor = labelComponents({ width, height, mask: indoorMask });
    const labeledCave = labelComponents({ width, height, mask: caveMask });
    const labeledMase = labelComponents({ width, height, mask: maseMask });
    const labeledWorld = labelComponents({ width, height, mask: worldMask });

    const mapIdsByDomainComponent = new Map<string, string>();
    for (let i = 0; i < labeledWorld.components.length; i += 1) {
        mapIdsByDomainComponent.set(`world:${i + 1}`, `world_${pad2(i + 1)}`);
    }
    for (let i = 0; i < labeledIndoor.components.length; i += 1) {
        mapIdsByDomainComponent.set(`indoor:${i + 1}`, `indoor_${pad2(i + 1)}`);
    }
    for (let i = 0; i < labeledCave.components.length; i += 1) {
        mapIdsByDomainComponent.set(`cave:${i + 1}`, `cave_${pad2(i + 1)}`);
    }
    for (let i = 0; i < labeledMase.components.length; i += 1) {
        mapIdsByDomainComponent.set(`mase:${i + 1}`, `mase_${pad2(i + 1)}`);
    }

    const doorLayer = (Array.isArray(world.layers) ? world.layers : []).find(
        (l) => l.type === 'objectgroup' && l.name === 'doors'
    ) as Extract<TiledLayer, { type: 'objectgroup' }> | undefined;
    const doorObjects = doorLayer?.objects ?? [];

    // Build a coordinate index for authored door objects.
    const authoredDoorObjectByXY = new Map<string, TiledObject>();
    for (const obj of doorObjects) {
        const px = asNumber(obj.x);
        const py = asNumber(obj.y);
        if (px === null || py === null) continue;
        const gx = Math.floor(px / world.tilewidth);
        const gy = Math.floor(py / world.tileheight);
        authoredDoorObjectByXY.set(`${gx},${gy}`, obj);
    }

    // Resolve all door endpoints referenced by legacy content, creating "stub" destination doors
    // when the legacy destination doesn't correspond to an authored door object.
    const allDoorPoints: Array<{ x: number; y: number }> = [];
    const seenDoorPoints = new Set<string>();
    for (const d of legacyDoors) {
        if (!d) continue;
        const points: Array<[number, number]> = [
            [d.x, d.y],
            [d.tx, d.ty],
        ];
        for (const [x, y] of points) {
            if (!Number.isInteger(x) || !Number.isInteger(y)) continue;
            const key = `${x},${y}`;
            if (seenDoorPoints.has(key)) continue;
            seenDoorPoints.add(key);
            allDoorPoints.push({ x, y });
        }
    }

    // Resolve each door point's map assignment + stable id.
    const doorResolved: DoorResolved[] = [];
    const doorIdByXY = new Map<string, string>();

    // Pre-pass: determine door ids (reuse explicit ids when present, else key by coordinate).
    for (const pt of allDoorPoints) {
        const gx = pt.x;
        const gy = pt.y;
        const obj = authoredDoorObjectByXY.get(`${gx},${gy}`) ?? null;
        const props = obj ? propMap(obj) : {};
        const explicitDoorId = asNonEmptyString(props.door_id) ?? asNonEmptyString(props.id);
        const id = explicitDoorId ?? `door_${gx}_${gy}`;
        doorIdByXY.set(`${gx},${gy}`, id);
    }

    // Second pass: map membership + to/orientation from legacy (defaulting to 'd' for stubs).
    for (const pt of allDoorPoints) {
        const gx = pt.x;
        const gy = pt.y;
        const gIdx = tileIndex(gx, gy, width);
        const legacy = legacyByXY.get(`${gx},${gy}`) ?? null;

        const domain = domainForCell({ idx: gIdx, indoorMask, caveMask, maseMask, worldMask });
        const labels =
            domain === 'indoor'
                ? labeledIndoor.labels
                : domain === 'cave'
                  ? labeledCave.labels
                  : domain === 'mase'
                    ? labeledMase.labels
                    : labeledWorld.labels;
        const componentId = findNearestLabeledCell({ width, height, labels, startX: gx, startY: gy, maxR: 6 });
        if (componentId === 0) {
            fail(`Unable to assign door (${gx},${gy}) to a ${domain} component`);
        }

        const mapId = mapIdsByDomainComponent.get(`${domain}:${componentId}`);
        if (!mapId) {
            fail(`Missing map id mapping for ${domain}:${componentId}`);
        }

        const doorId = doorIdByXY.get(`${gx},${gy}`);
        if (!doorId) {
            fail(`Missing door id for (${gx},${gy})`);
        }

        // Local coordinates depend on the final crop bbox; fill later.
        doorResolved.push({
            globalX: gx,
            globalY: gy,
            globalIdx: gIdx,
            doorId,
            mapId,
            localX: -1,
            localY: -1,
            to: typeof legacy?.to === 'string' ? legacy.to : 'd',
        });
    }

    // Group doors by map id for crop forcing.
    const doorsByMapId = new Map<string, DoorResolved[]>();
    for (const d of doorResolved) {
        const list = doorsByMapId.get(d.mapId) ?? [];
        list.push(d);
        doorsByMapId.set(d.mapId, list);
    }

    type MapBuild = Readonly<{
        id: string;
        domain: Domain;
        componentId: number;
        labels: Uint16Array;
        tileSize: number;
        bbox: Component['bbox'];
        cropMask: Uint8Array;
        includedTileLayerNames: string[];
        includedObjectLayerNames: string[];
    }>;

    const buildPlans: MapBuild[] = [];

    const buildForDomain = ({
        domain,
        labeled,
    }: {
        domain: Domain;
        labeled: { labels: Uint16Array; components: Component[] };
    }): void => {
        for (let i = 0; i < labeled.components.length; i += 1) {
            const componentId = i + 1;
            const mapId = mapIdsByDomainComponent.get(`${domain}:${componentId}`);
            if (!mapId) continue;
            const extraDoorCells = (doorsByMapId.get(mapId) ?? []).map((d) => d.globalIdx);

            const hasAnyTileAt = (idx: number): boolean => {
                // Consider any tilelayer except "don't remove this layer" as tile-bearing for cropping.
                for (let j = 0; j < layerNames.length; j += 1) {
                    const name = layerNames[j];
                    if (!name) continue;
                    if (name === "don't remove this layer") continue;
                    const data = allTileLayerDataByName[name];
                    if (!data) continue;
                    if (normalizeGid(data[idx]) !== 0) return true;
                }
                return false;
            };

            const { cropMask, bbox } = buildCropMask({
                width,
                height,
                labels: labeled.labels,
                componentId,
                pad: 2,
                hasTileAt: hasAnyTileAt,
                extraKeepCells: extraDoorCells,
            });

            const includedTileLayerNames = computeIncludedTileLayers({
                world,
                bbox,
                cropMask,
                allTileLayerDataByName,
            });

            // Object layers: include if any object anchor is inside crop.
            const objectLayers = collectObjectLayers(world);
            const includedObjectLayerNames: string[] = [];
            for (const layer of objectLayers) {
                const objects = layer.objects ?? [];
                let any = false;
                for (const obj of objects) {
                    const ox = asNumber(obj.x);
                    const oy = asNumber(obj.y);
                    if (ox === null || oy === null) continue;
                    const gx = Math.floor(ox / world.tilewidth);
                    const gy = Math.floor(oy / world.tileheight);
                    if (gx < bbox.x0 || gy < bbox.y0 || gx > bbox.x1 || gy > bbox.y1) continue;
                    const idx = tileIndex(gx, gy, width);
                    if (cropMask[idx] === 1) {
                        any = true;
                        break;
                    }
                }
                if (any) {
                    includedObjectLayerNames.push(layer.name ?? '');
                }
            }
            // Ensure `doors` is present whenever this map contains any door endpoints (including stubs).
            if ((doorsByMapId.get(mapId) ?? []).length > 0 && !includedObjectLayerNames.includes('doors')) {
                includedObjectLayerNames.push('doors');
            }

            buildPlans.push({
                id: mapId,
                domain,
                componentId,
                labels: labeled.labels,
                tileSize: world.tilewidth,
                bbox,
                cropMask,
                includedTileLayerNames,
                includedObjectLayerNames,
            });
        }
    };

    buildForDomain({ domain: 'world', labeled: labeledWorld });
    buildForDomain({ domain: 'indoor', labeled: labeledIndoor });
    buildForDomain({ domain: 'cave', labeled: labeledCave });
    buildForDomain({ domain: 'mase', labeled: labeledMase });

    buildPlans.sort((a, b) => a.id.localeCompare(b.id));

    // Compute final door local coords based on build bbox.
    const buildById = new Map<string, MapBuild>();
    for (const b of buildPlans) {
        buildById.set(b.id, b);
    }
    const doorByXY = new Map<string, DoorResolved>();
    const finalizedDoors: DoorResolved[] = [];
    for (const d of doorResolved) {
        const build = buildById.get(d.mapId);
        if (!build) {
            fail(`Missing build plan for door map ${d.mapId}`);
        }
        const localX = d.globalX - build.bbox.x0;
        const localY = d.globalY - build.bbox.y0;
        const next: DoorResolved = { ...d, localX, localY };
        finalizedDoors.push(next);
        doorByXY.set(`${d.globalX},${d.globalY}`, next);
    }

    // Report summary.
    if (command === 'report') {
        const summary = {
            world: { components: labeledWorld.components.length },
            indoor: { components: labeledIndoor.components.length },
            cave: { components: labeledCave.components.length },
            mase: { components: labeledMase.components.length },
            doors: { total: finalizedDoors.length },
            maps: buildPlans.map((m) => ({
                id: m.id,
                domain: m.domain,
                bbox: { x: m.bbox.x0, y: m.bbox.y0, w: m.bbox.w, h: m.bbox.h },
                tileLayers: m.includedTileLayerNames.length,
                objectLayers: m.includedObjectLayerNames.length,
            })),
        };
        console.log(renderJson(summary));
        return;
    }

    await fs.mkdir(outDir, { recursive: true });

    // Ensure external tilesets referenced by generated maps exist alongside them, so map-pack build tooling can inline.
    const tilesetSourceDir = path.dirname(worldPath);
    for (const filename of ['tilesheet.wang.tsj', 'mobs.tsj'] as const) {
        const src = path.join(tilesetSourceDir, filename);
        const dst = path.join(outDir, filename);
        const srcText = await fs.readFile(src, 'utf8').catch(() => null);
        if (srcText === null) {
            fail(`Missing required tileset source: ${src}`);
        }
        const dstText = await fs.readFile(dst, 'utf8').catch(() => null);
        if (dstText !== srcText) {
            await fs.writeFile(dst, srcText, 'utf8');
        }
    }

    const layers = Array.isArray(world.layers) ? world.layers : [];
    const tilesets: unknown[] = [
        { firstgid: 1, source: 'tilesheet.wang.tsj' },
        { firstgid: 1961, source: 'mobs.tsj' },
    ];

    // Generate per-map jsons.
    for (const plan of buildPlans) {
        const bbox = plan.bbox;
        const cropMask = plan.cropMask;
        const outLayers: unknown[] = [];
        let nextLayerId = 1;
        let nextObjectId = 1;

        for (const layer of layers) {
            if (layer.type === 'tilelayer') {
                const name = layer.name ?? '';
                if (!plan.includedTileLayerNames.includes(name)) {
                    continue;
                }
                const data = allTileLayerDataByName[name] ?? [];
                const out: number[] = new Array<number>(bbox.w * bbox.h).fill(0);
                for (let y = bbox.y0; y <= bbox.y1; y += 1) {
                    for (let x = bbox.x0; x <= bbox.x1; x += 1) {
                        const gi = tileIndex(x, y, width);
                        if (cropMask[gi] !== 1) continue;
                        const src = data[gi] ?? 0;
                        const lx = x - bbox.x0;
                        const ly = y - bbox.y0;
                        out[ly * bbox.w + lx] = src;
                    }
                }
                outLayers.push({
                    data: out,
                    height: bbox.h,
                    id: nextLayerId++,
                    name,
                    opacity: typeof layer.opacity === 'number' ? layer.opacity : 1,
                    type: 'tilelayer',
                    visible: true,
                    width: bbox.w,
                    x: 0,
                    y: 0,
                });
                continue;
            }

            if (layer.type === 'objectgroup') {
                const name = layer.name ?? '';
                if (!plan.includedObjectLayerNames.includes(name)) {
                    continue;
                }
                const outObjects: unknown[] = [];

                if (name === 'doors') {
                    const doorPoints = doorsByMapId.get(plan.id) ?? [];
                    for (const dp of doorPoints) {
                        const gx = dp.globalX;
                        const gy = dp.globalY;
                        const gi = tileIndex(gx, gy, width);
                        if (gx < bbox.x0 || gy < bbox.y0 || gx > bbox.x1 || gy > bbox.y1) continue;
                        if (cropMask[gi] !== 1) continue;

                        const authored = authoredDoorObjectByXY.get(`${gx},${gy}`) ?? null;
                        const baseProps = authored
                            ? Array.isArray(authored.properties)
                                ? [...authored.properties]
                                : []
                            : [];
                        let nextProps = baseProps;

                        // Always ensure a stable door id exists.
                        nextProps = upsertProp(nextProps, 'door_id', 'string', dp.doorId);

                        const legacy = legacyByXY.get(`${gx},${gy}`) ?? null;
                        if (legacy) {
                            const dest = doorByXY.get(`${legacy.tx},${legacy.ty}`) ?? null;
                            if (!dest) {
                                fail(`Missing destination door for (${gx},${gy}) -> (${legacy.tx},${legacy.ty})`);
                            }
                            nextProps = upsertProp(nextProps, 'target_map', 'string', dest.mapId);
                            nextProps = upsertProp(nextProps, 'target_door', 'string', dest.doorId);
                            nextProps = upsertProp(nextProps, 'o', 'string', dp.to);
                            nextProps = upsertProp(nextProps, 'x', 'string', String(dest.localX));
                            nextProps = upsertProp(nextProps, 'y', 'string', String(dest.localY));
                            const tcx =
                                typeof legacy.tcx === 'number' && Number.isFinite(legacy.tcx)
                                    ? legacy.tcx
                                    : dest.localX;
                            const tcy =
                                typeof legacy.tcy === 'number' && Number.isFinite(legacy.tcy)
                                    ? legacy.tcy
                                    : dest.localY;
                            nextProps = upsertProp(nextProps, 'cx', 'string', String(tcx));
                            nextProps = upsertProp(nextProps, 'cy', 'string', String(tcy));
                        }

                        outObjects.push({
                            ...(authored ?? {}),
                            id: nextObjectId++,
                            x: (gx - bbox.x0) * world.tilewidth,
                            y: (gy - bbox.y0) * world.tileheight,
                            width: authored?.width ?? world.tilewidth,
                            height: authored?.height ?? world.tileheight,
                            properties: nextProps,
                        });
                    }
                } else {
                    const objects = layer.objects ?? [];
                    for (const obj of objects) {
                        const ox = asNumber(obj.x);
                        const oy = asNumber(obj.y);
                        if (ox === null || oy === null) continue;
                        const gx = Math.floor(ox / world.tilewidth);
                        const gy = Math.floor(oy / world.tileheight);
                        if (gx < bbox.x0 || gy < bbox.y0 || gx > bbox.x1 || gy > bbox.y1) continue;
                        const gi = tileIndex(gx, gy, width);
                        if (cropMask[gi] !== 1) continue;
                        outObjects.push({
                            ...obj,
                            id: nextObjectId++,
                            x: ox - bbox.x0 * world.tilewidth,
                            y: oy - bbox.y0 * world.tileheight,
                        });
                    }
                }

                if (outObjects.length > 0) {
                    outLayers.push({
                        draworder: layer.draworder ?? 'topdown',
                        id: nextLayerId++,
                        name,
                        opacity: typeof layer.opacity === 'number' ? layer.opacity : 1,
                        type: 'objectgroup',
                        visible: true,
                        x: 0,
                        y: 0,
                        objects: outObjects,
                    });
                }
            }
        }

        const outMap: unknown = {
            compressionlevel: typeof world.compressionlevel === 'number' ? world.compressionlevel : -1,
            height: bbox.h,
            infinite: false,
            layers: outLayers,
            nextlayerid: nextLayerId,
            nextobjectid: nextObjectId,
            orientation: world.orientation ?? 'orthogonal',
            renderorder: world.renderorder ?? 'right-down',
            tiledversion: world.tiledversion ?? '1.11.2',
            tileheight: world.tileheight,
            tilesets,
            tilewidth: world.tilewidth,
            type: 'map',
            version: world.version ?? '1.11',
            width: bbox.w,
        };

        const outPath = path.join(outDir, `${plan.id}.json`);
        await fs.writeFile(outPath, renderJson(outMap), 'utf8');
    }

    if (writeConfig) {
        const domainOrder: Record<string, number> = { world: 0, indoor: 1, cave: 2, mase: 3 };
        const orderedPlans = [...buildPlans].sort((a, b) => {
            const ao = domainOrder[a.domain] ?? 99;
            const bo = domainOrder[b.domain] ?? 99;
            if (ao !== bo) return ao - bo;
            return a.id.localeCompare(b.id);
        });
        const config = {
            maps: orderedPlans.map((p) => ({ id: p.id, filepath: `./${p.id}.json` })),
            edges: [],
        };
        const configPath = path.join(outDir, 'map-pack.config.json');
        await fs.writeFile(configPath, renderJson(config), 'utf8');
    }

    console.log(`Generated ${buildPlans.length} maps into ${outDir}`);
}

async function main(): Promise<void> {
    const command = process.argv[2];
    if (command !== 'report' && command !== 'generate') {
        fail(
            'Usage: bun tools/content/world-resplit.ts <report|generate> [--world <path>] [--legacy <path>] [--outDir <path>] [--writeConfig <0|1>]'
        );
    }

    const parsed = parseCliArgs(process.argv.slice(3), [
        { key: 'world', kind: 'string', defaultValue: 'assets/maps/tiled/world.json' },
        { key: 'legacy', kind: 'string', defaultValue: 'assets/maps/legacy/world_server.json' },
        { key: 'outDir', kind: 'string', defaultValue: '.tmp/world-resplit' },
        { key: 'writeConfig', kind: 'number', defaultValue: 1 },
    ]);

    const worldPath = path.resolve(String(parsed.world));
    const legacyPath = path.resolve(String(parsed.legacy));
    const outDir = path.resolve(String(parsed.outDir));
    const writeConfig = Number(parsed.writeConfig) === 1;

    await run({
        command,
        worldPath,
        legacyPath,
        outDir,
        writeConfig,
    });
}

void main();
