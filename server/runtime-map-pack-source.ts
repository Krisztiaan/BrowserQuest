import fs from 'node:fs/promises';
import path from 'node:path';
import {
    compileMapPack,
    isMapPack,
    type MapPack,
    type MapPackBuildInput,
    type MapPackBuildMapInput,
} from '../shared/maps/map-pack';

type LooseValue = string | number | boolean | null | undefined | object;
type UnknownRecord = Record<string, unknown>;

type RawMapPackConfig = Readonly<{
    maps?: unknown;
    edges?: unknown;
    allow_missing_target_maps?: unknown;
}>;
type TiledMapLike = Readonly<{
    tilesets?: unknown;
}>;

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
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function normalizeSingleTiledMapId(sourcePath: string | undefined): string {
    const baseName = sourcePath ? path.basename(sourcePath, path.extname(sourcePath)).trim() : '';
    if (baseName === 'world') {
        return 'world_01';
    }
    return baseName.length > 0 ? baseName : 'world_01';
}

function isLikelyTiledMapPayload(value: unknown): boolean {
    const record = asRecord(value);
    if (!record) {
        return false;
    }
    return (
        typeof record.width === 'number'
        && typeof record.height === 'number'
        && typeof record.tilewidth === 'number'
        && Array.isArray(record.layers)
    );
}

function isLikelyMapPackConfig(value: unknown): value is RawMapPackConfig {
    const record = asRecord(value);
    if (!record) {
        return false;
    }
    return Array.isArray(record.maps);
}

async function loadJsonFile(filePath: string): Promise<LooseValue> {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as LooseValue;
}

async function inlineTilesetSources({
    tiled,
    mapFilepath,
    tilesetCache,
}: {
    tiled: unknown;
    mapFilepath: string;
    tilesetCache: Map<string, unknown>;
}): Promise<unknown> {
    const root = asRecord(tiled);
    if (!root) {
        return tiled;
    }
    const tilesetsRaw = asArray((root as TiledMapLike).tilesets);
    if (tilesetsRaw.length === 0) {
        return tiled;
    }

    const mapDir = path.dirname(mapFilepath);
    let changed = false;
    const nextTilesets: unknown[] = [];

    for (let i = 0; i < tilesetsRaw.length; i += 1) {
        const rawEntry = tilesetsRaw[i];
        const entry = asRecord(rawEntry);
        if (!entry) {
            nextTilesets.push(rawEntry);
            continue;
        }
        const source = asNonEmptyString(entry.source);
        if (!source) {
            nextTilesets.push(rawEntry);
            continue;
        }

        const firstgid = typeof entry.firstgid === 'number' && Number.isFinite(entry.firstgid) ? entry.firstgid : null;
        if (firstgid === null) {
            throw new Error(`Invalid tileset entry in ${mapFilepath}: tileset source="${source}" is missing firstgid.`);
        }

        const resolved = path.resolve(mapDir, source);
        let tsj = tilesetCache.get(resolved);
        if (!tsj) {
            tsj = await loadJsonFile(resolved);
            tilesetCache.set(resolved, tsj);
        }
        const tsjRecord = asRecord(tsj);
        if (!tsjRecord) {
            throw new Error(`Invalid tileset source "${source}" referenced by ${mapFilepath}: expected JSON object.`);
        }

        nextTilesets.push({ ...tsjRecord, firstgid });
        changed = true;
    }

    if (!changed) {
        return tiled;
    }

    return { ...root, tilesets: nextTilesets };
}

async function compileMapPackFromConfig(configPath: string, config: RawMapPackConfig): Promise<MapPack> {
    const configDir = path.dirname(configPath);
    const mapInputs: MapPackBuildMapInput[] = [];
    const tilesetCache = new Map<string, unknown>();
    const maps = asArray(config.maps);

    for (let i = 0; i < maps.length; i += 1) {
        const entry = asRecord(maps[i]);
        const id = asNonEmptyString(entry?.id);
        const relativeFilepath = asNonEmptyString(entry?.filepath);
        if (!id || !relativeFilepath) {
            throw new Error(`Invalid runtime map config: maps[${i}] requires non-empty id and filepath.`);
        }
        const resolvedPath = path.resolve(configDir, relativeFilepath);
        const tiled = await inlineTilesetSources({
            tiled: await loadJsonFile(resolvedPath),
            mapFilepath: resolvedPath,
            tilesetCache,
        });
        mapInputs.push({
            id,
            tiled,
            sourcePath: path.relative(process.cwd(), resolvedPath).replace(/\\/g, '/'),
        });
    }

    if (mapInputs.length === 0) {
        throw new Error('Invalid runtime map config: no maps declared.');
    }

    return compileMapPack({
        maps: mapInputs,
        edges: Array.isArray(config.edges) ? (config.edges as MapPackBuildInput['edges']) : [],
        allowMissingTargetMaps: config.allow_missing_target_maps === true,
    });
}

export async function compileRuntimeMapPackFromPayload(payload: LooseValue, sourcePath?: string): Promise<MapPack> {
    if (isMapPack(payload)) {
        return payload;
    }

    if (isLikelyMapPackConfig(payload)) {
        if (!sourcePath) {
            throw new Error('Cannot compile runtime map config without a source path.');
        }
        return compileMapPackFromConfig(sourcePath, payload);
    }

    if (isLikelyTiledMapPayload(payload)) {
        const resolvedSourcePath = sourcePath ? path.resolve(sourcePath) : null;
        const tiled = resolvedSourcePath
            ? await inlineTilesetSources({
                tiled: payload,
                mapFilepath: resolvedSourcePath,
                tilesetCache: new Map<string, unknown>(),
            })
            : payload;
        return compileMapPack({
            maps: [{
                id: normalizeSingleTiledMapId(sourcePath),
                tiled,
                ...(sourcePath ? { sourcePath: sourcePath.replace(/\\/g, '/') } : {}),
            }],
            edges: [],
            allowMissingTargetMaps: true,
        });
    }

    throw new Error('Invalid runtime map source: expected map-pack, map-pack config, or Tiled map payload.');
}

export async function loadRuntimeMapPackFromSource(sourcePath: string): Promise<MapPack> {
    const resolvedPath = path.resolve(sourcePath);
    const payload = await loadJsonFile(resolvedPath);
    const normalizedSourcePath = path.relative(process.cwd(), resolvedPath).replace(/\\/g, '/');
    return compileRuntimeMapPackFromPayload(payload, normalizedSourcePath);
}
