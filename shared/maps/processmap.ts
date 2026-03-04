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
    tiles?: TiledTile[];
};

type TiledObject = {
    id?: number;
    gid?: number;
    x: number;
    y: number;
    width: number;
    height: number;
    type?: string;
    class?: string;
    properties?: TiledProperty[];
};

type TiledLayerBase = {
    name: string;
    type: string;
    visible?: boolean | number;
    class?: string;
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

type TiledLayer = TiledTileLayer | TiledObjectLayer | (TiledLayerBase & Record<string, ScalarValue | number[] | object | undefined>);

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

type ExportedMap = {
    width: number;
    height: number;
    tilesize: number;
    collisions: number[];
    doors: ExportedDoor[];
    checkpoints: ExportedCheckpoint[];
    data?: Array<number | number[]>;
    foreground?: Array<number | number[]>;
    animated?: Record<number, { l?: number; d?: number }>;
    blocking?: number[];
    plateau?: number[];
    navIslandByTile?: number[];
    navIslandCount?: number;
    primaryNavIslandId?: number;
    musicAreas?: Array<{ x: number; y: number; w: number; h: number; id: ScalarValue | undefined }>;
    roamingAreas?: Array<MapRecord>;
    chestAreas?: Array<MapRecord>;
    staticChests?: Array<{ x: number; y: number; i: number[] }>;
    staticEntities?: Record<number, string>;
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
    'entity_spawns',
    'chest_spawns',
    'chest_areas',
    'roaming_areas',
    'zones',
    'music_zones',
    'checkpoints',
    'mobile_zones',
]);

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

function isTileLayer(layer: TiledLayer): layer is TiledTileLayer {
    return layer.type === "tilelayer";
}

function isObjectLayer(layer: TiledLayer): layer is TiledObjectLayer {
    return layer.type === "objectgroup";
}

function isLayerVisible(layer: TiledLayerBase): boolean {
    return layer.visible !== false && layer.visible !== 0;
}

function isForegroundLayer(layer: TiledTileLayer): boolean {
    return typeof layer.class === 'string' && layer.class.trim() === 'Foreground';
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

function assertNoLegacyObjectType(layerName: string, object: TiledObject): void {
    if (typeof object.type !== 'string' || object.type.trim().length === 0) {
        return;
    }
    throw new Error(
        `Legacy object type "${object.type}" is not supported in layer "${layerName}"; use object class instead.`
    );
}

function assertObjectClassPresent(layerName: string, object: TiledObject): void {
    if (typeof object.class === 'string' && object.class.trim().length > 0) {
        return;
    }
    const objectId = Number.isInteger(object.id) ? String(object.id) : 'no-id';
    throw new Error(`Object ${objectId} in layer "${layerName}" is missing required class.`);
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

    const tiledLayers = Array.isArray(json.layers) ? json.layers : [];
    const tiledTilesets = Array.isArray(json.tilesets) ? json.tilesets : [];
    const tileSize = Number.isFinite(json.tilewidth) ? json.tilewidth : 16;

    const collidingTiles: Record<number, true> = {};
    const staticEntityKindsByTileId: Record<number, string> = {};
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
        map.chestAreas = [];
        map.staticChests = [];
        map.staticEntities = {};
    }

    log.info("Processing map info...");

    for (const tileset of tiledTilesets) {
        if (tileset.name === "tilesheet" || tileset.name === "tilesheet-wang") {
            log.info("Processing terrain properties...");
            for (const tile of Array.isArray(tileset.tiles) ? tileset.tiles : []) {
                const tilePropertyId = tile.id + 1;
                const collisionObjects = Array.isArray(tile.objectgroup?.objects) ? tile.objectgroup.objects : [];
                if (collisionObjects.length > 0) {
                    collidingTiles[tilePropertyId] = true;
                }
                if (mode === "client" && Array.isArray(tile.animation) && tile.animation.length > 0) {
                    const firstFrame = tile.animation[0];
                    if (!firstFrame || !Number.isInteger(firstFrame.tileid) || firstFrame.tileid < 0) {
                        throw new Error(`Invalid tile animation start frame at tile id ${tile.id}.`);
                    }
                    if (!Number.isInteger(firstFrame.duration) || firstFrame.duration <= 0) {
                        throw new Error(`Invalid tile animation duration at tile id ${tile.id}.`);
                    }

                    const expectedStartTileId = tile.id + 1;
                    const firstFrameTileId = firstFrame.tileid + 1;
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
                if (typeof entityType === "string" && entityType.length > 0) {
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
                p: door.class === "Portal" ? 1 : 0,
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
                assertNoLegacyObjectType(objectLayer.name, objectRecord);
                assertObjectClassPresent(objectLayer.name, objectRecord);
            }
        }

        if (objectLayer.name === "roaming_areas" && mode === "server") {
            log.info("Processing roaming areas...");
            const roamingAreas = (map.roamingAreas ??= []);
            for (const [i, area] of (objectLayer.objects ?? []).entries()) {
                const count = getPropertyValue(area, "count");
                const mobKind = getPropertyValue(area, "mob_kind");
                roamingAreas[i] = {
                    id: i,
                    x: area.x / map.tilesize,
                    y: area.y / map.tilesize,
                    width: area.width / map.tilesize,
                    height: area.height / map.tilesize,
                    mobKind,
                    count,
                };
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

        if (objectLayer.name === "entity_spawns" && mode === "server") {
            log.info("Processing static entity spawns...");
            const staticEntities = (map.staticEntities ??= {});
            for (const spawn of objectLayer.objects ?? []) {
                const resolvedKind = resolveEntitySpawnKind(spawn);
                if (!resolvedKind) {
                    const objectId = Number.isInteger(spawn.id) ? String(spawn.id) : 'no-id';
                    throw new Error(
                        `Entity spawn object ${objectId} in layer "entity_spawns" is missing a resolvable mob kind.`
                    );
                }

                const hasTileGid = typeof spawn.gid === 'number' && spawn.gid > 0;
                if (hasTileGid && mobsObjectAlignment !== 'topleft') {
                    throw new Error(
                        'Tile objects in "entity_spawns" require Mobs tileset objectalignment="topleft" for deterministic placement.'
                    );
                }

                const tileX = Math.floor(spawn.x / map.tilesize);
                const tileY = Math.floor(spawn.y / map.tilesize);
                if (tileX < 0 || tileY < 0 || tileX >= map.width || tileY >= map.height) {
                    const objectId = Number.isInteger(spawn.id) ? String(spawn.id) : 'no-id';
                    throw new Error(`Entity spawn object ${objectId} in layer "entity_spawns" is out of map bounds.`);
                }
                const tileIndex = tileY * map.width + tileX;
                if (staticEntities[tileIndex] !== undefined) {
                    throw new Error(
                        `Duplicate entity spawn at tile (${tileX}, ${tileY}) in layer "entity_spawns".`
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

    const tileLayers = tiledLayers.filter(isTileLayer);
    for (let i = tileLayers.length - 1; i >= 0; i -= 1) {
        const layer = tileLayers[i];
        if (layer) {
            processLayer(layer);
        }
    }

    if (mode === "client") {
        const tileCount = map.width * map.height;
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

    const tileCount = map.width * map.height;
    const normalizedCollisions = uniqueValidIndices(map.collisions, tileCount);
    map.collisions = normalizedCollisions;

    let blockedForNavigation = normalizedCollisions;
    if (mode === "client") {
        const normalizedBlocking = uniqueValidIndices(
            [...(map.blocking ?? []), ...normalizedCollisions],
            tileCount
        );
        map.blocking = normalizedBlocking;
        blockedForNavigation = normalizedBlocking;
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
    }

    return map;

    function processLayer(layer: TiledTileLayer): void {
        const tiles = toLayerTileData(layer);

        if (mode === "server" && layer.name === "entities") {
            throw new Error('Legacy tilelayer "entities" is not supported; use object layer "entity_spawns".');
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
                const destination = foregroundLayer ? (map.foreground ??= []) : (map.data ??= []);
                const existing = destination[i];
                if (existing === undefined) {
                    destination[i] = gid;
                } else if (Array.isArray(existing)) {
                    existing.unshift(gid);
                } else {
                    destination[i] = [gid, existing];
                }
            }

            if (gid in collidingTiles) {
                map.collisions.push(i);
            }
        }
    }

    function resolveEntitySpawnKind(spawn: TiledObject): string | null {
        const kindByName = getPropertyValue(spawn, 'mob_kind');
        if (typeof kindByName === 'string' && kindByName.trim().length > 0) {
            return kindByName.trim();
        }

        const mobGidRaw = parseIntegerLike(getPropertyValue(spawn, 'mob_gid'));
        if (mobGidRaw !== null && mobGidRaw > 0) {
            const mobGid = normalizeGid(mobGidRaw);

            // mob_gid may be authored as either:
            // - local tile id (1-based), or
            // - global gid (with tileset firstgid applied)
            const directKind = staticEntityKindsByTileId[mobGid];
            if (typeof directKind === 'string' && directKind.length > 0) {
                return directKind;
            }

            if (mobsFirstgid > 0 && mobGid >= mobsFirstgid) {
                const localTileId = mobGid - mobsFirstgid + 1;
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
