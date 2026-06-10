import { ENTITY_KIND_DOMAIN, type EntityKindName } from '../entity-kind-domain';
import Types from '../gametypes-browser';

type ExportMode = "client" | "server";
type ScalarValue = string | number | boolean | null;
type MapFieldValue = ScalarValue | Array<number | undefined> | undefined;
type MapRecord = Record<string, MapFieldValue>;

type TiledProperty = {
    name: string;
    value: ScalarValue;
};

type TiledTile = {
    id: number;
    properties?: TiledProperty[];
    animation?: Array<{
        tileid: number;
        duration: number;
    }>;
    objectgroup?: {
        type?: string;
        objects?: TiledObject[];
    };
};

type TiledTileset = {
    name: string;
    firstgid?: number;
    objectalignment?: string;
    tilewidth?: number;
    tileheight?: number;
    tiles?: TiledTile[];
};

type TiledObject = {
    id?: number;
    gid?: number;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;
    type?: string;
    class?: string;
    template?: string;
    properties?: TiledProperty[];
};

type TiledLayerBase = {
    name: string;
    type: string;
    visible?: boolean | number;
    class?: string;
    opacity?: number;
    offsetx?: number;
    offsety?: number;
    properties?: TiledProperty[];
};

type TiledTileLayer = TiledLayerBase & {
    type: "tilelayer";
    data?: number[];
};

type TiledObjectLayer = TiledLayerBase & {
    type: "objectgroup";
    objects?: TiledObject[];
};

type TiledGroupLayer = TiledLayerBase & {
    type: "group";
    layers?: TiledLayer[];
};

type FlattenedLayerMeta = Readonly<{
    groupPath: string[];
    layerPath: string[];
    inheritedProperties: TiledProperty[];
    offsetX: number;
    offsetY: number;
    opacity: number;
}>;

type FlattenedTiledTileLayer = TiledTileLayer & {
    _bqMeta?: FlattenedLayerMeta;
};

type FlattenedTiledObjectLayer = TiledObjectLayer & {
    _bqMeta?: FlattenedLayerMeta;
};

type TiledLayer =
    | TiledTileLayer
    | TiledObjectLayer
    | TiledGroupLayer
    | (TiledLayerBase & Record<string, ScalarValue | number[] | object | undefined>);

type TiledMapJson = {
    width: number;
    height: number;
    tilewidth: number;
    tilesets?: TiledTileset[];
    layers?: TiledLayer[];
};

type ExportedDoor = {
    x: number;
    y: number;
    p: number;
    [key: string]: MapFieldValue;
};

type ExportedCheckpoint = {
    id: number;
    x: number;
    y: number;
    w: number;
    h: number;
    s?: number;
};

type ExportedRenderPropPart = {
    index: number;
    gid: number;
};

type ExportedRenderProp = {
    depth: number;
    minTileX: number;
    minTileY: number;
    maxTileX: number;
    maxTileY: number;
    parts: ExportedRenderPropPart[];
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
};

type ExportedMap = {
    width: number;
    height: number;
    tilesize: number;
    collisions: number[];
    doors: ExportedDoor[];
    checkpoints: ExportedCheckpoint[];
    data?: Array<number | number[]>;
    foreground?: Array<number | number[]>;
    renderProps?: ExportedRenderProp[];
    animated?: Record<number, { l?: number; d?: number }>;
    blocking?: number[];
    plateau?: number[];
    navIslandByTile?: number[];
    navIslandCount?: number;
    primaryNavIslandId?: number;
    debugPassability?: {
        water: number[];
        damage: number[];
        interactable: number[];
    };
    musicAreas?: Array<{ x: number; y: number; w: number; h: number; id: ScalarValue | undefined }>;
    roamingAreas?: Array<MapRecord>;
    resourceNodes?: Array<MapRecord>;
    chestAreas?: Array<MapRecord>;
    staticChests?: Array<{ x: number; y: number; i: number[] }>;
    staticEntities?: Record<number, EntityKindName>;
};

const GLOBAL_TILE_ID_MASK = 0x1fffffff;
const LEGACY_DOOR_PROPERTY_RENAMES: Readonly<Record<string, string>> = {
    o: 'orientation',
    x: 'target_tx',
    y: 'target_ty',
    cx: 'camera_tx',
    cy: 'camera_ty',
};
const STRICT_OBJECT_CLASS_LAYERS = new Set([
    'doors',
    'resource_nodes',
    'static_entities',
    'chest_spawns',
    'chest_areas',
    'roaming_areas',
    'zones',
    'music_zones',
    'checkpoints',
    'mobile_zones',
]);
const DEBUG_WATER_LAYER_NAMES = new Set([
    'sea',
    'shoreline',
    'lakes',
    'river',
    'cave_river',
    'forest_lakes',
]);
const DEBUG_DAMAGE_LAYER_NAMES = new Set([
    'lava',
    'lava_falls',
]);
const DEBUG_INTERACTABLE_OBJECT_LAYERS = new Set([
    'resource_nodes',
    'static_entities',
    'chest_spawns',
]);
const RENDERABLE_TILE_OBJECT_ALIGNMENT = new Set([
    'unspecified',
    'topleft',
    'top',
    'topright',
    'left',
    'center',
    'right',
    'bottomleft',
    'bottom',
    'bottomright',
]);

function isEntityKindName(value: string): value is EntityKindName {
    return value in ENTITY_KIND_DOMAIN;
}

function normalizeGid(value: number | string | boolean | null | undefined): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return 0;
    }
    return value & GLOBAL_TILE_ID_MASK;
}

function normalizeScalar(value: ScalarValue): ScalarValue {
    if (typeof value !== "string") {
        return value;
    }

    const text = value.trim();
    if (/^-?\d+$/.test(text)) {
        return Number.parseInt(text, 10);
    }
    if (/^-?\d+\.\d+$/.test(text)) {
        return Number.parseFloat(text);
    }

    return value;
}

function parseIntegerLike(value: ScalarValue | undefined): number | null {
    if (typeof value === 'number' && Number.isInteger(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const text = value.trim();
        if (/^-?\d+$/.test(text)) {
            return Number.parseInt(text, 10);
        }
    }
    return null;
}

function getProperties(value: { properties?: TiledProperty[] }): TiledProperty[] {
    return Array.isArray(value.properties) ? value.properties : [];
}

function getPropertyValue(value: { properties?: TiledProperty[] }, name: string): ScalarValue | undefined {
    const property = getProperties(value).find((entry) => entry.name === name);
    return property ? normalizeScalar(property.value) : undefined;
}

function getObjectClassName(object: TiledObject): string | undefined {
    if (typeof object.class === 'string' && object.class.trim().length > 0) {
        return object.class.trim();
    }
    if (typeof object.type === 'string' && object.type.trim().length > 0) {
        return object.type.trim();
    }
    return undefined;
}

function isTileLayer(layer: TiledLayer): layer is TiledTileLayer {
    return layer.type === "tilelayer";
}

function isObjectLayer(layer: TiledLayer): layer is TiledObjectLayer {
    return layer.type === "objectgroup";
}

function isGroupLayer(layer: TiledLayer): layer is TiledGroupLayer {
    return layer.type === 'group';
}

function isLayerVisible(layer: TiledLayerBase): boolean {
    return layer.visible !== false && layer.visible !== 0;
}

function isForegroundLayer(layer: TiledTileLayer): boolean {
    return typeof layer.class === 'string' && layer.class.trim() === 'Foreground';
}

function isForegroundObjectLayer(layer: TiledObjectLayer): boolean {
    return typeof layer.class === 'string' && layer.class.trim() === 'Foreground';
}

function isDepthSortedObjectLayer(layer: TiledObjectLayer): boolean {
    return typeof layer.class === 'string' && layer.class.trim() === 'DepthSorted';
}

function mergeProperties(base: TiledProperty[], override: TiledProperty[] | undefined): TiledProperty[] {
    const merged = new Map<string, TiledProperty>();
    for (const property of base) {
        merged.set(property.name, property);
    }
    for (const property of Array.isArray(override) ? override : []) {
        merged.set(property.name, property);
    }
    return [...merged.values()];
}

function shiftTileLayerData(
    data: number[] | undefined,
    width: number,
    height: number,
    offsetX: number,
    offsetY: number,
    tileSize: number,
    layerName: string
): number[] | undefined {
    if (!Array.isArray(data) || data.length === 0) {
        return data;
    }
    if (offsetX === 0 && offsetY === 0) {
        return data.map(normalizeGid);
    }
    if (offsetX % tileSize !== 0 || offsetY % tileSize !== 0) {
        throw new Error(
            `Tile layer "${layerName}" uses sub-tile offset (${offsetX}, ${offsetY}), which BrowserQuest does not support.`
        );
    }

    const dx = Math.trunc(offsetX / tileSize);
    const dy = Math.trunc(offsetY / tileSize);
    const shifted = new Array<number>(width * height).fill(0);
    for (let index = 0; index < data.length; index += 1) {
        const gid = normalizeGid(data[index] ?? 0);
        if (gid <= 0) {
            continue;
        }
        const x = index % width;
        const y = Math.floor(index / width);
        const shiftedX = x + dx;
        const shiftedY = y + dy;
        if (shiftedX < 0 || shiftedY < 0 || shiftedX >= width || shiftedY >= height) {
            continue;
        }
        shifted[shiftedY * width + shiftedX] = gid;
    }
    return shifted;
}

function flattenTiledLayers(
    layers: TiledLayer[],
    width: number,
    height: number,
    tileSize: number,
    parent: FlattenLayerContext = {
        visible: true,
        groupPath: [],
        inheritedProperties: [],
        offsetX: 0,
        offsetY: 0,
        opacity: 1,
    }
): Array<FlattenedTiledTileLayer | FlattenedTiledObjectLayer> {
    const flattened: Array<FlattenedTiledTileLayer | FlattenedTiledObjectLayer> = [];
    for (const layer of layers) {
        if (isGroupLayer(layer)) {
            const nextContext: FlattenLayerContext = {
                visible: parent.visible && isLayerVisible(layer),
                groupPath:
                    typeof layer.name === 'string' && layer.name.trim().length > 0
                        ? [...parent.groupPath, layer.name]
                        : [...parent.groupPath],
                inheritedProperties: mergeProperties(parent.inheritedProperties, layer.properties),
                offsetX:
                    parent.offsetX
                    + (typeof layer.offsetx === 'number' && Number.isFinite(layer.offsetx) ? layer.offsetx : 0),
                offsetY:
                    parent.offsetY
                    + (typeof layer.offsety === 'number' && Number.isFinite(layer.offsety) ? layer.offsety : 0),
                opacity:
                    parent.opacity
                    * (typeof layer.opacity === 'number' && Number.isFinite(layer.opacity) ? layer.opacity : 1),
            };
            flattened.push(...flattenTiledLayers(Array.isArray(layer.layers) ? layer.layers : [], width, height, tileSize, nextContext));
            continue;
        }

        const ownOffsetX = typeof layer.offsetx === 'number' && Number.isFinite(layer.offsetx) ? layer.offsetx : 0;
        const ownOffsetY = typeof layer.offsety === 'number' && Number.isFinite(layer.offsety) ? layer.offsety : 0;
        const effectiveOffsetX = parent.offsetX + ownOffsetX;
        const effectiveOffsetY = parent.offsetY + ownOffsetY;
        const meta: FlattenedLayerMeta = {
            groupPath: [...parent.groupPath],
            layerPath: [...parent.groupPath, layer.name],
            inheritedProperties: mergeProperties(parent.inheritedProperties, layer.properties),
            offsetX: effectiveOffsetX,
            offsetY: effectiveOffsetY,
            opacity:
                parent.opacity * (typeof layer.opacity === 'number' && Number.isFinite(layer.opacity) ? layer.opacity : 1),
        };

        if (isTileLayer(layer)) {
            flattened.push({
                ...layer,
                visible: parent.visible && isLayerVisible(layer),
                properties: meta.inheritedProperties,
                offsetx: 0,
                offsety: 0,
                data: shiftTileLayerData(layer.data, width, height, effectiveOffsetX, effectiveOffsetY, tileSize, layer.name),
                _bqMeta: meta,
            });
            continue;
        }

        if (isObjectLayer(layer)) {
            flattened.push({
                ...layer,
                visible: parent.visible && isLayerVisible(layer),
                properties: meta.inheritedProperties,
                offsetx: 0,
                offsety: 0,
                objects: (Array.isArray(layer.objects) ? layer.objects : []).map((object) => ({
                    ...object,
                    x: object.x + effectiveOffsetX,
                    y: object.y + effectiveOffsetY,
                })),
                _bqMeta: meta,
            });
        }
    }
    return flattened;
}

function isTruthy(value: ScalarValue | undefined): boolean {
    if (value === true || value === 1) {
        return true;
    }
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        return normalized === 'true' || normalized === '1' || normalized === 'yes';
    }
    return false;
}

function isPortalDoorObject(door: TiledObject): boolean {
    const kind = getPropertyValue(door, 'door_kind');
    if (typeof kind === 'string' && kind.trim().toLowerCase() === 'portal') {
        return true;
    }
    if (isTruthy(getPropertyValue(door, 'is_portal'))) {
        return true;
    }
    return door.class === 'Portal';
}

function normalizeDoorPropertyName(name: string): string {
    switch (name) {
        case 'orientation':
            return 'o';
        case 'target_tx':
            return 'x';
        case 'target_ty':
            return 'y';
        case 'camera_tx':
            return 'cx';
        case 'camera_ty':
            return 'cy';
        default:
            return name;
    }
}

function assertObjectClassPresent(layerName: string, object: TiledObject): void {
    if (typeof getObjectClassName(object) === 'string') {
        return;
    }
    const objectId = Number.isInteger(object.id) ? String(object.id) : 'no-id';
    throw new Error(`Object ${objectId} in layer "${layerName}" is missing required class/type.`);
}

function toLayerTileData(layer: TiledTileLayer): number[] {
    if (!Array.isArray(layer.data)) {
        return [];
    }
    return layer.data.map(normalizeGid);
}

function toMode(value: string | undefined): ExportMode {
    return value === "client" ? "client" : "server";
}

function uniqueValidIndices(indices: number[], limit: number): number[] {
    if (limit <= 0) {
        return [];
    }
    const seen = new Set<number>();
    for (let i = 0; i < indices.length; i += 1) {
        const value = indices[i] ?? -1;
        if (!Number.isInteger(value) || value < 0 || value >= limit) {
            continue;
        }
        seen.add(value);
    }
    return [...seen].sort((a, b) => a - b);
}

type ResolvedTilesetRef = Readonly<{
    firstgid: number;
    lastgid: number;
    name: string;
    tileWidth: number;
    tileHeight: number;
    objectAlignment: string;
}>;

type ResolvedRenderableTileObject = Readonly<{
    gid: number;
    tileX: number;
    tileY: number;
    tileIndex: number;
    objectId: number | null;
    objectClassName?: string;
    template?: string;
    properties: TiledProperty[];
}>;

type FlattenLayerContext = Readonly<{
    visible: boolean;
    groupPath: string[];
    inheritedProperties: TiledProperty[];
    offsetX: number;
    offsetY: number;
    opacity: number;
}>;

function resolveTileObjectAlignment(value: string | undefined): string {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : 'unspecified';
    return RENDERABLE_TILE_OBJECT_ALIGNMENT.has(normalized) ? normalized : 'unspecified';
}

function alignmentOffsetX(alignment: string, width: number): number {
    switch (alignment) {
        case 'top':
        case 'center':
        case 'bottom':
            return width / 2;
        case 'topright':
        case 'right':
        case 'bottomright':
            return width;
        default:
            return 0;
    }
}

function alignmentOffsetY(alignment: string, height: number): number {
    switch (alignment) {
        case 'left':
        case 'center':
        case 'right':
            return height / 2;
        case 'bottomleft':
        case 'bottom':
        case 'bottomright':
        case 'unspecified':
            return height;
        default:
            return 0;
    }
}

function getLayerPath(layer: TiledLayerBase & { _bqMeta?: FlattenedLayerMeta }): string {
    const path = layer._bqMeta?.layerPath;
    return Array.isArray(path) && path.length > 0 ? path.join('/') : layer.name;
}

function getMetadataValue(
    layer: TiledLayerBase & { _bqMeta?: FlattenedLayerMeta },
    entries: ReadonlyArray<ResolvedRenderableTileObject>,
    name: string
): ScalarValue | undefined {
    for (const entry of entries) {
        const value = getPropertyValue({ properties: entry.properties }, name);
        if (value !== undefined) {
            return value;
        }
    }
    return getPropertyValue(layer, name);
}

function parseTagList(value: ScalarValue | undefined): string[] | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }
    const tags = value
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
    return tags.length > 0 ? [...new Set(tags)] : undefined;
}

function deriveNavigationIslands(width: number, height: number, blockedIndices: ReadonlyArray<number>): {
    islandByTile: number[];
    islandCount: number;
    primaryIslandId: number;
} {
    const tileCount = width * height;
    if (tileCount <= 0) {
        return { islandByTile: [], islandCount: 0, primaryIslandId: 0 };
    }

    const blocked = new Uint8Array(tileCount);
    for (let i = 0; i < blockedIndices.length; i += 1) {
        const idx = blockedIndices[i] ?? -1;
        if (idx >= 0 && idx < tileCount) {
            blocked[idx] = 1;
        }
    }

    const islandByTile = new Int32Array(tileCount);
    const queue: number[] = [];
    let islandCount = 0;
    let primaryIslandId = 0;
    let primaryIslandSize = 0;

    const neighbors: ReadonlyArray<readonly [number, number]> = [
        [-1, -1],
        [0, -1],
        [1, -1],
        [-1, 0],
        [1, 0],
        [-1, 1],
        [0, 1],
        [1, 1],
    ];

    for (let start = 0; start < tileCount; start += 1) {
        if ((blocked[start] ?? 1) === 1 || (islandByTile[start] ?? 0) !== 0) {
            continue;
        }

        islandCount += 1;
        const islandId = islandCount;
        queue.length = 0;
        queue.push(start);
        islandByTile[start] = islandId;
        let head = 0;
        let size = 0;

        while (head < queue.length) {
            const idx = queue[head] ?? -1;
            head += 1;
            if (idx < 0 || idx >= tileCount) {
                continue;
            }
            size += 1;

            const x = idx % width;
            const y = Math.floor(idx / width);
            for (let n = 0; n < neighbors.length; n += 1) {
                const [dx, dy] = neighbors[n] ?? [0, 0];
                const nx = x + dx;
                const ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
                    continue;
                }
                const nIdx = ny * width + nx;
                if ((blocked[nIdx] ?? 1) === 1 || (islandByTile[nIdx] ?? 0) !== 0) {
                    continue;
                }
                islandByTile[nIdx] = islandId;
                queue.push(nIdx);
            }
        }

        if (size > primaryIslandSize) {
            primaryIslandSize = size;
            primaryIslandId = islandId;
        }
    }

    return {
        islandByTile: Array.from(islandByTile),
        islandCount,
        primaryIslandId,
    };
}

export default function processMap(
    json: TiledMapJson,
    options: { mode?: string; quiet?: boolean }
): ExportedMap {
    const mode = toMode(options.mode);
    const quiet = options.quiet === true;
    const log = {
        info: (...args: Array<string | number | boolean | object | null | undefined>) => {
            if (!quiet) {
                console.log(...args);
            }
        },
        error: (...args: Array<string | number | boolean | object | null | undefined>) => console.error(...args),
    };

    const rawLayers = Array.isArray(json.layers) ? json.layers : [];
    const tiledTilesets = Array.isArray(json.tilesets) ? json.tilesets : [];
    const tileSize = Number.isFinite(json.tilewidth) ? json.tilewidth : 16;

    const collidingTiles: Record<number, true> = {};
    const passableTiles: Record<number, true> = {};
    const staticEntityKindsByTileId: Record<number, EntityKindName> = {};
    const tilesetRefs: ResolvedTilesetRef[] = [];
    let mobsFirstgid = 0;
    let mobsObjectAlignment = 'unspecified';

    const map: ExportedMap = {
        width: Number.isFinite(json.width) ? json.width : 0,
        height: Number.isFinite(json.height) ? json.height : 0,
        tilesize: tileSize,
        collisions: [],
        doors: [],
        checkpoints: [],
    };
    const tileCount = map.width * map.height;
    const renderableOccupancy = new Uint8Array(tileCount);
    const collisionCarveIndices = new Set<number>();
    const debugWaterTiles = new Set<number>();
    const debugDamageTiles = new Set<number>();
    const debugInteractableTiles = new Set<number>();

    const tiledLayers = flattenTiledLayers(rawLayers, map.width, map.height, tileSize);

    if (mode === "client") {
        map.data = [];
        map.foreground = [];
        map.animated = {};
        map.blocking = [];
        map.plateau = [];
        map.musicAreas = [];
    }

    if (mode === "server") {
        map.roamingAreas = [];
        map.resourceNodes = [];
        map.chestAreas = [];
        map.staticChests = [];
        map.staticEntities = {};
    }

    log.info("Processing map info...");

    const sortedTilesets = [...tiledTilesets]
        .filter((tileset) => typeof tileset.firstgid === 'number' && Number.isFinite(tileset.firstgid))
        .sort((a, b) => (a.firstgid ?? 0) - (b.firstgid ?? 0));

    for (let index = 0; index < sortedTilesets.length; index += 1) {
        const tileset = sortedTilesets[index];
        if (!tileset || typeof tileset.firstgid !== 'number' || !Number.isFinite(tileset.firstgid)) {
            continue;
        }
        const firstgid = tileset.firstgid;
        const nextFirstgid = sortedTilesets[index + 1]?.firstgid;
        const lastgid =
            typeof nextFirstgid === 'number' && Number.isFinite(nextFirstgid) && nextFirstgid > firstgid
                ? nextFirstgid - 1
                : Number.MAX_SAFE_INTEGER;
        tilesetRefs.push({
            firstgid,
            lastgid,
            name: tileset.name,
            tileWidth:
                typeof tileset.tilewidth === 'number' && Number.isFinite(tileset.tilewidth) ? tileset.tilewidth : tileSize,
            tileHeight:
                typeof tileset.tileheight === 'number' && Number.isFinite(tileset.tileheight) ? tileset.tileheight : tileSize,
            objectAlignment: resolveTileObjectAlignment(tileset.objectalignment),
        });
    }

    for (const tileset of tiledTilesets) {
        if (tileset.name === "tilesheet" || tileset.name === "tilesheet-wang") {
            log.info("Processing terrain properties...");
            const tilesetFirstgid =
                typeof tileset.firstgid === 'number' && Number.isFinite(tileset.firstgid) ? tileset.firstgid : 1;
            for (const tile of Array.isArray(tileset.tiles) ? tileset.tiles : []) {
                const tilePropertyId = tilesetFirstgid + tile.id;
                const collisionObjects = Array.isArray(tile.objectgroup?.objects) ? tile.objectgroup.objects : [];
                if (collisionObjects.length > 0) {
                    collidingTiles[tilePropertyId] = true;
                }
                if (isTruthy(getPropertyValue(tile, 'passable'))) {
                    passableTiles[tilePropertyId] = true;
                }
                if (mode === "client" && Array.isArray(tile.animation) && tile.animation.length > 0) {
                    const firstFrame = tile.animation[0];
                    if (!firstFrame || !Number.isInteger(firstFrame.tileid) || firstFrame.tileid < 0) {
                        throw new Error(`Invalid tile animation start frame at tile id ${tile.id}.`);
                    }
                    if (!Number.isInteger(firstFrame.duration) || firstFrame.duration <= 0) {
                        throw new Error(`Invalid tile animation duration at tile id ${tile.id}.`);
                    }

                    const expectedStartTileId = tilesetFirstgid + tile.id;
                    const firstFrameTileId = tilesetFirstgid + firstFrame.tileid;
                    if (firstFrameTileId !== expectedStartTileId) {
                        throw new Error(
                            `Unsupported tile animation at tile id ${tile.id}: first frame must be the tile itself.`
                        );
                    }

                    const delay = firstFrame.duration;
                    let expectedFrameTileId = firstFrameTileId;
                    for (let frameIndex = 0; frameIndex < tile.animation.length; frameIndex += 1) {
                        const frame = tile.animation[frameIndex];
                        if (!frame || !Number.isInteger(frame.tileid) || frame.tileid < 0) {
                            throw new Error(`Invalid tile animation frame at tile id ${tile.id}.`);
                        }
                        if (!Number.isInteger(frame.duration) || frame.duration <= 0) {
                            throw new Error(`Invalid tile animation duration at tile id ${tile.id}.`);
                        }
                        const frameTileId = frame.tileid + 1;
                        if (frameTileId !== expectedFrameTileId) {
                            throw new Error(
                                `Unsupported tile animation at tile id ${tile.id}: frames must be contiguous.`
                            );
                        }
                        if (frame.duration !== delay) {
                            throw new Error(
                                `Unsupported tile animation at tile id ${tile.id}: mixed per-frame durations are not supported.`
                            );
                        }
                        expectedFrameTileId += 1;
                    }

                    const animated = (map.animated ??= {});
                    animated[tilePropertyId] = {
                        l: tile.animation.length,
                        d: delay,
                    };
                }
            }
            continue;
        }

        if (tileset.name === "Mobs" && mode === "server") {
            log.info("Processing static entity properties...");
            mobsFirstgid = typeof tileset.firstgid === 'number' && Number.isFinite(tileset.firstgid) ? tileset.firstgid : 0;
            mobsObjectAlignment = typeof tileset.objectalignment === 'string' ? tileset.objectalignment : 'unspecified';
            for (const tile of Array.isArray(tileset.tiles) ? tileset.tiles : []) {
                const entityType = getPropertyValue(tile, "type");
                if (typeof entityType === "string" && entityType.length > 0 && isEntityKindName(entityType)) {
                    staticEntityKindsByTileId[tile.id + 1] = entityType;
                }
            }
        }
    }

    if (tiledTilesets.length === 0) {
        log.error("A tileset is missing");
    }

    const doorsLayer = tiledLayers.filter(isObjectLayer).find((layer) => layer.name === "doors");
    if (doorsLayer && Array.isArray(doorsLayer.objects)) {
        log.info("Processing doors...");
        for (const door of doorsLayer.objects) {
            const exportedDoor: ExportedDoor = {
                x: door.x / map.tilesize,
                y: door.y / map.tilesize,
                p: isPortalDoorObject(door) ? 1 : 0,
            };

            for (const property of getProperties(door)) {
                const legacyReplacement = LEGACY_DOOR_PROPERTY_RENAMES[property.name];
                if (legacyReplacement) {
                    throw new Error(
                        `Legacy door property "${property.name}" is not supported; use "${legacyReplacement}".`
                    );
                }
                const normalizedName = normalizeDoorPropertyName(property.name);
                exportedDoor[`t${normalizedName}`] = normalizeScalar(property.value);
            }

            map.doors.push(exportedDoor);
        }
    }

    for (const objectLayer of tiledLayers.filter(isObjectLayer)) {
        if (STRICT_OBJECT_CLASS_LAYERS.has(objectLayer.name)) {
            for (const objectRecord of objectLayer.objects ?? []) {
                assertObjectClassPresent(objectLayer.name, objectRecord);
            }
        }

        if (objectLayer.name === "roaming_areas" && mode === "server") {
            log.info("Processing roaming areas...");
            const roamingAreas = (map.roamingAreas ??= []);
            for (const [i, area] of (objectLayer.objects ?? []).entries()) {
                const count = getPropertyValue(area, "count");
                const mobKind = getPropertyValue(area, "mob_kind");
                const resolvedMobKindId =
                    typeof mobKind === 'string' ? Types.getKindFromString(mobKind) : undefined;
                const resolvedMobKind =
                    typeof mobKind === 'string'
                    && typeof resolvedMobKindId === 'number'
                    && Types.isMob(resolvedMobKindId)
                        ? mobKind
                        : null;
                if (resolvedMobKind === null) {
                    continue;
                }
                roamingAreas[i] = {
                    id: i,
                    x: area.x / map.tilesize,
                    y: area.y / map.tilesize,
                    width: area.width / map.tilesize,
                    height: area.height / map.tilesize,
                    mobKind: resolvedMobKind,
                    count,
                };
            }
            continue;
        }

        if (objectLayer.name === "resource_nodes" && mode === "server") {
            log.info("Processing resource nodes...");
            const resourceNodes = (map.resourceNodes ??= []);
            for (const [i, node] of (objectLayer.objects ?? []).entries()) {
                const nodeId = getPropertyValue(node, 'node_id');
                const resourceKind = getPropertyValue(node, 'resource_kind');
                if (typeof resourceKind !== 'string' || resourceKind.trim().length === 0) {
                    continue;
                }
                const nodeName = (node as { name?: unknown }).name;
                const resourceNode: MapRecord = {
                    id: typeof nodeId === 'string' && nodeId.trim().length > 0
                        ? nodeId.trim()
                        : typeof nodeName === 'string' && nodeName.trim().length > 0
                            ? nodeName.trim()
                            : i,
                    x: node.x / map.tilesize,
                    y: node.y / map.tilesize,
                    kind: resourceKind.trim(),
                };
                const resourceGid = getPropertyValue(node, 'resource_gid');
                if (typeof resourceGid === 'number' && Number.isFinite(resourceGid)) {
                    resourceNode.gid = resourceGid;
                }
                resourceNodes.push(resourceNode);
            }
            continue;
        }

        if (objectLayer.name === "chest_areas" && mode === "server") {
            log.info("Processing chest areas...");
            const chestAreas = (map.chestAreas ??= []);
            for (const area of objectLayer.objects ?? []) {
                const chestArea: MapRecord = {
                    x: area.x / map.tilesize,
                    y: area.y / map.tilesize,
                    w: area.width / map.tilesize,
                    h: area.height / map.tilesize,
                };

                for (const property of getProperties(area)) {
                    if (property.name === "items") {
                        chestArea.i = String(property.value)
                            .split(",")
                            .map((name) => name.trim())
                            .filter(Boolean)
                            .map((name) => Types.getKindFromString(name));
                    } else if (property.name === "spawn_tx") {
                        chestArea.tx = normalizeScalar(property.value);
                    } else if (property.name === "spawn_ty") {
                        chestArea.ty = normalizeScalar(property.value);
                    } else {
                        chestArea[`t${property.name}`] = normalizeScalar(property.value);
                    }
                }

                chestAreas.push(chestArea);
            }
            continue;
        }

        if (objectLayer.name === "chest_spawns" && mode === "server") {
            log.info("Processing static chests...");
            const staticChests = (map.staticChests ??= []);
            for (const chest of objectLayer.objects ?? []) {
                const items = getPropertyValue(chest, "items") ?? "";
                const itemsCsv =
                    typeof items === "string" ? items : typeof items === "number" ? String(items) : "";
                staticChests.push({
                    x: chest.x / map.tilesize,
                    y: chest.y / map.tilesize,
                    i: itemsCsv
                        .split(",")
                        .map((name) => name.trim())
                        .filter(Boolean)
                        .map((name) => Types.getKindFromString(name))
                        .filter(
                            (
                                kind
                            ): kind is Exclude<ReturnType<typeof Types.getKindFromString>, undefined> =>
                                kind !== undefined
                        ),
                });
            }
            continue;
        }

        if (objectLayer.name === "static_entities" && mode === "server") {
            log.info("Processing static entity spawns...");
            const staticEntities = (map.staticEntities ??= {});
            for (const spawn of objectLayer.objects ?? []) {
                const resolvedKind = resolveStaticEntityKind(spawn);
                if (!resolvedKind) {
                    const objectId = Number.isInteger(spawn.id) ? String(spawn.id) : 'no-id';
                    throw new Error(
                        `Static entity object ${objectId} in layer "static_entities" is missing a resolvable entity kind.`
                    );
                }

                const hasTileGid = typeof spawn.gid === 'number' && spawn.gid > 0;
                if (hasTileGid && mobsObjectAlignment !== 'topleft') {
                    throw new Error(
                        'Tile objects in "static_entities" require Mobs tileset objectalignment="topleft" for deterministic placement.'
                    );
                }

                const tileX = Math.floor(spawn.x / map.tilesize);
                const tileY = Math.floor(spawn.y / map.tilesize);
                if (tileX < 0 || tileY < 0 || tileX >= map.width || tileY >= map.height) {
                    const objectId = Number.isInteger(spawn.id) ? String(spawn.id) : 'no-id';
                    throw new Error(`Static entity object ${objectId} in layer "static_entities" is out of map bounds.`);
                }
                const tileIndex = tileY * map.width + tileX;
                if (staticEntities[tileIndex] !== undefined) {
                    throw new Error(
                        `Duplicate static entity at tile (${tileX}, ${tileY}) in layer "static_entities".`
                    );
                }
                staticEntities[tileIndex] = resolvedKind;
            }
            continue;
        }

        if (objectLayer.name === "music_zones" && mode === "client") {
            log.info("Processing music areas...");
            const musicAreas = (map.musicAreas ??= []);
            for (const music of objectLayer.objects ?? []) {
                const musicId = getPropertyValue(music, "track_id");
                musicAreas.push({
                    x: music.x / map.tilesize,
                    y: music.y / map.tilesize,
                    w: music.width / map.tilesize,
                    h: music.height / map.tilesize,
                    id: musicId,
                });
            }
            continue;
        }

        if (objectLayer.name === "checkpoints") {
            log.info("Processing check points...");
            let count = 0;
            for (const checkpoint of objectLayer.objects ?? []) {
                const cp: ExportedCheckpoint = {
                    id: ++count,
                    x: checkpoint.x / map.tilesize,
                    y: checkpoint.y / map.tilesize,
                    w: checkpoint.width / map.tilesize,
                    h: checkpoint.height / map.tilesize,
                };

                if (mode === "server") {
                    cp.s = isTruthy(getPropertyValue(checkpoint, 'spawn')) ? 1 : 0;
                }

                map.checkpoints.push(cp);
            }
        }
    }

    for (let i = tiledLayers.length - 1; i >= 0; i -= 1) {
        const layer = tiledLayers[i];
        if (!layer) {
            continue;
        }
        if (isTileLayer(layer)) {
            processLayer(layer);
            continue;
        }
        if (isObjectLayer(layer)) {
            processDebugInteractableObjectLayer(layer);
            processRenderableObjectLayer(layer);
        }
    }

    if (mode === "client") {
        const data = (map.data ??= []);
        if (data.length < tileCount) {
            data.length = tileCount;
        }
        for (let i = 0; i < tileCount; i += 1) {
            data[i] ??= 0;
        }
        const foreground = (map.foreground ??= []);
        if (foreground.length < tileCount) {
            foreground.length = tileCount;
        }
        for (let i = 0; i < tileCount; i += 1) {
            foreground[i] ??= 0;
        }
    }

    if (tileCount > 0) {
        for (let x = 0; x < map.width; x += 1) {
            sealEmptyPerimeterTile(x, 0);
            sealEmptyPerimeterTile(x, map.height - 1);
        }
        for (let y = 1; y < map.height - 1; y += 1) {
            sealEmptyPerimeterTile(0, y);
            sealEmptyPerimeterTile(map.width - 1, y);
        }
    }

    const normalizedCollisions = uniqueValidIndices(map.collisions, tileCount);
    map.collisions = normalizedCollisions.filter((index) => !collisionCarveIndices.has(index));

    let blockedForNavigation = map.collisions;
    if (mode === "client") {
        const normalizedBlocking = uniqueValidIndices(
            [...(map.blocking ?? []), ...normalizedCollisions],
            tileCount
        );
        const carvedBlocking = normalizedBlocking.filter((index) => !collisionCarveIndices.has(index));
        map.blocking = carvedBlocking;
        blockedForNavigation = carvedBlocking;
    }

    const navigation = deriveNavigationIslands(map.width, map.height, blockedForNavigation);
    map.navIslandByTile = navigation.islandByTile;
    map.navIslandCount = navigation.islandCount;
    map.primaryNavIslandId = navigation.primaryIslandId;

    if (mode === "client") {
        const plateau = (map.plateau ??= []);
        plateau.length = 0;
        for (let i = 0; i < navigation.islandByTile.length; i += 1) {
            const islandId = navigation.islandByTile[i] ?? 0;
            if (islandId > 0 && islandId !== navigation.primaryIslandId) {
                plateau.push(i);
            }
        }
        map.debugPassability = {
            water: [...debugWaterTiles].sort((a, b) => a - b),
            damage: [...debugDamageTiles].sort((a, b) => a - b),
            interactable: [...debugInteractableTiles].sort((a, b) => a - b),
        };
    }

    return map;

    function processLayer(layer: TiledTileLayer): void {
        const tiles = toLayerTileData(layer);
        const debugClass = getDebugPassabilityClass(layer);

        if (mode === "server" && layer.name === "entities") {
            throw new Error('Legacy tilelayer "entities" is not supported; use object layer "static_entities".');
        }

        if (layer.name === "blocking") {
            log.info("Processing blocking tiles...");
            for (let i = 0; i < tiles.length; i += 1) {
                const gid = tiles[i] ?? 0;
                if (gid > 0) {
                    if (mode === "client") {
                        const blocking = (map.blocking ??= []);
                        blocking.push(i);
                    }
                    if (mode === "server") {
                        map.collisions.push(i);
                    }
                }
            }
            return;
        }

        if (!isLayerVisible(layer) || layer.name === "entities") {
            return;
        }

        log.info("Processing layer: " + layer.name);
        const foregroundLayer = mode === "client" ? isForegroundLayer(layer) : false;

        for (let i = 0; i < tiles.length; i += 1) {
            const gid = tiles[i] ?? 0;

            if (mode === "client" && gid > 0) {
                writeRenderableTile(i, gid, foregroundLayer);
                if (debugClass === 'water') {
                    debugWaterTiles.add(i);
                } else if (debugClass === 'damage') {
                    debugDamageTiles.add(i);
                }
            }
            if (gid > 0) {
                renderableOccupancy[i] = 1;
                if (gid in passableTiles) {
                    collisionCarveIndices.add(i);
                }
            }

            if (gid in collidingTiles && !(gid in passableTiles)) {
                map.collisions.push(i);
            }
        }
    }

    function processRenderableObjectLayer(layer: TiledObjectLayer): void {
        if (!isLayerVisible(layer)) {
            return;
        }
        const objects = Array.isArray(layer.objects) ? layer.objects : [];
        const tileObjects = objects.filter((object): object is TiledObject => typeof object.gid === 'number' && object.gid > 0);
        if (tileObjects.length === 0) {
            return;
        }

        log.info('Processing renderable object layer: ' + layer.name);
        const depthSortedLayer = mode === 'client' ? isDepthSortedObjectLayer(layer) : false;
        if (depthSortedLayer) {
            processDepthSortedRenderableObjectLayer(layer, tileObjects);
            return;
        }
        const foregroundLayer = isForegroundObjectLayer(layer);
        for (const object of tileObjects) {
            processRenderableTileObject(layer, object, foregroundLayer);
        }
    }

    function processDebugInteractableObjectLayer(layer: TiledObjectLayer): void {
        if (mode !== 'client' || !DEBUG_INTERACTABLE_OBJECT_LAYERS.has(layer.name)) {
            return;
        }
        for (const object of layer.objects ?? []) {
            const tileIndex = resolveObjectTileIndex(object);
            if (tileIndex !== null) {
                debugInteractableTiles.add(tileIndex);
            }
        }
    }

    function processDepthSortedRenderableObjectLayer(layer: TiledObjectLayer, objects: TiledObject[]): void {
        const resolvedObjects = objects
            .map((object) => resolveRenderableTileObject(layer, object))
            .filter((entry): entry is ResolvedRenderableTileObject => entry !== null);
        if (resolvedObjects.length === 0) {
            return;
        }

        const objectsByPosition = new Map<string, ResolvedRenderableTileObject[]>();
        for (const entry of resolvedObjects) {
            const key = `${entry.tileX},${entry.tileY}`;
            const bucket = objectsByPosition.get(key);
            if (bucket) {
                bucket.push(entry);
            } else {
                objectsByPosition.set(key, [entry]);
            }
            if (entry.gid in passableTiles) {
                collisionCarveIndices.add(entry.tileIndex);
            }
            if (entry.gid in collidingTiles && !(entry.gid in passableTiles)) {
                map.collisions.push(entry.tileIndex);
            }
        }

        const visited = new Set<string>();
        const renderProps = (map.renderProps ??= []);
        for (const startKey of objectsByPosition.keys()) {
            if (visited.has(startKey)) {
                continue;
            }
            const queue = [startKey];
            visited.add(startKey);
            const componentEntries: ResolvedRenderableTileObject[] = [];
            let minTileX = Number.POSITIVE_INFINITY;
            let minTileY = Number.POSITIVE_INFINITY;
            let maxTileX = Number.NEGATIVE_INFINITY;
            let maxTileY = Number.NEGATIVE_INFINITY;

            while (queue.length > 0) {
                const key = queue.shift();
                if (!key) {
                    continue;
                }
                const [rawX, rawY] = key.split(',');
                const tileX = Number.parseInt(rawX ?? '0', 10);
                const tileY = Number.parseInt(rawY ?? '0', 10);
                const entriesAtPosition = objectsByPosition.get(key) ?? [];
                componentEntries.push(...entriesAtPosition);
                minTileX = Math.min(minTileX, tileX);
                minTileY = Math.min(minTileY, tileY);
                maxTileX = Math.max(maxTileX, tileX);
                maxTileY = Math.max(maxTileY, tileY);

                const neighbors = [
                    `${tileX - 1},${tileY}`,
                    `${tileX + 1},${tileY}`,
                    `${tileX},${tileY - 1}`,
                    `${tileX},${tileY + 1}`,
                ];
                for (const neighbor of neighbors) {
                    if (!objectsByPosition.has(neighbor) || visited.has(neighbor)) {
                        continue;
                    }
                    visited.add(neighbor);
                    queue.push(neighbor);
                }
            }

            const collidableComponentEntries = componentEntries.filter((entry) => entry.gid in collidingTiles);
            const depthModeRaw = getMetadataValue(layer, componentEntries, 'depth_mode');
            const depthMode = typeof depthModeRaw === 'string' && depthModeRaw.trim().length > 0 ? depthModeRaw.trim() : 'collision';
            const explicitDepth = parseIntegerLike(getMetadataValue(layer, componentEntries, 'depth_row'));
            const depthOffset = parseIntegerLike(getMetadataValue(layer, componentEntries, 'depth_offset')) ?? 0;
            const depthSourceEntries =
                depthMode === 'top'
                    ? componentEntries
                    : depthMode === 'bottom'
                      ? componentEntries
                      : collidableComponentEntries.length > 0
                        ? collidableComponentEntries
                        : componentEntries;
            let depth =
                explicitDepth
                ?? (
                    depthMode === 'top'
                        ? depthSourceEntries.reduce((minDepth, entry) => Math.min(minDepth, entry.tileY), Number.POSITIVE_INFINITY)
                        : depthSourceEntries.reduce((maxDepth, entry) => Math.max(maxDepth, entry.tileY), 0)
                );
            if (!Number.isFinite(depth)) {
                depth = 0;
            }
            depth += depthOffset;

            const familyValue = getMetadataValue(layer, componentEntries, 'prop_family');
            const kindValue = getMetadataValue(layer, componentEntries, 'prop_kind');
            const biomeValue = getMetadataValue(layer, componentEntries, 'biome');
            const templateValue = componentEntries.find((entry) => typeof entry.template === 'string' && entry.template.length > 0)?.template;
            const meta: ExportedRenderProp['meta'] = {
                layer: layer.name,
                layerPath: getLayerPath(layer),
                depthMode,
                family: typeof familyValue === 'string' && familyValue.trim().length > 0 ? familyValue.trim() : layer.name,
            };
            const groupPath = (layer as TiledObjectLayer & { _bqMeta?: FlattenedLayerMeta })._bqMeta?.groupPath;
            if (Array.isArray(groupPath) && groupPath.length > 0) {
                meta.groupPath = [...groupPath];
            }
            const kind = typeof kindValue === 'string' && kindValue.trim().length > 0 ? kindValue.trim() : null;
            if (kind) {
                meta.kind = kind;
            }
            const biome = typeof biomeValue === 'string' && biomeValue.trim().length > 0 ? biomeValue.trim() : null;
            if (biome) {
                meta.biome = biome;
            }
            const tags = parseTagList(getMetadataValue(layer, componentEntries, 'tags'));
            if (tags && tags.length > 0) {
                meta.tags = tags;
            }
            const template = typeof templateValue === 'string' && templateValue.trim().length > 0 ? templateValue.trim() : null;
            if (template) {
                meta.template = template;
            }
            if (depthOffset !== 0) {
                meta.depthOffset = depthOffset;
            }
            if (explicitDepth !== null) {
                meta.depthRow = explicitDepth;
            }

            renderProps.push({
                depth,
                minTileX,
                minTileY,
                maxTileX,
                maxTileY,
                parts: componentEntries.map((entry) => ({
                    index: entry.tileIndex,
                    gid: entry.gid,
                })),
                meta,
            });
        }
    }

    function processRenderableTileObject(layer: TiledObjectLayer, object: TiledObject, foregroundLayer: boolean): void {
        const resolved = resolveRenderableTileObject(layer, object);
        if (!resolved) {
            return;
        }
        if (mode === 'client') {
            writeRenderableTile(resolved.tileIndex, resolved.gid, foregroundLayer);
        }
        renderableOccupancy[resolved.tileIndex] = 1;
        if (resolved.gid in passableTiles) {
            collisionCarveIndices.add(resolved.tileIndex);
        }
        if (resolved.gid in collidingTiles && !(resolved.gid in passableTiles)) {
            map.collisions.push(resolved.tileIndex);
        }
    }

    function resolveRenderableTileObject(layer: TiledObjectLayer, object: TiledObject): ResolvedRenderableTileObject | null {
        const gid = normalizeGid(object.gid);
        if (gid <= 0) {
            return null;
        }

        const tilesetRef = resolveTilesetRef(gid);
        if (!tilesetRef) {
            const objectId = Number.isInteger(object.id) ? String(object.id) : 'no-id';
            throw new Error(`Renderable tile object ${objectId} in layer "${layer.name}" references an unknown gid ${gid}.`);
        }

        const nativeWidth = tilesetRef.tileWidth;
        const nativeHeight = tilesetRef.tileHeight;
        const width = typeof object.width === 'number' && Number.isFinite(object.width) ? object.width : nativeWidth;
        const height = typeof object.height === 'number' && Number.isFinite(object.height) ? object.height : nativeHeight;
        const rotation = typeof object.rotation === 'number' && Number.isFinite(object.rotation) ? object.rotation : 0;
        if (rotation !== 0) {
            const objectId = Number.isInteger(object.id) ? String(object.id) : 'no-id';
            throw new Error(`Renderable tile object ${objectId} in layer "${layer.name}" uses rotation, which is not supported by the BrowserQuest map exporter.`);
        }
        if (width !== nativeWidth || height !== nativeHeight) {
            const objectId = Number.isInteger(object.id) ? String(object.id) : 'no-id';
            throw new Error(`Renderable tile object ${objectId} in layer "${layer.name}" is resized (${width}x${height}); BrowserQuest currently supports native-size tile objects only.`);
        }

        const alignment = tilesetRef.objectAlignment === 'unspecified' ? 'bottomleft' : tilesetRef.objectAlignment;
        const pixelLeft = object.x - alignmentOffsetX(alignment, width);
        const pixelTop = object.y - alignmentOffsetY(alignment, height);
        if (!Number.isFinite(pixelLeft) || !Number.isFinite(pixelTop)) {
            return null;
        }

        const tileX = Math.round(pixelLeft / map.tilesize);
        const tileY = Math.round(pixelTop / map.tilesize);
        if (tileX < 0 || tileY < 0 || tileX >= map.width || tileY >= map.height) {
            const objectId = Number.isInteger(object.id) ? String(object.id) : 'no-id';
            throw new Error(`Renderable tile object ${objectId} in layer "${layer.name}" resolves out of bounds at tile (${tileX}, ${tileY}).`);
        }

        return {
            gid,
            tileX,
            tileY,
            tileIndex: tileY * map.width + tileX,
            objectId: Number.isInteger(object.id) ? (object.id ?? null) : null,
            objectClassName: getObjectClassName(object),
            template: typeof object.template === 'string' ? object.template : undefined,
            properties: getProperties(object),
        };
    }

    function getDebugPassabilityClass(layer: TiledTileLayer): 'water' | 'damage' | null {
        const layerName = layer.name.trim().toLowerCase();
        if (DEBUG_DAMAGE_LAYER_NAMES.has(layerName)) {
            return 'damage';
        }
        if (DEBUG_WATER_LAYER_NAMES.has(layerName)) {
            return 'water';
        }
        const layerPath = getLayerPath(layer).toLowerCase();
        if (layerPath.includes('/water/') || layerPath.endsWith('/water')) {
            return 'water';
        }
        return null;
    }

    function resolveObjectTileIndex(object: TiledObject): number | null {
        const tileX = Math.floor(object.x / map.tilesize);
        const tileY = Math.floor(object.y / map.tilesize);
        if (tileX < 0 || tileY < 0 || tileX >= map.width || tileY >= map.height) {
            return null;
        }
        return tileY * map.width + tileX;
    }

    function resolveTilesetRef(gid: number): ResolvedTilesetRef | undefined {
        for (let i = 0; i < tilesetRefs.length; i += 1) {
            const tilesetRef = tilesetRefs[i];
            if (tilesetRef && gid >= tilesetRef.firstgid && gid <= tilesetRef.lastgid) {
                return tilesetRef;
            }
        }
        return undefined;
    }

    function writeRenderableTile(tileIndex: number, gid: number, foregroundLayer: boolean): void {
        const destination = foregroundLayer ? (map.foreground ??= []) : (map.data ??= []);
        const existing = destination[tileIndex];
        if (existing === undefined) {
            destination[tileIndex] = gid;
        } else if (Array.isArray(existing)) {
            existing.unshift(gid);
        } else {
            destination[tileIndex] = [gid, existing];
        }
    }

    function sealEmptyPerimeterTile(x: number, y: number): void {
        if (x < 0 || y < 0 || x >= map.width || y >= map.height) {
            return;
        }
        const index = y * map.width + x;
        if (renderableOccupancy[index]) {
            return;
        }
        map.collisions.push(index);
    }

    function resolveStaticEntityKind(spawn: TiledObject): EntityKindName | null {
        const kindByName = getPropertyValue(spawn, 'entity_kind');
        if (typeof kindByName === 'string') {
            const normalizedKind = kindByName.trim();
            if (normalizedKind.length > 0 && isEntityKindName(normalizedKind)) {
                return normalizedKind;
            }
        }

        const entityGidRaw = parseIntegerLike(getPropertyValue(spawn, 'entity_gid'));
        if (entityGidRaw !== null && entityGidRaw > 0) {
            const entityGid = normalizeGid(entityGidRaw);

            // entity_gid may be authored as either:
            // - local tile id (1-based), or
            // - global gid (with tileset firstgid applied)
            const directKind = staticEntityKindsByTileId[entityGid];
            if (typeof directKind === 'string' && directKind.length > 0) {
                return directKind;
            }

            if (mobsFirstgid > 0 && entityGid >= mobsFirstgid) {
                const localTileId = entityGid - mobsFirstgid + 1;
                if (localTileId > 0) {
                    const kind = staticEntityKindsByTileId[localTileId];
                    if (typeof kind === 'string' && kind.length > 0) {
                        return kind;
                    }
                }
            }
        }

        if (typeof spawn.gid === 'number' && spawn.gid > 0 && mobsFirstgid > 0) {
            const localTileId = normalizeGid(spawn.gid) - mobsFirstgid + 1;
            if (localTileId > 0) {
                const kind = staticEntityKindsByTileId[localTileId];
                if (typeof kind === 'string' && kind.length > 0) {
                    return kind;
                }
            }
        }

        return null;
    }
}
