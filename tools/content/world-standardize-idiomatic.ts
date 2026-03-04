import fs from 'node:fs/promises';
import path from 'node:path';
import { parseCliArgs } from '../shared/cli-args';

type UnknownRecord = Record<string, unknown>;

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

function slugifySegment(value: string): string {
    const normalized = value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
    return normalized.length > 0 ? normalized : 'x';
}

function getObjectProperties(objectRecord: UnknownRecord): UnknownRecord[] {
    return asArray(objectRecord.properties)
        .map((entry) => asRecord(entry))
        .filter((propertyRecord): propertyRecord is UnknownRecord => propertyRecord !== null);
}

function getObjectPropertyValue(objectRecord: UnknownRecord, propertyName: string): unknown {
    const properties = getObjectProperties(objectRecord);
    for (const propertyRecord of properties) {
        const name = asString(propertyRecord.name);
        if (name === propertyName) {
            return propertyRecord.value;
        }
    }
    return undefined;
}

function printUsage(): never {
    console.log(
        'Usage: bun tools/content/world-standardize-idiomatic.ts [--map <path>] [--tilesheet-source <path>] [--mobs-source <path>] [--drop-plateau-mask] [--drop-blocking-mask] [--rename-plateau-mask] [--rename-blocking-mask] [--no-externalize-tilesets] [--no-set-object-types] [--no-set-layer-classes] [--no-set-object-names] [--no-coerce-int-props] [--no-remove-empty-object-props] [--write]'
    );
    process.exit(0);
}

function toRelativePath(fromFile: string, toFile: string): string {
    const fromDir = path.dirname(fromFile);
    const rel = path.relative(fromDir, toFile);
    return rel.split(path.sep).join('/');
}

function resolveIntegerLike(value: unknown): number | null {
    if (typeof value === 'number' && Number.isInteger(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (/^-?\d+$/.test(trimmed)) {
            return Number.parseInt(trimmed, 10);
        }
    }
    return null;
}

type ObjectLayerRule = Readonly<{
    layer: string;
    defaultType: string;
    className: string;
}>;

const OBJECT_LAYER_RULES: readonly ObjectLayerRule[] = [
    { layer: 'resource_nodes', defaultType: 'resource_node', className: 'ResourceNode' },
    { layer: 'entity_spawns', defaultType: 'entity_spawn', className: 'EntitySpawn' },
    { layer: 'chest_spawns', defaultType: 'chest_spawn', className: 'ChestSpawn' },
    { layer: 'chest_areas', defaultType: 'chest_area', className: 'ChestArea' },
    { layer: 'doors', defaultType: 'door', className: 'Door' },
    { layer: 'roaming_areas', defaultType: 'roaming_area', className: 'RoamingArea' },
    { layer: 'zones', defaultType: 'zone', className: 'Zone' },
    { layer: 'music_zones', defaultType: 'music_zone', className: 'MusicZone' },
    { layer: 'checkpoints', defaultType: 'checkpoint', className: 'Checkpoint' },
    { layer: 'mobile_zones', defaultType: 'mobile_zone', className: 'MobileZone' },
];

const INT_PROPERTY_KEYS = new Set([
    'resource_gid',
    'mob_gid',
    'target_tx',
    'target_ty',
    'local_tx',
    'local_ty',
    'spawn_tx',
    'spawn_ty',
    'count',
    'zone_id',
    'checkpoint_id',
]);

async function main(): Promise<void> {
    const parsedArgs = parseCliArgs(
        process.argv.slice(2),
        [
            { key: 'map', kind: 'string', defaultValue: 'assets/maps/tiled/world.json' },
            { key: 'tilesheet-source', kind: 'string', defaultValue: 'assets/maps/tiled/tilesheet.wang.tsj' },
            { key: 'mobs-source', kind: 'string', defaultValue: 'assets/maps/tiled/mobs.tsj' },
            { key: 'drop-plateau-mask', kind: 'boolean', defaultValue: false },
            { key: 'drop-blocking-mask', kind: 'boolean', defaultValue: false },
            { key: 'rename-plateau-mask', kind: 'boolean', defaultValue: false },
            { key: 'rename-blocking-mask', kind: 'boolean', defaultValue: false },
            { key: 'no-externalize-tilesets', kind: 'boolean', defaultValue: false },
            { key: 'no-set-object-types', kind: 'boolean', defaultValue: false },
            { key: 'no-set-layer-classes', kind: 'boolean', defaultValue: false },
            { key: 'no-set-object-names', kind: 'boolean', defaultValue: false },
            { key: 'no-coerce-int-props', kind: 'boolean', defaultValue: false },
            { key: 'no-remove-empty-object-props', kind: 'boolean', defaultValue: false },
            { key: 'write', kind: 'boolean', defaultValue: false },
        ],
        { onHelp: printUsage }
    );

    const mapPath = path.resolve(process.cwd(), String(parsedArgs.map ?? 'assets/maps/tiled/world.json'));
    const externalizeTilesets = !Boolean(parsedArgs['no-externalize-tilesets']);
    const dropPlateauMask = Boolean(parsedArgs['drop-plateau-mask']);
    const dropBlockingMask = Boolean(parsedArgs['drop-blocking-mask']);
    const renamePlateauMask = Boolean(parsedArgs['rename-plateau-mask']);
    const renameBlockingMask = Boolean(parsedArgs['rename-blocking-mask']);
    const setObjectTypes = !Boolean(parsedArgs['no-set-object-types']);
    const setLayerClasses = !Boolean(parsedArgs['no-set-layer-classes']);
    const setObjectNames = !Boolean(parsedArgs['no-set-object-names']);
    const coerceIntProps = !Boolean(parsedArgs['no-coerce-int-props']);
    const removeEmptyObjectProps = !Boolean(parsedArgs['no-remove-empty-object-props']);
    const write = Boolean(parsedArgs.write);

    const tilesheetSourceAbs = path.resolve(process.cwd(), String(parsedArgs['tilesheet-source'] ?? 'assets/maps/tiled/tilesheet.wang.tsj'));
    const mobsSourceAbs = path.resolve(process.cwd(), String(parsedArgs['mobs-source'] ?? 'assets/maps/tiled/mobs.tsj'));
    const tilesheetSourceRel = toRelativePath(mapPath, tilesheetSourceAbs);
    const mobsSourceRel = toRelativePath(mapPath, mobsSourceAbs);

    const payload = await fs.readFile(mapPath, 'utf8');
    const root = asRecord(JSON.parse(payload));
    if (!root) {
        fail('Map root must be an object.');
    }

    const layers = asArray(root.layers)
        .map((entry) => asRecord(entry))
        .filter((layer): layer is UnknownRecord => layer !== null);
    root.layers = layers;

    let removedBlockingMaskLayers = 0;
    let removedPlateauMaskLayers = 0;
    let renamedPlateauMaskLayers = 0;
    let renamedBlockingMaskLayers = 0;
    let setLayerClassCount = 0;
    let setObjectTypeCount = 0;
    let setObjectClassCount = 0;
    let setObjectNameCount = 0;
    let coercedIntPropertyCount = 0;
    let intPropertyParseFailures = 0;
    let removedEmptyObjectProperties = 0;
    let externalizedTilesetsCount = 0;
    let strippedEmbeddedTilesetsCount = 0;
    let sanitizedSourceTilesetsCount = 0;
    let removedEmptyTilesetProperties = 0;

    if (dropBlockingMask || dropPlateauMask) {
        const filteredLayers: UnknownRecord[] = [];
        for (const layer of layers) {
            const name = asString(layer.name) ?? '';
            if (dropPlateauMask && (name === 'plateau_mask' || name === 'plateau')) {
                removedPlateauMaskLayers += 1;
                continue;
            }
            if (dropBlockingMask && (name === 'blocking_mask' || name === 'blocking')) {
                removedBlockingMaskLayers += 1;
                continue;
            }
            filteredLayers.push(layer);
        }
        root.layers = filteredLayers;
    }

    const rulesByLayer = new Map(OBJECT_LAYER_RULES.map((rule) => [rule.layer, rule]));
    const activeLayers = asArray(root.layers)
        .map((entry) => asRecord(entry))
        .filter((layer): layer is UnknownRecord => layer !== null);
    root.layers = activeLayers;

    for (const layer of activeLayers) {
        const layerName = asString(layer.name) ?? '';
        const layerType = asString(layer.type) ?? '';

        if (renamePlateauMask && layerName === 'plateau_mask') {
            layer.name = 'plateau';
            renamedPlateauMaskLayers += 1;
        }

        if (renameBlockingMask && layerName === 'blocking_mask') {
            layer.name = 'blocking';
            renamedBlockingMaskLayers += 1;
        }

        if (layerType !== 'objectgroup') {
            continue;
        }

        const resolvedLayerName = asString(layer.name) ?? layerName;
        const rule = rulesByLayer.get(resolvedLayerName);
        if (!rule) {
            continue;
        }

        if (setLayerClasses) {
            if (asString(layer.class) !== rule.className) {
                layer.class = rule.className;
                setLayerClassCount += 1;
            }
        }

        const objects = asArray(layer.objects)
            .map((entry) => asRecord(entry))
            .filter((objectRecord): objectRecord is UnknownRecord => objectRecord !== null);
        layer.objects = objects;

        for (const objectRecord of objects) {
            const currentType = asString(objectRecord.type) ?? '';
            const wantedType = resolvedLayerName === 'doors' && currentType === 'portal' ? 'portal' : rule.defaultType;
            if (setObjectTypes && currentType !== wantedType) {
                objectRecord.type = wantedType;
                setObjectTypeCount += 1;
            }
            if (setLayerClasses) {
                const wantedClass = resolvedLayerName === 'doors' && wantedType === 'portal' ? 'Portal' : rule.className;
                if (asString(objectRecord.class) !== wantedClass) {
                    objectRecord.class = wantedClass;
                    setObjectClassCount += 1;
                }
            }

            if (!coerceIntProps) {
                continue;
            }

            const properties = asArray(objectRecord.properties)
                .map((entry) => asRecord(entry))
                .filter((propertyRecord): propertyRecord is UnknownRecord => propertyRecord !== null);
            let normalizedProperties = properties;
            if (removeEmptyObjectProps) {
                normalizedProperties = properties.filter(
                    (propertyRecord) => (asString(propertyRecord.name) ?? '').trim().length > 0
                );
                removedEmptyObjectProperties += properties.length - normalizedProperties.length;
            }
            if (normalizedProperties.length > 0) {
                objectRecord.properties = normalizedProperties;
            } else {
                delete objectRecord.properties;
            }

            if (setObjectNames) {
                const objectId = asInteger(objectRecord.id) ?? 0;
                const intProp = (name: string): number | null => resolveIntegerLike(getObjectPropertyValue(objectRecord, name));
                const strProp = (name: string): string | null => {
                    const value = getObjectPropertyValue(objectRecord, name);
                    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
                };

                let generatedName = `${resolvedLayerName}_${objectId}`;
                if (resolvedLayerName === 'resource_nodes') {
                    generatedName = `resource_node_${intProp('resource_gid') ?? objectId}`;
                } else if (resolvedLayerName === 'entity_spawns') {
                    generatedName = `entity_spawn_${objectId}_${intProp('mob_gid') ?? 0}`;
                } else if (resolvedLayerName === 'chest_spawns') {
                    generatedName = `chest_spawn_${objectId}`;
                } else if (resolvedLayerName === 'chest_areas') {
                    const sx = intProp('spawn_tx');
                    const sy = intProp('spawn_ty');
                    generatedName = sx !== null && sy !== null ? `chest_area_${sx}_${sy}` : `chest_area_${objectId}`;
                } else if (resolvedLayerName === 'doors') {
                    const doorId = strProp('door_id');
                    if (doorId) {
                        generatedName = doorId;
                    } else if (wantedType === 'portal') {
                        const targetDoor = strProp('target_door');
                        generatedName = targetDoor ? `portal_to_${slugifySegment(targetDoor)}_${objectId}` : `portal_${objectId}`;
                    } else {
                        generatedName = `door_${objectId}`;
                    }
                } else if (resolvedLayerName === 'roaming_areas') {
                    generatedName = `roaming_area_${objectId}`;
                } else if (resolvedLayerName === 'zones') {
                    generatedName = `zone_${intProp('zone_id') ?? objectId}`;
                } else if (resolvedLayerName === 'music_zones') {
                    generatedName = `music_zone_${slugifySegment(strProp('track_id') ?? String(objectId))}_${objectId}`;
                } else if (resolvedLayerName === 'checkpoints') {
                    generatedName = `checkpoint_${intProp('checkpoint_id') ?? objectId}`;
                } else if (resolvedLayerName === 'mobile_zones') {
                    generatedName = `mobile_zone_${intProp('zone_id') ?? objectId}`;
                }

                const existingName = asString(objectRecord.name) ?? '';
                if (existingName !== generatedName) {
                    objectRecord.name = generatedName;
                    setObjectNameCount += 1;
                }
            }

            for (const propertyRecord of normalizedProperties) {
                const propertyName = asString(propertyRecord.name) ?? '';
                if (!INT_PROPERTY_KEYS.has(propertyName)) {
                    continue;
                }
                const parsedInt = resolveIntegerLike(propertyRecord.value);
                if (parsedInt === null) {
                    intPropertyParseFailures += 1;
                    continue;
                }
                if (propertyRecord.type !== 'int' || propertyRecord.value !== parsedInt) {
                    propertyRecord.type = 'int';
                    propertyRecord.value = parsedInt;
                    coercedIntPropertyCount += 1;
                }
            }
        }
    }

    const tilesets = asArray(root.tilesets)
        .map((entry) => asRecord(entry))
        .filter((tilesetRecord): tilesetRecord is UnknownRecord => tilesetRecord !== null);

    for (const tileset of tilesets) {
        const tiles = asArray(tileset.tiles)
            .map((entry) => asRecord(entry))
            .filter((tileRecord): tileRecord is UnknownRecord => tileRecord !== null);
        tileset.tiles = tiles;
        for (const tileRecord of tiles) {
            const props = asArray(tileRecord.properties)
                .map((entry) => asRecord(entry))
                .filter((propertyRecord): propertyRecord is UnknownRecord => propertyRecord !== null);
            if (props.length === 0) {
                continue;
            }
            const filtered = props.filter((propertyRecord) => (asString(propertyRecord.name) ?? '').trim().length > 0);
            removedEmptyTilesetProperties += props.length - filtered.length;
            if (filtered.length > 0) {
                tileRecord.properties = filtered;
            } else {
                delete tileRecord.properties;
            }
        }
    }

    if (externalizeTilesets) {
        const nextTilesets: UnknownRecord[] = [];
        for (const tileset of tilesets) {
            const firstgid = asInteger(tileset.firstgid);
            if (firstgid === null) {
                fail('Tileset entry missing integer firstgid.');
            }
            const source = asString(tileset.source);
            const name = asString(tileset.name) ?? '';
            if (source && source.trim().length > 0) {
                const normalizedSourceTileset: UnknownRecord = { firstgid, source };
                const sourceHasExtraFields = Object.keys(tileset).some((key) => key !== 'firstgid' && key !== 'source');
                if (sourceHasExtraFields) {
                    sanitizedSourceTilesetsCount += 1;
                }
                nextTilesets.push(normalizedSourceTileset);
                continue;
            }

            if (name === 'tilesheet' || name === 'tilesheet-wang') {
                nextTilesets.push({ firstgid, source: tilesheetSourceRel });
                externalizedTilesetsCount += 1;
                strippedEmbeddedTilesetsCount += 1;
                continue;
            }
            if (name === 'Mobs') {
                nextTilesets.push({ firstgid, source: mobsSourceRel });
                externalizedTilesetsCount += 1;
                strippedEmbeddedTilesetsCount += 1;
                continue;
            }

            nextTilesets.push(tileset);
        }
        root.tilesets = nextTilesets;
    } else {
        root.tilesets = tilesets;
    }

    const finalLayers = asArray(root.layers)
        .map((entry) => asRecord(entry))
        .filter((layer): layer is UnknownRecord => layer !== null);
    const names = new Set<string>();
    for (const layer of finalLayers) {
        const layerName = asString(layer.name) ?? '';
        if (layerName.length === 0) {
            continue;
        }
        if (names.has(layerName)) {
            fail(`Duplicate layer name after standardization: ${layerName}`);
        }
        names.add(layerName);
    }

    if (write) {
        await fs.writeFile(mapPath, `${JSON.stringify(root, null, 2)}\n`, 'utf8');
    }

    console.log(
        JSON.stringify(
            {
                mapPath,
                write,
                options: {
                    externalizeTilesets,
                    tilesheetSourceRel,
                    mobsSourceRel,
                    dropBlockingMask,
                    dropPlateauMask,
                    renamePlateauMask,
                    renameBlockingMask,
                    setObjectTypes,
                    setLayerClasses,
                    setObjectNames,
                    coerceIntProps,
                    removeEmptyObjectProps,
                },
                summary: {
                    removedBlockingMaskLayers,
                    removedPlateauMaskLayers,
                    renamedPlateauMaskLayers,
                    renamedBlockingMaskLayers,
                    setLayerClassCount,
                    setObjectTypeCount,
                    setObjectClassCount,
                    setObjectNameCount,
                    coercedIntPropertyCount,
                    intPropertyParseFailures,
                    removedEmptyObjectProperties,
                    removedEmptyTilesetProperties,
                    externalizedTilesetsCount,
                    strippedEmbeddedTilesetsCount,
                    sanitizedSourceTilesetsCount,
                    resultingLayerCount: asArray(root.layers).length,
                },
            },
            null,
            2
        )
    );
}

void main();
