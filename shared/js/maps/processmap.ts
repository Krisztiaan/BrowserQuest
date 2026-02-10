import Types from "../gametypes";

type ExportMode = "client" | "server";

type TiledProperty = {
    name: string;
    value: unknown;
};

type TiledTile = {
    id: number;
    properties?: TiledProperty[];
};

type TiledTileset = {
    name: string;
    firstgid?: number;
    tiles?: TiledTile[];
};

type TiledObject = {
    x: number;
    y: number;
    width: number;
    height: number;
    type?: string;
    properties?: TiledProperty[];
};

type TiledLayerBase = {
    name: string;
    type: string;
    visible?: boolean | number;
};

type TiledTileLayer = TiledLayerBase & {
    type: "tilelayer";
    data?: number[];
};

type TiledObjectLayer = TiledLayerBase & {
    type: "objectgroup";
    objects?: TiledObject[];
};

type TiledLayer = TiledTileLayer | TiledObjectLayer | (TiledLayerBase & Record<string, unknown>);

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
    [key: string]: unknown;
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
    high?: number[];
    animated?: Record<number, { l?: number; d?: number }>;
    blocking?: number[];
    plateau?: number[];
    musicAreas?: Array<{ x: number; y: number; w: number; h: number; id: unknown }>;
    roamingAreas?: Array<Record<string, unknown>>;
    chestAreas?: Array<Record<string, unknown>>;
    staticChests?: Array<{ x: number; y: number; i: number[] }>;
    staticEntities?: Record<number, string>;
};

const GLOBAL_TILE_ID_MASK = 0x1fffffff;

function normalizeGid(value: unknown): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return 0;
    }
    return value & GLOBAL_TILE_ID_MASK;
}

function normalizeScalar(value: unknown): unknown {
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

function getProperties(value: { properties?: TiledProperty[] }): TiledProperty[] {
    return Array.isArray(value.properties) ? value.properties : [];
}

function getPropertyValue(value: { properties?: TiledProperty[] }, name: string): unknown {
    const property = getProperties(value).find((entry) => entry.name === name);
    return property ? normalizeScalar(property.value) : undefined;
}

function getFirstPropertyValue(value: { properties?: TiledProperty[] }): unknown {
    const property = getProperties(value)[0];
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

function toLayerTileData(layer: TiledTileLayer): number[] {
    if (!Array.isArray(layer.data)) {
        return [];
    }
    return layer.data.map(normalizeGid);
}

function toMode(value: unknown): ExportMode {
    return value === "client" ? "client" : "server";
}

export default function processMap(
    json: TiledMapJson,
    options: { mode?: string; quiet?: boolean }
): ExportedMap {
    const mode = toMode(options.mode);
    const quiet = options.quiet === true;
    const log = {
        info: (...args: unknown[]) => {
            if (!quiet) {
                console.log(...args);
            }
        },
        error: (...args: unknown[]) => console.error(...args),
    };

    const tiledLayers = Array.isArray(json.layers) ? json.layers : [];
    const tiledTilesets = Array.isArray(json.tilesets) ? json.tilesets : [];
    const tileSize = Number.isFinite(json.tilewidth) ? json.tilewidth : 16;

    const collidingTiles: Record<number, true> = {};
    const staticEntityKindsByTileId: Record<number, string> = {};
    let mobsFirstgid = 0;

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
        map.high = [];
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
        if (tileset.name === "tilesheet") {
            log.info("Processing terrain properties...");
            for (const tile of Array.isArray(tileset.tiles) ? tileset.tiles : []) {
                const tilePropertyId = tile.id + 1;
                for (const property of getProperties(tile)) {
                    const name = property.name;
                    const value = normalizeScalar(property.value);

                    if (name === "c") {
                        collidingTiles[tilePropertyId] = true;
                    }

                    if (mode === "client") {
                        if (name === "v") {
                            map.high?.push(tilePropertyId);
                        }
                        if (name === "length") {
                            map.animated![tilePropertyId] = map.animated![tilePropertyId] || {};
                            map.animated![tilePropertyId].l = typeof value === "number" ? value : undefined;
                        }
                        if (name === "delay") {
                            map.animated![tilePropertyId] = map.animated![tilePropertyId] || {};
                            map.animated![tilePropertyId].d = typeof value === "number" ? value : undefined;
                        }
                    }
                }
            }
            continue;
        }

        if (tileset.name === "Mobs" && mode === "server") {
            log.info("Processing static entity properties...");
            mobsFirstgid = Number.isFinite(tileset.firstgid) ? (tileset.firstgid as number) : 0;
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
                p: door.type === "portal" ? 1 : 0,
            };

            for (const property of getProperties(door)) {
                exportedDoor[`t${property.name}`] = normalizeScalar(property.value);
            }

            map.doors.push(exportedDoor);
        }
    }

    for (const objectLayer of tiledLayers.filter(isObjectLayer)) {
        if (objectLayer.name === "roaming" && mode === "server") {
            log.info("Processing roaming areas...");
            const roamingAreas = map.roamingAreas!;
            for (let i = 0; i < (objectLayer.objects || []).length; i += 1) {
                const area = objectLayer.objects![i];
                const nb = getPropertyValue(area, "nb") ?? getFirstPropertyValue(area);
                roamingAreas[i] = {
                    id: i,
                    x: area.x / map.tilesize,
                    y: area.y / map.tilesize,
                    width: area.width / map.tilesize,
                    height: area.height / map.tilesize,
                    type: area.type,
                    nb,
                };
            }
            continue;
        }

        if (objectLayer.name === "chestareas" && mode === "server") {
            log.info("Processing chest areas...");
            const chestAreas = map.chestAreas!;
            for (const area of objectLayer.objects || []) {
                const chestArea: Record<string, unknown> = {
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
                    } else {
                        chestArea[`t${property.name}`] = normalizeScalar(property.value);
                    }
                }

                chestAreas.push(chestArea);
            }
            continue;
        }

        if (objectLayer.name === "chests" && mode === "server") {
            log.info("Processing static chests...");
            const staticChests = map.staticChests!;
            for (const chest of objectLayer.objects || []) {
                const items = getPropertyValue(chest, "items") ?? getFirstPropertyValue(chest) ?? "";
                staticChests.push({
                    x: chest.x / map.tilesize,
                    y: chest.y / map.tilesize,
                    i: String(items)
                        .split(",")
                        .map((name) => name.trim())
                        .filter(Boolean)
                        .map((name) => Types.getKindFromString(name)),
                });
            }
            continue;
        }

        if (objectLayer.name === "music" && mode === "client") {
            log.info("Processing music areas...");
            const musicAreas = map.musicAreas!;
            for (const music of objectLayer.objects || []) {
                const musicId = getPropertyValue(music, "id") ?? getFirstPropertyValue(music);
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
            for (const checkpoint of objectLayer.objects || []) {
                const cp: ExportedCheckpoint = {
                    id: ++count,
                    x: checkpoint.x / map.tilesize,
                    y: checkpoint.y / map.tilesize,
                    w: checkpoint.width / map.tilesize,
                    h: checkpoint.height / map.tilesize,
                };

                if (mode === "server") {
                    cp.s = checkpoint.type ? 1 : 0;
                }

                map.checkpoints.push(cp);
            }
        }
    }

    const tileLayers = tiledLayers.filter(isTileLayer);
    for (let i = tileLayers.length - 1; i >= 0; i -= 1) {
        processLayer(tileLayers[i]);
    }

    if (mode === "client") {
        const data = map.data!;
        for (let i = 0; i < data.length; i += 1) {
            if (!data[i]) {
                data[i] = 0;
            }
        }
    }

    return map;

    function processLayer(layer: TiledTileLayer): void {
        const tiles = toLayerTileData(layer);

        if (mode === "server" && layer.name === "entities") {
            log.info("Processing positions of static entities ...");
            for (let i = 0; i < tiles.length; i += 1) {
                const gid = tiles[i] - mobsFirstgid + 1;
                if (gid > 0) {
                    map.staticEntities![i] = staticEntityKindsByTileId[gid];
                }
            }
            return;
        }

        if (mode === "client" && layer.name === "blocking") {
            log.info("Processing blocking tiles...");
            for (let i = 0; i < tiles.length; i += 1) {
                if (tiles[i] > 0) {
                    map.blocking!.push(i);
                }
            }
            return;
        }

        if (mode === "client" && layer.name === "plateau") {
            log.info("Processing plateau tiles...");
            for (let i = 0; i < tiles.length; i += 1) {
                if (tiles[i] > 0) {
                    map.plateau!.push(i);
                }
            }
            return;
        }

        if (!isLayerVisible(layer) || layer.name === "entities") {
            return;
        }

        log.info("Processing layer: " + layer.name);

        for (let i = 0; i < tiles.length; i += 1) {
            const gid = tiles[i];

            if (mode === "client" && gid > 0) {
                const data = map.data!;
                if (data[i] === undefined) {
                    data[i] = gid;
                } else if (Array.isArray(data[i])) {
                    (data[i] as number[]).unshift(gid);
                } else {
                    data[i] = [gid, data[i] as number];
                }
            }

            if (gid in collidingTiles) {
                map.collisions.push(i);
            }
        }
    }
}
