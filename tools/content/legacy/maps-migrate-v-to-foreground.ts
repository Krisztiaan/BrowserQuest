import fs from 'node:fs/promises';
import path from 'node:path';
import { parseCliArgs } from '../../shared/cli-args';

type UnknownRecord = Record<string, unknown>;

type TilesetCacheEntry = Readonly<{
    path: string;
    root: UnknownRecord;
    highLocalTileIds: ReadonlySet<number>;
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

function asString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
}

function asInteger(value: unknown): number | null {
    return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function parseCsv(raw: string): string[] {
    return raw
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
}

function toRelativePath(filePath: string): string {
    return path.relative(process.cwd(), filePath).split(path.sep).join('/');
}

function isTruthy(value: unknown): boolean {
    if (value === true || value === 1) {
        return true;
    }
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        return normalized === 'true' || normalized === '1' || normalized === 'yes';
    }
    return false;
}

function getPropertyMap(value: unknown): Map<string, unknown> {
    const map = new Map<string, unknown>();
    for (const raw of asArray(value)) {
        const record = asRecord(raw);
        if (!record) {
            continue;
        }
        const name = asString(record.name);
        if (!name) {
            continue;
        }
        map.set(name, record.value);
    }
    return map;
}

function ensureProperty(
    value: unknown,
    key: string,
    propertyType: 'bool' | 'string',
    propertyValue: string | boolean
): UnknownRecord[] {
    const out = asArray(value)
        .map((entry) => asRecord(entry))
        .filter((entry): entry is UnknownRecord => entry !== null);
    let found = false;
    for (const record of out) {
        const name = asString(record.name);
        if (name !== key) {
            continue;
        }
        record.name = key;
        record.type = propertyType;
        record.value = propertyValue;
        found = true;
        break;
    }
    if (!found) {
        out.push({
            name: key,
            type: propertyType,
            value: propertyValue,
        });
    }
    return out;
}

function collectHighLocalTileIds(tilesetRoot: UnknownRecord): Set<number> {
    const ids = new Set<number>();
    const tiles = asArray(tilesetRoot.tiles);
    for (const tileEntry of tiles) {
        const tileRecord = asRecord(tileEntry);
        if (!tileRecord) {
            continue;
        }
        const tileId = asInteger(tileRecord.id);
        if (tileId === null || tileId < 0) {
            continue;
        }
        const hasV = asArray(tileRecord.properties).some((propertyEntry) => {
            const propertyRecord = asRecord(propertyEntry);
            return asString(propertyRecord?.name) === 'v';
        });
        if (hasV) {
            ids.add(tileId);
        }
    }
    return ids;
}

function stripVPropertiesOnTilesetRecord(tilesetRoot: UnknownRecord): { removedProperties: number; touchedTiles: number } {
    let removedProperties = 0;
    let touchedTiles = 0;
    const tiles = asArray(tilesetRoot.tiles)
        .map((entry) => asRecord(entry))
        .filter((entry): entry is UnknownRecord => entry !== null);
    if (tiles.length > 0) {
        tilesetRoot.tiles = tiles;
    }
    for (const tileRecord of tiles) {
        const properties = asArray(tileRecord.properties)
            .map((entry) => asRecord(entry))
            .filter((entry): entry is UnknownRecord => entry !== null);
        if (properties.length === 0) {
            continue;
        }
        const filtered = properties.filter((record) => asString(record.name) !== 'v');
        const delta = properties.length - filtered.length;
        if (delta > 0) {
            touchedTiles += 1;
            removedProperties += delta;
        }
        if (filtered.length > 0) {
            tileRecord.properties = filtered;
        } else {
            delete tileRecord.properties;
        }
    }
    return { removedProperties, touchedTiles };
}

async function loadTilesetCacheEntry(
    absoluteSourcePath: string,
    cache: Map<string, TilesetCacheEntry>
): Promise<TilesetCacheEntry> {
    const normalized = path.normalize(absoluteSourcePath);
    const existing = cache.get(normalized);
    if (existing) {
        return existing;
    }
    const payload = await fs.readFile(normalized, 'utf8');
    const root = asRecord(JSON.parse(payload));
    if (!root) {
        fail(`Tileset source must be an object JSON file: ${toRelativePath(normalized)}`);
    }
    const highLocalTileIds = collectHighLocalTileIds(root);
    const next: TilesetCacheEntry = {
        path: normalized,
        root,
        highLocalTileIds,
    };
    cache.set(normalized, next);
    return next;
}

function printUsage(): never {
    console.log(
        'Usage: bun tools/content/legacy/maps-migrate-v-to-foreground.ts [--dir <path>] [--files <csv>] [--foreground-property <name>] [--foreground-suffix <suffix>] [--source-layer-property <name>] [--strip-v] [--write]'
    );
    process.exit(0);
}

async function resolveMapPaths(dirPath: string, filesCsv: string): Promise<string[]> {
    const explicit = parseCsv(filesCsv);
    if (explicit.length > 0) {
        return explicit
            .map((entry) => path.resolve(process.cwd(), entry))
            .sort((a, b) => a.localeCompare(b));
    }

    const dirEntries = await fs.readdir(dirPath, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of dirEntries) {
        if (!entry.isFile()) {
            continue;
        }
        if (!entry.name.endsWith('.json')) {
            continue;
        }
        if (entry.name === 'map-pack.config.json') {
            continue;
        }
        if (entry.name === 'world.original.json') {
            continue;
        }
        if (entry.name.startsWith('world.backup.')) {
            continue;
        }
        files.push(path.resolve(dirPath, entry.name));
    }
    files.sort((a, b) => a.localeCompare(b));
    return files;
}

async function main(): Promise<void> {
    const parsedArgs = parseCliArgs(
        process.argv.slice(2),
        [
            { key: 'dir', kind: 'string', defaultValue: 'assets/maps/tiled' },
            { key: 'files', kind: 'string', defaultValue: '' },
            { key: 'foreground-property', kind: 'string', defaultValue: 'bq_foreground' },
            { key: 'foreground-suffix', kind: 'string', defaultValue: '_foreground' },
            { key: 'source-layer-property', kind: 'string', defaultValue: 'bq_source_layer' },
            { key: 'strip-v', kind: 'boolean', defaultValue: false },
            { key: 'write', kind: 'boolean', defaultValue: false },
        ],
        { onHelp: printUsage }
    );

    const dirPath = path.resolve(process.cwd(), String(parsedArgs.dir ?? 'assets/maps/tiled'));
    const filesCsv = String(parsedArgs.files ?? '');
    const foregroundProperty = String(parsedArgs['foreground-property'] ?? 'bq_foreground');
    const foregroundSuffix = String(parsedArgs['foreground-suffix'] ?? '_foreground');
    const sourceLayerProperty = String(parsedArgs['source-layer-property'] ?? 'bq_source_layer');
    const stripV = Boolean(parsedArgs['strip-v']);
    const write = Boolean(parsedArgs.write);

    const mapPaths = await resolveMapPaths(dirPath, filesCsv);
    if (mapPaths.length === 0) {
        fail('No map files selected.');
    }

    const tilesetCache = new Map<string, TilesetCacheEntry>();
    const externalTilesetPathsUsed = new Set<string>();
    const mapSummaries: UnknownRecord[] = [];
    let totalMovedCells = 0;
    let totalCreatedForegroundLayers = 0;
    let totalMergedForegroundLayers = 0;
    let totalInlineVPropertiesRemoved = 0;

    for (const mapPath of mapPaths) {
        const payload = await fs.readFile(mapPath, 'utf8');
        const root = asRecord(JSON.parse(payload));
        if (!root) {
            fail(`Map root must be object: ${toRelativePath(mapPath)}`);
        }

        const tilesets = asArray(root.tilesets)
            .map((entry) => asRecord(entry))
            .filter((entry): entry is UnknownRecord => entry !== null);
        root.tilesets = tilesets;
        const highGids = new Set<number>();

        for (const tileset of tilesets) {
            const firstgid = asInteger(tileset.firstgid);
            if (firstgid === null) {
                fail(`Tileset missing integer firstgid in ${toRelativePath(mapPath)}.`);
            }
            const source = asString(tileset.source);
            if (source && source.trim().length > 0) {
                const absoluteSourcePath = path.resolve(path.dirname(mapPath), source);
                const cached = await loadTilesetCacheEntry(absoluteSourcePath, tilesetCache);
                externalTilesetPathsUsed.add(cached.path);
                for (const localId of cached.highLocalTileIds) {
                    highGids.add(firstgid + localId);
                }
                continue;
            }

            const highLocalTileIds = collectHighLocalTileIds(tileset);
            for (const localId of highLocalTileIds) {
                highGids.add(firstgid + localId);
            }
            if (stripV) {
                const stripped = stripVPropertiesOnTilesetRecord(tileset);
                totalInlineVPropertiesRemoved += stripped.removedProperties;
            }
        }

        const layers = asArray(root.layers)
            .map((entry) => asRecord(entry))
            .filter((entry): entry is UnknownRecord => entry !== null);
        root.layers = layers;

        const firstObjectLayerIndex = layers.findIndex((layer) => asString(layer.type) === 'objectgroup');
        const appendForegroundAt = firstObjectLayerIndex >= 0 ? firstObjectLayerIndex : layers.length;

        const existingForegroundBySource = new Map<string, UnknownRecord>();
        for (const layer of layers) {
            if (asString(layer.type) !== 'tilelayer') {
                continue;
            }
            const propertyMap = getPropertyMap(layer.properties);
            if (!isTruthy(propertyMap.get(foregroundProperty))) {
                continue;
            }
            const sourceNameFromProperty = asString(propertyMap.get(sourceLayerProperty));
            const layerName = asString(layer.name) ?? '';
            let sourceName = sourceNameFromProperty;
            if (!sourceName && layerName.endsWith(foregroundSuffix)) {
                sourceName = layerName.slice(0, layerName.length - foregroundSuffix.length);
            }
            if (!sourceName || existingForegroundBySource.has(sourceName)) {
                continue;
            }
            existingForegroundBySource.set(sourceName, layer);
        }

        const maxLayerId = layers.reduce((maxValue, layer) => {
            const layerId = asInteger(layer.id);
            return layerId !== null ? Math.max(maxValue, layerId) : maxValue;
        }, 0);
        let nextLayerId = Math.max(asInteger(root.nextlayerid) ?? 0, maxLayerId + 1);
        const newForegroundLayers: UnknownRecord[] = [];

        let movedCells = 0;
        let createdForegroundLayers = 0;
        let mergedForegroundLayers = 0;

        for (const layer of layers) {
            if (asString(layer.type) !== 'tilelayer') {
                continue;
            }
            const propertyMap = getPropertyMap(layer.properties);
            if (isTruthy(propertyMap.get(foregroundProperty))) {
                continue;
            }
            const layerName = asString(layer.name) ?? '';
            const data = asArray(layer.data);
            if (data.length === 0) {
                continue;
            }

            let movedFromLayer = 0;
            const foregroundData = new Array<number>(data.length).fill(0);
            for (let index = 0; index < data.length; index += 1) {
                const rawGid = data[index];
                if (typeof rawGid !== 'number' || !Number.isInteger(rawGid)) {
                    continue;
                }
                const normalizedGid = rawGid & 0x1fffffff;
                if (normalizedGid <= 0 || !highGids.has(normalizedGid)) {
                    continue;
                }
                foregroundData[index] = rawGid;
                data[index] = 0;
                movedFromLayer += 1;
            }
            if (movedFromLayer === 0) {
                continue;
            }

            movedCells += movedFromLayer;
            layer.data = data;
            const existingForegroundLayer = existingForegroundBySource.get(layerName);
            if (existingForegroundLayer) {
                const existingData = asArray(existingForegroundLayer.data);
                if (existingData.length !== foregroundData.length) {
                    fail(
                        `Foreground layer length mismatch in ${toRelativePath(mapPath)} for "${layerName}" (${existingData.length} vs ${foregroundData.length}).`
                    );
                }
                for (let index = 0; index < foregroundData.length; index += 1) {
                    const movedValue = foregroundData[index] ?? 0;
                    if (movedValue <= 0) {
                        continue;
                    }
                    const current = existingData[index];
                    if (typeof current === 'number' && Number.isInteger(current) && current > 0) {
                        continue;
                    }
                    existingData[index] = movedValue;
                }
                existingForegroundLayer.data = existingData;
                mergedForegroundLayers += 1;
                continue;
            }

            const foregroundLayerName = `${layerName}${foregroundSuffix}`;
            const width = asInteger(layer.width) ?? asInteger(root.width) ?? 0;
            const height = asInteger(layer.height) ?? asInteger(root.height) ?? 0;

            const foregroundLayer: UnknownRecord = {
                id: nextLayerId,
                name: foregroundLayerName,
                type: 'tilelayer',
                visible: true,
                opacity: typeof layer.opacity === 'number' ? layer.opacity : 1,
                x: asInteger(layer.x) ?? 0,
                y: asInteger(layer.y) ?? 0,
                width,
                height,
                data: foregroundData,
                class: 'Foreground',
            };

            for (const key of [
                'offsetx',
                'offsety',
                'parallaxx',
                'parallaxy',
                'tintcolor',
                'startx',
                'starty',
                'repeatx',
                'repeaty',
                'locked',
            ]) {
                if (key in layer) {
                    foregroundLayer[key] = layer[key];
                }
            }

            let properties = ensureProperty(foregroundLayer.properties, foregroundProperty, 'bool', true);
            properties = ensureProperty(properties, sourceLayerProperty, 'string', layerName);
            foregroundLayer.properties = properties;

            existingForegroundBySource.set(layerName, foregroundLayer);
            newForegroundLayers.push(foregroundLayer);
            createdForegroundLayers += 1;
            nextLayerId += 1;
        }

        if (newForegroundLayers.length > 0) {
            layers.splice(appendForegroundAt, 0, ...newForegroundLayers);
        }
        root.nextlayerid = nextLayerId;

        if (write) {
            await fs.writeFile(mapPath, `${JSON.stringify(root, null, 2)}\n`, 'utf8');
        }

        totalMovedCells += movedCells;
        totalCreatedForegroundLayers += createdForegroundLayers;
        totalMergedForegroundLayers += mergedForegroundLayers;
        mapSummaries.push({
            map: toRelativePath(mapPath),
            highTilesetGidCount: highGids.size,
            movedCells,
            createdForegroundLayers,
            mergedForegroundLayers,
        });
    }

    let strippedExternalTileProperties = 0;
    let strippedExternalTilesTouched = 0;
    if (stripV) {
        const sortedTilesetPaths = [...externalTilesetPathsUsed].sort((a, b) => a.localeCompare(b));
        for (const tilesetPath of sortedTilesetPaths) {
            const payload = await fs.readFile(tilesetPath, 'utf8');
            const root = asRecord(JSON.parse(payload));
            if (!root) {
                fail(`Tileset root must be object: ${toRelativePath(tilesetPath)}`);
            }
            const stripped = stripVPropertiesOnTilesetRecord(root);
            strippedExternalTileProperties += stripped.removedProperties;
            strippedExternalTilesTouched += stripped.touchedTiles;
            if (write) {
                await fs.writeFile(tilesetPath, `${JSON.stringify(root, null, 2)}\n`, 'utf8');
            }
        }
    }

    const summary = {
        options: {
            dir: toRelativePath(dirPath),
            mapCount: mapPaths.length,
            foregroundProperty,
            foregroundSuffix,
            sourceLayerProperty,
            stripV,
            write,
        },
        totals: {
            movedCells: totalMovedCells,
            createdForegroundLayers: totalCreatedForegroundLayers,
            mergedForegroundLayers: totalMergedForegroundLayers,
            strippedInlineVProperties: totalInlineVPropertiesRemoved,
            strippedExternalVProperties: strippedExternalTileProperties,
            strippedExternalTilesTouched,
        },
        maps: mapSummaries,
    };

    console.log(JSON.stringify(summary, null, 2));
}

void main();
