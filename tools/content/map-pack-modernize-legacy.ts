import fs from 'node:fs/promises';
import path from 'node:path';
import { parseCliArgs } from '../shared/cli-args';

type UnknownRecord = Record<string, unknown>;

const LEGACY_OBJECT_LAYER_RENAMES = new Map<string, string>([
    ['chests', 'chest_spawns'],
    ['chestareas', 'chest_areas'],
    ['roaming', 'roaming_areas'],
    ['music', 'music_zones'],
    ['mobile zones', 'mobile_zones'],
]);

const OBJECT_LAYER_CLASS_BY_NAME = new Map<string, string>([
    ['resource_nodes', 'ResourceNode'],
    ['static_entities', 'StaticEntity'],
    ['chest_spawns', 'ChestSpawn'],
    ['chest_areas', 'ChestArea'],
    ['doors', 'Door'],
    ['roaming_areas', 'RoamingArea'],
    ['zones', 'Zone'],
    ['music_zones', 'MusicZone'],
    ['checkpoints', 'Checkpoint'],
    ['mobile_zones', 'MobileZone'],
]);

const INT_PROPERTY_NAMES = new Set([
    'target_tx',
    'target_ty',
    'camera_tx',
    'camera_ty',
    'local_tx',
    'local_ty',
    'spawn_tx',
    'spawn_ty',
    'count',
    'zone_id',
    'checkpoint_id',
]);
const mobsTilesetKindsCache = new Map<string, Map<number, string>>();

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

function toRelative(filePath: string): string {
    return path.relative(process.cwd(), filePath).split(path.sep).join('/');
}

function normalizePathForMatch(input: string): string {
    return input.split('\\').join('/').toLowerCase();
}

function resolveIntegerLike(value: unknown): number | null {
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

function resolveInteger(value: unknown): number | null {
    if (typeof value === 'number' && Number.isInteger(value)) {
        return value;
    }
    return null;
}

function resolveTruthy(value: unknown): boolean {
    if (value === true || value === 1) {
        return true;
    }
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'start';
    }
    return false;
}

function propertyList(record: UnknownRecord): UnknownRecord[] {
    return asArray(record.properties)
        .map((entry) => asRecord(entry))
        .filter((entry): entry is UnknownRecord => entry !== null);
}

function detectMaxObjectId(layers: UnknownRecord[]): number {
    let maxId = 0;
    for (const layer of layers) {
        if (asString(layer.type) !== 'objectgroup') {
            continue;
        }
        const objects = asArray(layer.objects)
            .map((entry) => asRecord(entry))
            .filter((entry): entry is UnknownRecord => entry !== null);
        for (const objectRecord of objects) {
            const objectId = asInteger(objectRecord.id);
            if (objectId !== null && objectId > maxId) {
                maxId = objectId;
            }
        }
    }
    return maxId;
}

function getPropertyIndex(properties: UnknownRecord[], name: string): number {
    for (let i = 0; i < properties.length; i += 1) {
        if (asString(properties[i]?.name) === name) {
            return i;
        }
    }
    return -1;
}

function upsertProperty(
    properties: UnknownRecord[],
    name: string,
    type: 'string' | 'int' | 'bool',
    value: string | number | boolean
): { changed: boolean } {
    const index = getPropertyIndex(properties, name);
    const next = { name, type, value };
    if (index >= 0) {
        const existing = properties[index] ?? {};
        const changed = existing.name !== next.name || existing.type !== next.type || existing.value !== next.value;
        properties[index] = next;
        return { changed };
    }
    properties.push(next);
    return { changed: true };
}

function readProperty(properties: UnknownRecord[], name: string): unknown {
    const index = getPropertyIndex(properties, name);
    if (index < 0) {
        return undefined;
    }
    return properties[index]?.value;
}

function removeProperty(properties: UnknownRecord[], name: string): { changed: boolean } {
    const index = getPropertyIndex(properties, name);
    if (index < 0) {
        return { changed: false };
    }
    properties.splice(index, 1);
    return { changed: true };
}

function renameProperty(properties: UnknownRecord[], from: string, to: string): { changed: boolean } {
    const index = getPropertyIndex(properties, from);
    if (index < 0) {
        return { changed: false };
    }
    const source = properties[index];
    const value = source?.value;
    const type = asString(source?.type) ?? 'string';
    properties.splice(index, 1);
    upsertProperty(
        properties,
        to,
        type === 'int' || type === 'bool' || type === 'string' ? type : 'string',
        value as string | number | boolean
    );
    return { changed: true };
}

function normalizeIntProperty(properties: UnknownRecord[], name: string): { changed: boolean } {
    const index = getPropertyIndex(properties, name);
    if (index < 0) {
        return { changed: false };
    }
    const property = properties[index];
    const parsed = resolveIntegerLike(property?.value);
    if (parsed === null) {
        return { changed: false };
    }
    const changed = property?.type !== 'int' || property.value !== parsed;
    properties[index] = { name, type: 'int', value: parsed };
    return { changed };
}

function setObjectName(layerName: string, objectRecord: UnknownRecord, properties: UnknownRecord[]): string {
    const objectId = asInteger(objectRecord.id) ?? 0;
    const propertyValue = (name: string): unknown => readProperty(properties, name);
    const stringProp = (name: string): string | null => {
        const value = propertyValue(name);
        return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
    };
    const intProp = (name: string): number | null => resolveIntegerLike(propertyValue(name));

    if (layerName === 'doors') {
        const doorId = stringProp('door_id');
        if (doorId) {
            return doorId;
        }
        return `door_${objectId}`;
    }
    if (layerName === 'chest_areas') {
        const tx = intProp('spawn_tx');
        const ty = intProp('spawn_ty');
        if (tx !== null && ty !== null) {
            return `chest_area_${tx}_${ty}`;
        }
        return `chest_area_${objectId}`;
    }
    if (layerName === 'chest_spawns') {
        return `chest_spawn_${objectId}`;
    }
    if (layerName === 'roaming_areas') {
        return `roaming_area_${objectId}`;
    }
    if (layerName === 'music_zones') {
        const track = stringProp('track_id') ?? String(objectId);
        return `music_zone_${track.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${objectId}`;
    }
    if (layerName === 'zones' || layerName === 'mobile_zones') {
        const zoneId = intProp('zone_id');
        return `${layerName.slice(0, -1)}_${zoneId ?? objectId}`;
    }
    if (layerName === 'checkpoints') {
        const checkpointId = intProp('checkpoint_id');
        return `checkpoint_${checkpointId ?? objectId}`;
    }
    return `${layerName}_${objectId}`;
}

async function loadMobKindsByLocalId(absoluteTilesetPath: string): Promise<Map<number, string>> {
    const cached = mobsTilesetKindsCache.get(absoluteTilesetPath);
    if (cached) {
        return cached;
    }
    const root = asRecord(JSON.parse(await fs.readFile(absoluteTilesetPath, 'utf8')));
    const kindsByLocalId = new Map<number, string>();
    if (root) {
        const tiles = asArray(root.tiles)
            .map((entry) => asRecord(entry))
            .filter((entry): entry is UnknownRecord => entry !== null);
        for (const tileRecord of tiles) {
            const tileId = asInteger(tileRecord.id);
            if (tileId === null || tileId < 0) {
                continue;
            }
            const properties = propertyList(tileRecord);
            const typeValue = readProperty(properties, 'type');
            const mobKind = asString(typeValue);
            if (mobKind && mobKind.trim().length > 0) {
                kindsByLocalId.set(tileId + 1, mobKind.trim());
            }
        }
    }
    mobsTilesetKindsCache.set(absoluteTilesetPath, kindsByLocalId);
    return kindsByLocalId;
}

async function convertLegacyEntitiesLayerToObjectSpawns({
    root,
    layers,
    mapPath,
}: {
    root: UnknownRecord;
    layers: UnknownRecord[];
    mapPath: string;
}): Promise<{ changed: boolean; convertedLayerCount: number; convertedObjectCount: number }> {
    const entitiesLayerIndex = layers.findIndex(
        (layer) => asString(layer.type) === 'tilelayer' && asString(layer.name) === 'entities'
    );
    if (entitiesLayerIndex < 0) {
        return { changed: false, convertedLayerCount: 0, convertedObjectCount: 0 };
    }

    const entitiesLayer = layers[entitiesLayerIndex];
    if (!entitiesLayer) {
        return { changed: false, convertedLayerCount: 0, convertedObjectCount: 0 };
    }
    const data = asArray(entitiesLayer.data);
    const mapWidth = asInteger(root.width) ?? 0;
    const tileWidth = asInteger(root.tilewidth) ?? 16;
    const tileHeight = asInteger(root.tileheight) ?? tileWidth;
    if (mapWidth <= 0 || tileWidth <= 0 || tileHeight <= 0) {
        fail(`Invalid map dimensions for entities conversion: ${toRelative(mapPath)}`);
    }

    const tilesets = asArray(root.tilesets)
        .map((entry) => asRecord(entry))
        .filter((entry): entry is UnknownRecord => entry !== null);
    const mobsTilesetEntry = tilesets.find((entry) => {
        const source = asString(entry.source);
        const name = asString(entry.name);
        if (source) {
            const normalizedSource = normalizePathForMatch(source);
            if (normalizedSource.endsWith('/mobs.tsj') || normalizedSource.endsWith('mobs.tsj')) {
                return true;
            }
        }
        if (source && normalizePathForMatch(source).endsWith('/mobs.json')) {
            return true;
        }
        return name === 'Mobs';
    });
    if (!mobsTilesetEntry) {
        fail(`Could not find Mobs tileset while converting entities layer: ${toRelative(mapPath)}`);
    }
    const mobsFirstgid = asInteger(mobsTilesetEntry.firstgid);
    if (mobsFirstgid === null || mobsFirstgid <= 0) {
        fail(`Mobs tileset missing firstgid in map: ${toRelative(mapPath)}`);
    }

    const firstGids = tilesets
        .map((entry) => asInteger(entry.firstgid))
        .filter((value): value is number => value !== null && value > mobsFirstgid)
        .sort((a, b) => a - b);
    const nextFirstgid = firstGids[0] ?? Number.POSITIVE_INFINITY;

    let mobKindsByLocalId = new Map<number, string>();
    const mobsSource = asString(mobsTilesetEntry.source);
    if (mobsSource) {
        const mobsSourcePath = path.resolve(path.dirname(mapPath), mobsSource);
        mobKindsByLocalId = await loadMobKindsByLocalId(mobsSourcePath);
    }

    const existingEntitySpawnsIndex = layers.findIndex(
        (layer) => asString(layer.type) === 'objectgroup' && asString(layer.name) === 'static_entities'
    );
    const existingEntitySpawnsLayer =
        existingEntitySpawnsIndex >= 0 ? layers[existingEntitySpawnsIndex] ?? null : null;

    const existingObjects = existingEntitySpawnsLayer
        ? asArray(existingEntitySpawnsLayer.objects)
              .map((entry) => asRecord(entry))
              .filter((entry): entry is UnknownRecord => entry !== null)
        : [];
    const existingTileKeys = new Set<string>();
    for (const objectRecord of existingObjects) {
        const x = typeof objectRecord.x === 'number' ? objectRecord.x : null;
        const y = typeof objectRecord.y === 'number' ? objectRecord.y : null;
        if (x === null || y === null) {
            continue;
        }
        const tx = Math.floor(x / tileWidth);
        const ty = Math.floor(y / tileHeight);
        existingTileKeys.add(`${tx},${ty}`);
    }

    let nextObjectId = asInteger(root.nextobjectid);
    if (nextObjectId === null || nextObjectId <= 0) {
        nextObjectId = detectMaxObjectId(layers) + 1;
    }

    const convertedObjects: UnknownRecord[] = [];
    for (let index = 0; index < data.length; index += 1) {
        const rawGid = resolveInteger(data[index]);
        if (rawGid === null || rawGid <= 0) {
            continue;
        }
        if (rawGid < mobsFirstgid || rawGid >= nextFirstgid) {
            continue;
        }
        const tx = index % mapWidth;
        const ty = Math.floor(index / mapWidth);
        const tileKey = `${tx},${ty}`;
        if (existingTileKeys.has(tileKey)) {
            continue;
        }
        const localMobGid = rawGid - mobsFirstgid + 1;
        const props: UnknownRecord[] = [{ name: 'entity_gid', type: 'int', value: localMobGid }];
        const mobKind = mobKindsByLocalId.get(localMobGid);
        if (mobKind) {
            props.push({ name: 'entity_kind', type: 'string', value: mobKind });
        }
        const objectId = nextObjectId;
        nextObjectId += 1;
        convertedObjects.push({
            id: objectId,
            name: `static_entity_${tx}_${ty}`,
            class: 'StaticEntity',
            x: tx * tileWidth,
            y: ty * tileHeight,
            width: tileWidth,
            height: tileHeight,
            properties: props,
        });
    }

    let changed = false;
    if (existingEntitySpawnsLayer) {
        const merged = [...existingObjects, ...convertedObjects];
        existingEntitySpawnsLayer.objects = merged;
        if (asString(existingEntitySpawnsLayer.class) !== 'StaticEntity') {
            existingEntitySpawnsLayer.class = 'StaticEntity';
            changed = true;
        }
        if (convertedObjects.length > 0) {
            changed = true;
        }
        layers.splice(entitiesLayerIndex, 1);
        changed = true;
    } else {
        const replacementLayer: UnknownRecord = {
            id: asInteger(entitiesLayer.id) ?? undefined,
            name: 'static_entities',
            class: 'StaticEntity',
            type: 'objectgroup',
            visible: false,
            opacity: typeof entitiesLayer.opacity === 'number' ? entitiesLayer.opacity : 1,
            draworder: 'topdown',
            objects: convertedObjects,
        };
        layers.splice(entitiesLayerIndex, 1, replacementLayer);
        changed = true;
    }

    root.nextobjectid = nextObjectId;
    return {
        changed,
        convertedLayerCount: 1,
        convertedObjectCount: convertedObjects.length,
    };
}

function printUsage(): never {
    console.log(
        'Usage: bun tools/content/map-pack-modernize-legacy.ts [--config <path>] [--include-world] [--write]'
    );
    process.exit(0);
}

async function main(): Promise<void> {
    const args = parseCliArgs(
        process.argv.slice(2),
        [
            { key: 'config', kind: 'string', defaultValue: 'assets/maps/tiled/map-pack.config.json' },
            { key: 'include-world', kind: 'boolean', defaultValue: false },
            { key: 'write', kind: 'boolean', defaultValue: false },
        ],
        { onHelp: printUsage }
    );

    const configPath = path.resolve(process.cwd(), String(args.config ?? 'assets/maps/tiled/map-pack.config.json'));
    const includeWorld = Boolean(args['include-world']);
    const write = Boolean(args.write);

    const configRoot = asRecord(JSON.parse(await fs.readFile(configPath, 'utf8')));
    if (!configRoot) {
        fail(`Invalid config root: ${toRelative(configPath)}`);
    }
    const mapEntries = asArray(configRoot.maps)
        .map((entry) => asRecord(entry))
        .filter((entry): entry is UnknownRecord => entry !== null);

    const mapPaths = new Set<string>();
    for (const entry of mapEntries) {
        const filepath = asString(entry.filepath);
        if (!filepath) {
            continue;
        }
        mapPaths.add(path.resolve(path.dirname(configPath), filepath));
    }
    if (includeWorld) {
        mapPaths.add(path.resolve(path.dirname(configPath), './world.json'));
    }

    const sortedMapPaths = [...mapPaths].sort((a, b) => a.localeCompare(b));
    const mapsSummary: UnknownRecord[] = [];

    let renamedLayers = 0;
    let setLayerClasses = 0;
    let setObjectClasses = 0;
    let removedObjectTypes = 0;
    let renamedDoorProps = 0;
    let renamedLayerProps = 0;
    let addedRoamingKindProps = 0;
    let renamedRoamingCountProps = 0;
    let migratedCheckpointSpawnProps = 0;
    let coercedIntProps = 0;
    let setObjectNames = 0;
    let strippedLegacyForegroundLayerProps = 0;
    let convertedLegacyEntitiesLayers = 0;
    let convertedLegacyEntitiesObjects = 0;

    for (const mapPath of sortedMapPaths) {
        const payload = await fs.readFile(mapPath, 'utf8');
        const root = asRecord(JSON.parse(payload));
        if (!root) {
            fail(`Invalid map root: ${toRelative(mapPath)}`);
        }
        const layers = asArray(root.layers)
            .map((entry) => asRecord(entry))
            .filter((entry): entry is UnknownRecord => entry !== null);
        root.layers = layers;

        const entitiesConversion = await convertLegacyEntitiesLayerToObjectSpawns({
            root,
            layers,
            mapPath,
        });
        if (entitiesConversion.changed) {
            convertedLegacyEntitiesLayers += entitiesConversion.convertedLayerCount;
            convertedLegacyEntitiesObjects += entitiesConversion.convertedObjectCount;
        }

        let localRenamedLayers = 0;
        let localSetObjectClasses = 0;
        let localRemovedObjectTypes = 0;
        let localSetObjectNames = 0;

        for (const layer of layers) {
            const layerType = asString(layer.type) ?? '';
            const legacyLayerName = asString(layer.name) ?? '';
            const renamed = LEGACY_OBJECT_LAYER_RENAMES.get(legacyLayerName);
            if (renamed) {
                layer.name = renamed;
                renamedLayers += 1;
                localRenamedLayers += 1;
            }
            const layerName = asString(layer.name) ?? legacyLayerName;

            if (layerType === 'tilelayer') {
                if (layerName.endsWith('_foreground')) {
                    if (asString(layer.class) !== 'Foreground') {
                        layer.class = 'Foreground';
                        setLayerClasses += 1;
                    }
                    const properties = propertyList(layer);
                    const removedForeground = removeProperty(properties, 'bq_foreground');
                    const removedSource = removeProperty(properties, 'bq_source_layer');
                    if (removedForeground.changed || removedSource.changed) {
                        strippedLegacyForegroundLayerProps += (removedForeground.changed ? 1 : 0) + (removedSource.changed ? 1 : 0);
                    }
                    if (properties.length > 0) {
                        layer.properties = properties;
                    } else {
                        delete layer.properties;
                    }
                }
                continue;
            }

            if (layerType !== 'objectgroup') {
                continue;
            }

            const targetLayerClass = OBJECT_LAYER_CLASS_BY_NAME.get(layerName);
            if (targetLayerClass && asString(layer.class) !== targetLayerClass) {
                layer.class = targetLayerClass;
                setLayerClasses += 1;
            }

            const objects = asArray(layer.objects)
                .map((entry) => asRecord(entry))
                .filter((entry): entry is UnknownRecord => entry !== null);
            layer.objects = objects;

            for (const objectRecord of objects) {
                const properties = propertyList(objectRecord);

                if (layerName === 'doors') {
                    const wasPortal = (asString(objectRecord.type) ?? '') === 'portal' || (asString(objectRecord.class) ?? '') === 'Portal';
                    const nextClass = wasPortal ? 'Portal' : 'Door';
                    if (asString(objectRecord.class) !== nextClass) {
                        objectRecord.class = nextClass;
                        setObjectClasses += 1;
                        localSetObjectClasses += 1;
                    }
                    if (asString(objectRecord.type) !== null) {
                        delete objectRecord.type;
                        removedObjectTypes += 1;
                        localRemovedObjectTypes += 1;
                    }

                    for (const [from, to] of [
                        ['o', 'orientation'],
                        ['x', 'target_tx'],
                        ['y', 'target_ty'],
                        ['cx', 'camera_tx'],
                        ['cy', 'camera_ty'],
                    ] as const) {
                        const migrated = renameProperty(properties, from, to);
                        if (migrated.changed) {
                            renamedDoorProps += 1;
                        }
                    }

                    for (const intName of ['target_tx', 'target_ty', 'camera_tx', 'camera_ty', 'local_tx', 'local_ty']) {
                        const normalized = normalizeIntProperty(properties, intName);
                        if (normalized.changed) {
                            coercedIntProps += 1;
                        }
                    }
                } else if (layerName === 'chest_areas') {
                    if (asString(objectRecord.class) !== 'ChestArea') {
                        objectRecord.class = 'ChestArea';
                        setObjectClasses += 1;
                        localSetObjectClasses += 1;
                    }
                    if (asString(objectRecord.type) !== null) {
                        delete objectRecord.type;
                        removedObjectTypes += 1;
                        localRemovedObjectTypes += 1;
                    }
                    for (const [from, to] of [
                        ['x', 'spawn_tx'],
                        ['y', 'spawn_ty'],
                    ] as const) {
                        const migrated = renameProperty(properties, from, to);
                        if (migrated.changed) {
                            renamedLayerProps += 1;
                        }
                    }
                    for (const intName of ['spawn_tx', 'spawn_ty']) {
                        const normalized = normalizeIntProperty(properties, intName);
                        if (normalized.changed) {
                            coercedIntProps += 1;
                        }
                    }
                } else if (layerName === 'chest_spawns') {
                    if (asString(objectRecord.class) !== 'ChestSpawn') {
                        objectRecord.class = 'ChestSpawn';
                        setObjectClasses += 1;
                        localSetObjectClasses += 1;
                    }
                    if (asString(objectRecord.type) !== null) {
                        delete objectRecord.type;
                        removedObjectTypes += 1;
                        localRemovedObjectTypes += 1;
                    }
                } else if (layerName === 'roaming_areas') {
                    if (asString(objectRecord.class) !== 'RoamingArea') {
                        objectRecord.class = 'RoamingArea';
                        setObjectClasses += 1;
                        localSetObjectClasses += 1;
                    }
                    const legacyType = asString(objectRecord.type);
                    if (legacyType && legacyType.trim().length > 0 && getPropertyIndex(properties, 'entity_kind') < 0) {
                        if (upsertProperty(properties, 'entity_kind', 'string', legacyType.trim()).changed) {
                            addedRoamingKindProps += 1;
                        }
                    }
                    if (asString(objectRecord.type) !== null) {
                        delete objectRecord.type;
                        removedObjectTypes += 1;
                        localRemovedObjectTypes += 1;
                    }
                    const renamedCount = renameProperty(properties, 'nb', 'count');
                    if (renamedCount.changed) {
                        renamedRoamingCountProps += 1;
                    }
                    const normalizedCount = normalizeIntProperty(properties, 'count');
                    if (normalizedCount.changed) {
                        coercedIntProps += 1;
                    }
                } else if (layerName === 'music_zones') {
                    if (asString(objectRecord.class) !== 'MusicZone') {
                        objectRecord.class = 'MusicZone';
                        setObjectClasses += 1;
                        localSetObjectClasses += 1;
                    }
                    if (asString(objectRecord.type) !== null) {
                        delete objectRecord.type;
                        removedObjectTypes += 1;
                        localRemovedObjectTypes += 1;
                    }
                    const renamedTrack = renameProperty(properties, 'id', 'track_id');
                    if (renamedTrack.changed) {
                        renamedLayerProps += 1;
                    }
                } else if (layerName === 'checkpoints') {
                    if (asString(objectRecord.class) !== 'Checkpoint') {
                        objectRecord.class = 'Checkpoint';
                        setObjectClasses += 1;
                        localSetObjectClasses += 1;
                    }
                    const legacyType = asString(objectRecord.type);
                    if (legacyType && legacyType.trim().length > 0 && getPropertyIndex(properties, 'spawn') < 0) {
                        if (upsertProperty(properties, 'spawn', 'bool', true).changed) {
                            migratedCheckpointSpawnProps += 1;
                        }
                    }
                    if (asString(objectRecord.type) !== null) {
                        delete objectRecord.type;
                        removedObjectTypes += 1;
                        localRemovedObjectTypes += 1;
                    }
                } else {
                    const layerClass = OBJECT_LAYER_CLASS_BY_NAME.get(layerName);
                    if (layerClass && asString(objectRecord.class) !== layerClass) {
                        objectRecord.class = layerClass;
                        setObjectClasses += 1;
                        localSetObjectClasses += 1;
                    }
                    if (asString(objectRecord.type) !== null) {
                        delete objectRecord.type;
                        removedObjectTypes += 1;
                        localRemovedObjectTypes += 1;
                    }
                }

                for (const intName of INT_PROPERTY_NAMES) {
                    const normalized = normalizeIntProperty(properties, intName);
                    if (normalized.changed) {
                        coercedIntProps += 1;
                    }
                }

                const spawnIndex = getPropertyIndex(properties, 'spawn');
                if (spawnIndex >= 0) {
                    const spawnValue = resolveTruthy(properties[spawnIndex]?.value);
                    const existing = properties[spawnIndex];
                    if (existing?.type !== 'bool' || existing.value !== spawnValue) {
                        properties[spawnIndex] = { name: 'spawn', type: 'bool', value: spawnValue };
                        migratedCheckpointSpawnProps += 1;
                    }
                }

                const existingName = asString(objectRecord.name) ?? '';
                const generatedName = setObjectName(layerName, objectRecord, properties);
                if (existingName !== generatedName) {
                    objectRecord.name = generatedName;
                    setObjectNames += 1;
                    localSetObjectNames += 1;
                }

                if (properties.length > 0) {
                    objectRecord.properties = properties;
                } else {
                    delete objectRecord.properties;
                }
            }
        }

        if (write) {
            await fs.writeFile(mapPath, `${JSON.stringify(root, null, 2)}\n`, 'utf8');
        }

        mapsSummary.push({
            map: toRelative(mapPath),
            renamedLayers: localRenamedLayers,
            setObjectClasses: localSetObjectClasses,
            removedObjectTypes: localRemovedObjectTypes,
            setObjectNames: localSetObjectNames,
        });
    }

    console.log(
        JSON.stringify(
            {
                config: toRelative(configPath),
                includeWorld,
                write,
                totals: {
                    maps: sortedMapPaths.length,
                    renamedLayers,
                    setLayerClasses,
                    setObjectClasses,
                    removedObjectTypes,
                    renamedDoorProps,
                    renamedLayerProps,
                    addedRoamingKindProps,
                    renamedRoamingCountProps,
                    migratedCheckpointSpawnProps,
                    coercedIntProps,
                    setObjectNames,
                    strippedLegacyForegroundLayerProps,
                    convertedLegacyEntitiesLayers,
                    convertedLegacyEntitiesObjects,
                },
                maps: mapsSummary,
            },
            null,
            2
        )
    );
}

void main();
