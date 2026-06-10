import fs from 'node:fs/promises';
import path from 'node:path';
import Types from '../../shared/gametypes-browser';
import { parseCliArgs } from '../shared/cli-args';

type UnknownRecord = Record<string, unknown>;
type ValidationProfile = 'legacy' | 'target';
type DiagnosticLevel = 'error' | 'warn' | 'info';

type Diagnostic = Readonly<{
    level: DiagnosticLevel;
    code: string;
    message: string;
}>;

type ParsedMap = Readonly<{
    path: string;
    width: number;
    height: number;
    tileWidth: number;
    tileHeight: number;
    layers: ReadonlyArray<UnknownRecord>;
    tilesets: ReadonlyArray<UnknownRecord>;
}>;

type LayerContext = Readonly<{
    index: number;
    id: number | null;
    name: string;
    type: string;
    visible: boolean;
    record: UnknownRecord;
}>;

type TargetLayerSpec = Readonly<{
    name: string;
    type: 'tilelayer' | 'objectgroup' | ReadonlyArray<'tilelayer' | 'objectgroup'>;
    visible: boolean;
}>;

const TARGET_BASE_TILE_LAYER_SPECS: ReadonlyArray<TargetLayerSpec> = [
    { name: 'sand', type: 'tilelayer', visible: true },
    { name: 'shoreline', type: 'tilelayer', visible: true },
    { name: 'sea', type: 'tilelayer', visible: true },
    { name: 'beach_props', type: ['tilelayer', 'objectgroup'], visible: true },
    { name: 'ground', type: 'tilelayer', visible: true },
    { name: 'ground_variations', type: 'tilelayer', visible: true },
    { name: 'mud', type: 'tilelayer', visible: true },
    { name: 'grass', type: 'tilelayer', visible: true },
    { name: 'stone', type: 'tilelayer', visible: true },
    { name: 'grass_variations', type: 'tilelayer', visible: true },
    { name: 'lakes', type: 'tilelayer', visible: true },
    { name: 'village_boundaries', type: 'tilelayer', visible: true },
    { name: 'village_boundaries_level_2', type: 'tilelayer', visible: true },
    { name: 'river', type: 'tilelayer', visible: true },
    { name: 'houses', type: ['tilelayer', 'objectgroup'], visible: true },
    { name: 'dry_ground', type: 'tilelayer', visible: true },
    { name: 'dry_ground_2', type: 'tilelayer', visible: true },
    { name: 'big_rocks', type: ['tilelayer', 'objectgroup'], visible: true },
    { name: 'graveyard_mud', type: 'tilelayer', visible: true },
    { name: 'dead_grass', type: 'tilelayer', visible: true },
    { name: 'dead_leaves', type: ['tilelayer', 'objectgroup'], visible: true },
    { name: 'graveyard', type: ['tilelayer', 'objectgroup'], visible: true },
    { name: 'dead_trees', type: ['tilelayer', 'objectgroup'], visible: true },
    { name: 'camps', type: ['tilelayer', 'objectgroup'], visible: true },
    { name: 'bones', type: ['tilelayer', 'objectgroup'], visible: true },
    { name: 'lava', type: 'tilelayer', visible: true },
    { name: 'canyon', type: 'tilelayer', visible: true },
    { name: 'cliffs', type: 'tilelayer', visible: true },
    { name: 'cliffs_2', type: 'tilelayer', visible: true },
    { name: 'totems', type: ['tilelayer', 'objectgroup'], visible: true },
    { name: 'cactus', type: ['tilelayer', 'objectgroup'], visible: true },
    { name: 'lava_falls', type: 'tilelayer', visible: true },
    { name: 'lava_boundaries', type: 'tilelayer', visible: true },
    { name: 'cave', type: 'tilelayer', visible: true },
    { name: 'trees', type: ['tilelayer', 'objectgroup'], visible: true },
    { name: 'cave_river', type: 'tilelayer', visible: true },
    { name: 'cave_walls', type: 'tilelayer', visible: true },
    { name: 'indoor', type: 'tilelayer', visible: true },
    { name: 'indoor_walls', type: 'tilelayer', visible: true },
    { name: 'indoor_doors', type: 'tilelayer', visible: true },
    { name: 'carpets', type: 'tilelayer', visible: true },
    { name: 'indoor_props', type: ['tilelayer', 'objectgroup'], visible: true },
    { name: 'forest_paths', type: 'tilelayer', visible: true },
    { name: 'forest', type: 'tilelayer', visible: true },
    { name: 'forest_lakes', type: 'tilelayer', visible: true },
    { name: 'forest_boundaries', type: 'tilelayer', visible: true },
    { name: 'forest_trees', type: ['tilelayer', 'objectgroup'], visible: true },
    { name: 'bridge_shadows', type: 'tilelayer', visible: true },
    { name: 'bridge', type: 'tilelayer', visible: true },
    { name: 'forest_props', type: ['tilelayer', 'objectgroup'], visible: true },
    { name: 'maze_floor', type: 'tilelayer', visible: true },
    { name: 'maze_walls', type: 'tilelayer', visible: true },
];

const TARGET_OBJECT_LAYER_SPECS: ReadonlyArray<TargetLayerSpec> = [
    { name: 'resource_nodes', type: 'objectgroup', visible: false },
    { name: 'static_entities', type: 'objectgroup', visible: false },
    { name: 'chest_spawns', type: 'objectgroup', visible: false },
    { name: 'chest_areas', type: 'objectgroup', visible: false },
    { name: 'doors', type: 'objectgroup', visible: false },
    { name: 'roaming_areas', type: 'objectgroup', visible: false },
    { name: 'music_zones', type: 'objectgroup', visible: false },
    { name: 'checkpoints', type: 'objectgroup', visible: false },
];

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

function asBoolean(value: unknown): boolean | null {
    return typeof value === 'boolean' ? value : null;
}

function asInteger(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
        return null;
    }
    return value;
}

function isNumericLike(value: unknown): boolean {
    if (typeof value === 'number') {
        return Number.isFinite(value);
    }
    if (typeof value === 'string' && value.trim().length > 0) {
        return Number.isFinite(Number(value));
    }
    return false;
}

function isResolvableMobKindName(value: unknown): value is string {
    if (typeof value !== 'string') {
        return false;
    }
    const trimmed = value.trim();
    if (trimmed.length === 0) {
        return false;
    }
    const kind = Types.getKindFromString(trimmed);
    return kind !== undefined && Types.isMob(kind);
}

function isResolvableEntityKindName(value: unknown): value is string {
    if (typeof value !== 'string') {
        return false;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 && Types.getKindFromString(trimmed) !== undefined;
}

function isBooleanLike(value: unknown): boolean {
    if (typeof value === 'boolean') {
        return true;
    }
    if (typeof value === 'number') {
        return value === 0 || value === 1;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim().toLowerCase();
        return trimmed === 'true' || trimmed === 'false' || trimmed === '0' || trimmed === '1';
    }
    return false;
}

function formatLayerRef(layer: LayerContext): string {
    return `${layer.name}#${layer.id ?? 'no-id'}@${layer.index}`;
}

function pushDiagnostic(diags: Diagnostic[], level: DiagnosticLevel, code: string, message: string): void {
    diags.push({ level, code, message });
}

function matchesExpectedLayerType(
    actualType: string,
    expectedType: TargetLayerSpec['type']
): boolean {
    if (Array.isArray(expectedType)) {
        return expectedType.includes(actualType as 'tilelayer' | 'objectgroup');
    }
    return actualType === expectedType;
}

function formatExpectedLayerType(expectedType: TargetLayerSpec['type']): string {
    return typeof expectedType === 'string' ? expectedType : expectedType.join('|');
}

function relPath(filePath: string): string {
    return path.relative(process.cwd(), filePath).split(path.sep).join('/');
}

function shiftTileDataForValidation(
    data: unknown[],
    width: number,
    height: number,
    offsetX: number,
    offsetY: number,
    tileWidth: number,
    tileHeight: number
): number[] | null {
    if (offsetX % tileWidth !== 0 || offsetY % tileHeight !== 0) {
        return null;
    }
    const dx = Math.trunc(offsetX / tileWidth);
    const dy = Math.trunc(offsetY / tileHeight);
    const shifted = new Array<number>(width * height).fill(0);
    for (let index = 0; index < data.length; index += 1) {
        const value = data[index];
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
            return null;
        }
        if (value === 0) {
            continue;
        }
        const x = index % width;
        const y = Math.floor(index / width);
        const shiftedX = x + dx;
        const shiftedY = y + dy;
        if (shiftedX < 0 || shiftedY < 0 || shiftedX >= width || shiftedY >= height) {
            continue;
        }
        shifted[shiftedY * width + shiftedX] = value;
    }
    return shifted;
}

function parseProfile(raw: string): ValidationProfile {
    if (raw === 'legacy' || raw === 'target') {
        return raw;
    }
    fail(`Invalid --profile value "${raw}". Expected "legacy" or "target".`);
}

function levelByProfile(profile: ValidationProfile): DiagnosticLevel {
    return profile === 'target' ? 'error' : 'warn';
}

async function loadMap(mapPath: string, diags: Diagnostic[]): Promise<ParsedMap | null> {
    const absolute = path.resolve(process.cwd(), mapPath);
    const payload = await fs.readFile(absolute, 'utf8');
    const parsed = JSON.parse(payload) as unknown;
    const root = asRecord(parsed);
    if (!root) {
        pushDiagnostic(diags, 'error', 'MAP_ROOT_INVALID', 'Map root JSON value must be an object.');
        return null;
    }

    const width = asInteger(root.width);
    const height = asInteger(root.height);
    const tileWidth = asInteger(root.tilewidth);
    const tileHeight = asInteger(root.tileheight);

    if (!width || width <= 0) {
        pushDiagnostic(diags, 'error', 'MAP_WIDTH_INVALID', 'Map width must be a positive integer.');
    }
    if (!height || height <= 0) {
        pushDiagnostic(diags, 'error', 'MAP_HEIGHT_INVALID', 'Map height must be a positive integer.');
    }
    if (!tileWidth || tileWidth <= 0) {
        pushDiagnostic(diags, 'error', 'MAP_TILEWIDTH_INVALID', 'Map tilewidth must be a positive integer.');
    }
    if (!tileHeight || tileHeight <= 0) {
        pushDiagnostic(diags, 'error', 'MAP_TILEHEIGHT_INVALID', 'Map tileheight must be a positive integer.');
    }

    const layersRaw = asArray(root.layers);
    if (layersRaw.length === 0) {
        pushDiagnostic(diags, 'error', 'MAP_LAYERS_EMPTY', 'Map layers must be a non-empty array.');
    }

    const layerRecords: UnknownRecord[] = [];
    for (let index = 0; index < layersRaw.length; index += 1) {
        const layerRecord = asRecord(layersRaw[index]);
        if (!layerRecord) {
            pushDiagnostic(diags, 'error', 'LAYER_ENTRY_INVALID', `layers[${index}] must be an object.`);
            continue;
        }
        layerRecords.push(layerRecord);
    }

    const tilesetsRaw = asArray(root.tilesets);
    const tilesetRecords: UnknownRecord[] = [];
    for (let index = 0; index < tilesetsRaw.length; index += 1) {
        const tilesetRecord = asRecord(tilesetsRaw[index]);
        if (!tilesetRecord) {
            pushDiagnostic(diags, 'error', 'TILESET_ENTRY_INVALID', `tilesets[${index}] must be an object.`);
            continue;
        }
        tilesetRecords.push(tilesetRecord);
    }

    if (!width || !height || !tileWidth || !tileHeight || layerRecords.length === 0) {
        return null;
    }

    return {
        path: absolute,
        width,
        height,
        tileWidth,
        tileHeight,
        layers: layerRecords,
        tilesets: tilesetRecords,
    };
}

function buildLayerContexts(map: ParsedMap, diags: Diagnostic[]): LayerContext[] {
    const contexts: LayerContext[] = [];
    const seenIds = new Set<number>();

    const flattenLayers = (
        records: ReadonlyArray<UnknownRecord>,
        state: Readonly<{ visible: boolean; offsetX: number; offsetY: number }>
    ): UnknownRecord[] => {
        const flattened: UnknownRecord[] = [];
        for (const record of records) {
            const typeRaw = asString(record.type);
            const visibleRaw = asBoolean(record.visible);
            const ownOffsetX =
                typeof record.offsetx === 'number' && Number.isFinite(record.offsetx) ? (record.offsetx) : 0;
            const ownOffsetY =
                typeof record.offsety === 'number' && Number.isFinite(record.offsety) ? (record.offsety) : 0;
            const effectiveVisible = state.visible && (visibleRaw ?? true);
            const effectiveOffsetX = state.offsetX + ownOffsetX;
            const effectiveOffsetY = state.offsetY + ownOffsetY;

            if (typeRaw === 'group') {
                const nested = asArray(record.layers)
                    .map((entry) => asRecord(entry))
                    .filter((entry): entry is UnknownRecord => entry !== null);
                flattened.push(
                    ...flattenLayers(nested, {
                        visible: effectiveVisible,
                        offsetX: effectiveOffsetX,
                        offsetY: effectiveOffsetY,
                    })
                );
                continue;
            }

            const clone: UnknownRecord = {
                ...record,
                visible: effectiveVisible,
                offsetx: 0,
                offsety: 0,
            };
            if (typeRaw === 'objectgroup') {
                clone.objects = asArray(record.objects)
                    .map((entry) => asRecord(entry))
                    .filter((entry): entry is UnknownRecord => entry !== null)
                    .map((objectRecord) => ({
                        ...objectRecord,
                        x:
                            (typeof objectRecord.x === 'number' ? objectRecord.x : 0)
                            + effectiveOffsetX,
                        y:
                            (typeof objectRecord.y === 'number' ? objectRecord.y : 0)
                            + effectiveOffsetY,
                    }));
            }
            if (typeRaw === 'tilelayer' && (effectiveOffsetX !== 0 || effectiveOffsetY !== 0)) {
                const shifted = shiftTileDataForValidation(
                    asArray(record.data),
                    map.width,
                    map.height,
                    effectiveOffsetX,
                    effectiveOffsetY,
                    map.tileWidth,
                    map.tileHeight
                );
                if (shifted === null) {
                    pushDiagnostic(
                        diags,
                        'error',
                        'LAYER_OFFSET_UNSUPPORTED',
                        `Layer ${asString(record.name) ?? '<unnamed>'} uses unsupported sub-tile offset.`
                    );
                } else {
                    clone.data = shifted;
                }
            }
            flattened.push(clone);
        }
        return flattened;
    };

    const flattenedLayers = flattenLayers(map.layers, { visible: true, offsetX: 0, offsetY: 0 });
    for (let index = 0; index < flattenedLayers.length; index += 1) {
        const record = flattenedLayers[index];
        if (!record) {
            continue;
        }
        const nameRaw = asString(record.name);
        const typeRaw = asString(record.type);
        const idRaw = asInteger(record.id);
        const visibleRaw = asBoolean(record.visible);

        if (!nameRaw) {
            pushDiagnostic(diags, 'error', 'LAYER_NAME_INVALID', `layers[${index}] is missing a valid string name.`);
        }
        if (!typeRaw) {
            pushDiagnostic(diags, 'error', 'LAYER_TYPE_INVALID', `layers[${index}] is missing a valid string type.`);
        }
        if (idRaw === null) {
            pushDiagnostic(diags, 'warn', 'LAYER_ID_MISSING', `layers[${index}] has no integer id.`);
        }
        if (idRaw !== null) {
            if (seenIds.has(idRaw)) {
                pushDiagnostic(diags, 'error', 'LAYER_ID_DUPLICATE', `Layer id ${idRaw} appears more than once.`);
            }
            seenIds.add(idRaw);
        }

        contexts.push({
            index,
            id: idRaw,
            name: nameRaw ?? `<unnamed_${index}>`,
            type: typeRaw ?? '<unknown>',
            visible: visibleRaw ?? true,
            record,
        });
    }

    return contexts;
}

function getTileData(layer: LayerContext): number[] | null {
    if (layer.type !== 'tilelayer') {
        return null;
    }
    const dataRaw = asArray(layer.record.data);
    const data: number[] = [];
    for (let index = 0; index < dataRaw.length; index += 1) {
        const value = dataRaw[index];
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
            return null;
        }
        data.push(value);
    }
    return data;
}

function getObjects(layer: LayerContext): UnknownRecord[] {
    if (layer.type !== 'objectgroup') {
        return [];
    }
    const objectsRaw = asArray(layer.record.objects);
    const objects: UnknownRecord[] = [];
    for (let index = 0; index < objectsRaw.length; index += 1) {
        const objectRecord = asRecord(objectsRaw[index]);
        if (objectRecord) {
            objects.push(objectRecord);
        }
    }
    return objects;
}

function getPropertyEntries(value: unknown): UnknownRecord[] {
    const out: UnknownRecord[] = [];
    for (const raw of asArray(value)) {
        const propertyRecord = asRecord(raw);
        if (propertyRecord) {
            out.push(propertyRecord);
        }
    }
    return out;
}

function getPropertyMap(value: unknown): Map<string, unknown> {
    const map = new Map<string, unknown>();
    for (const propertyRecord of getPropertyEntries(value)) {
        const name = asString(propertyRecord.name);
        if (name !== null) {
            map.set(name, propertyRecord.value);
        }
    }
    return map;
}

function getObjectClassName(objectRecord: UnknownRecord): string | null {
    const objectClass = asString(objectRecord.class)?.trim();
    if (objectClass && objectClass.length > 0) {
        return objectClass;
    }
    const objectType = asString(objectRecord.type)?.trim();
    if (objectType && objectType.length > 0) {
        return objectType;
    }
    return null;
}

function checkLayerPayloads(map: ParsedMap, layers: ReadonlyArray<LayerContext>, diags: Diagnostic[]): void {
    const expectedCellCount = map.width * map.height;
    for (const layer of layers) {
        if (layer.type === 'tilelayer') {
            const data = getTileData(layer);
            if (!data) {
                pushDiagnostic(diags, 'error', 'TILE_DATA_INVALID', `${formatLayerRef(layer)} has invalid tile data.`);
                continue;
            }
            if (data.length !== expectedCellCount) {
                pushDiagnostic(
                    diags,
                    'error',
                    'TILE_DATA_LENGTH_MISMATCH',
                    `${formatLayerRef(layer)} has ${data.length} cells, expected ${expectedCellCount}.`
                );
            }
        }
        if (layer.type === 'objectgroup') {
            const objectsRaw = layer.record.objects;
            if (objectsRaw !== undefined && !Array.isArray(objectsRaw)) {
                pushDiagnostic(diags, 'error', 'OBJECTS_INVALID', `${formatLayerRef(layer)} objects must be an array.`);
            }
        }
    }
}

function checkLayerNaming(profile: ValidationProfile, layers: ReadonlyArray<LayerContext>, diags: Diagnostic[]): void {
    const snakeCasePattern = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
    const level = levelByProfile(profile);
    for (const layer of layers) {
        if (!snakeCasePattern.test(layer.name)) {
            pushDiagnostic(
                diags,
                level,
                'LAYER_NAME_NOT_SNAKE_CASE',
                `${formatLayerRef(layer)} is not lower snake_case.`
            );
        }
    }
}

function checkEmptyPropertyNames(profile: ValidationProfile, map: ParsedMap, layers: ReadonlyArray<LayerContext>, diags: Diagnostic[]): void {
    const level = levelByProfile(profile);

    for (const layer of layers) {
        const layerProps = getPropertyEntries(layer.record.properties);
        for (const propertyRecord of layerProps) {
            const name = asString(propertyRecord.name);
            if (name !== null && name.trim().length === 0) {
                pushDiagnostic(diags, level, 'EMPTY_PROPERTY_NAME', `${formatLayerRef(layer)} has empty layer property name.`);
            }
        }

        for (const objectRecord of getObjects(layer)) {
            const objectId = asInteger(objectRecord.id);
            for (const propertyRecord of getPropertyEntries(objectRecord.properties)) {
                const name = asString(propertyRecord.name);
                if (name !== null && name.trim().length === 0) {
                    pushDiagnostic(
                        diags,
                        level,
                        'EMPTY_PROPERTY_NAME',
                        `${formatLayerRef(layer)} object ${objectId ?? 'no-id'} has empty property name.`
                    );
                }
            }
        }
    }

    for (const tilesetRecord of map.tilesets) {
        const tilesetName = asString(tilesetRecord.name) ?? '<unnamed_tileset>';
        for (const tileEntry of asArray(tilesetRecord.tiles)) {
            const tileRecord = asRecord(tileEntry);
            if (!tileRecord) {
                continue;
            }
            const tileId = asInteger(tileRecord.id);
            for (const propertyRecord of getPropertyEntries(tileRecord.properties)) {
                const name = asString(propertyRecord.name);
                if (name !== null && name.trim().length === 0) {
                    pushDiagnostic(
                        diags,
                        level,
                        'EMPTY_PROPERTY_NAME',
                        `Tileset ${tilesetName} tile ${tileId ?? 'no-id'} has empty property name.`
                    );
                }
            }
        }
    }
}

function checkObjectBoundsAndDuplicates(
    profile: ValidationProfile,
    map: ParsedMap,
    layers: ReadonlyArray<LayerContext>,
    diags: Diagnostic[]
): void {
    const boundsLevel = levelByProfile(profile);
    const duplicateLevel = levelByProfile(profile);
    const mapWidthPx = map.width * map.tileWidth;
    const mapHeightPx = map.height * map.tileHeight;

    for (const layer of layers) {
        if (layer.type !== 'objectgroup') {
            continue;
        }

        const seen = new Map<string, number>();
        for (const objectRecord of getObjects(layer)) {
            const id = asInteger(objectRecord.id);
            const x = typeof objectRecord.x === 'number' ? objectRecord.x : null;
            const y = typeof objectRecord.y === 'number' ? objectRecord.y : null;
            const width = typeof objectRecord.width === 'number' ? objectRecord.width : 0;
            const height = typeof objectRecord.height === 'number' ? objectRecord.height : 0;
            const type = asString(objectRecord.type) ?? '';
            const name = asString(objectRecord.name) ?? '';

            if (x === null || y === null) {
                pushDiagnostic(
                    diags,
                    'error',
                    'OBJECT_COORDS_INVALID',
                    `${formatLayerRef(layer)} object ${id ?? 'no-id'} has invalid x/y.`
                );
                continue;
            }

            const maxX = x + width;
            const maxY = y + height;
            if (x < 0 || y < 0 || maxX > mapWidthPx || maxY > mapHeightPx) {
                pushDiagnostic(
                    diags,
                    boundsLevel,
                    'OBJECT_OUT_OF_MAP_BOUNDS',
                    `${formatLayerRef(layer)} object ${id ?? 'no-id'} is outside map bounds.`
                );
            }

            const props = getPropertyEntries(objectRecord.properties)
                .map((propertyRecord) => {
                    const key = asString(propertyRecord.name) ?? '<missing_name>';
                    return `${key}:${JSON.stringify(propertyRecord.value ?? '')}`;
                })
                .sort()
                .join('|');

            const gid = asInteger(objectRecord.gid);
            const renderableTileObjectKeyPart =
                layer.visible === true && gid !== null && gid > 0 ? `;gid:${gid}` : '';
            const duplicateKey = `${x};${y};${width};${height};${type};${name};${props}${renderableTileObjectKeyPart}`;
            const previous = seen.get(duplicateKey);
            if (previous !== undefined) {
                pushDiagnostic(
                    diags,
                    duplicateLevel,
                    'DUPLICATE_OBJECT_GEOMETRY',
                    `${formatLayerRef(layer)} object ${id ?? 'no-id'} duplicates object ${previous}.`
                );
            } else if (id !== null) {
                seen.set(duplicateKey, id);
            }
        }
    }
}

function extractPortalTileCoords(layer: LayerContext | undefined, width: number): Set<string> {
    const coords = new Set<string>();
    if (layer?.type !== 'tilelayer') {
        return coords;
    }
    const data = getTileData(layer);
    if (!data) {
        return coords;
    }
    for (let index = 0; index < data.length; index += 1) {
        const gid = data[index];
        if (!gid || gid === 0) {
            continue;
        }
        const x = index % width;
        const y = Math.floor(index / width);
        coords.add(`${x},${y}`);
    }
    return coords;
}

function extractDoorPortalCoords(layer: LayerContext | undefined, tileWidth: number, tileHeight: number): Set<string> {
    const coords = new Set<string>();
    if (layer?.type !== 'objectgroup') {
        return coords;
    }
    for (const objectRecord of getObjects(layer)) {
        const objectClass = getObjectClassName(objectRecord);
        if (objectClass !== 'Portal') {
            continue;
        }
        const x = typeof objectRecord.x === 'number' ? objectRecord.x : null;
        const y = typeof objectRecord.y === 'number' ? objectRecord.y : null;
        if (x === null || y === null) {
            continue;
        }
        const tx = Math.floor(x / tileWidth);
        const ty = Math.floor(y / tileHeight);
        coords.add(`${tx},${ty}`);
    }
    return coords;
}

function checkPortalAuthority(profile: ValidationProfile, map: ParsedMap, layers: ReadonlyArray<LayerContext>, diags: Diagnostic[]): void {
    const portalsLayer = layers.find((layer) => layer.name === 'portals');
    const doorsLayer = layers.find((layer) => layer.name === 'doors');

    if (profile === 'target' && portalsLayer) {
        pushDiagnostic(diags, 'error', 'PORTALS_TILE_LAYER_PRESENT', 'Target profile forbids a `portals` tilelayer.');
    }

    const tileCoords = extractPortalTileCoords(portalsLayer, map.width);
    const doorCoords = extractDoorPortalCoords(doorsLayer, map.tileWidth, map.tileHeight);
    if (tileCoords.size === 0 || doorCoords.size === 0) {
        return;
    }

    const extraDoorCoords: string[] = [];
    const extraTileCoords: string[] = [];

    for (const key of doorCoords) {
        if (!tileCoords.has(key)) {
            extraDoorCoords.push(key);
        }
    }
    for (const key of tileCoords) {
        if (!doorCoords.has(key)) {
            extraTileCoords.push(key);
        }
    }

    if (extraDoorCoords.length > 0 || extraTileCoords.length > 0) {
        const level = levelByProfile(profile);
        pushDiagnostic(
            diags,
            level,
            'PORTAL_AUTHORITY_MISMATCH',
            `Portal coordinates differ between tile/object layers (door-only: ${extraDoorCoords.join(', ') || 'none'}; tile-only: ${
                extraTileCoords.join(', ') || 'none'
            }).`
        );
    }
}

function checkLegacyHints(layers: ReadonlyArray<LayerContext>, diags: Diagnostic[]): void {
    const sentinel = layers.find((layer) => layer.name === "don't remove this layer");
    if (sentinel) {
        pushDiagnostic(diags, 'warn', 'LEGACY_SENTINEL_LAYER', "Sentinel layer `don't remove this layer` is still present.");
    }

    const zonesLayer = layers.find((layer) => layer.name === 'zones' && layer.type === 'objectgroup');
    if (zonesLayer) {
        const objects = getObjects(zonesLayer);
        const unlabeled = objects.filter((objectRecord) => {
            const name = asString(objectRecord.name) ?? '';
            const type = asString(objectRecord.type) ?? '';
            return name.trim().length === 0 && type.trim().length === 0 && getPropertyEntries(objectRecord.properties).length === 0;
        }).length;
        if (unlabeled > 0) {
            pushDiagnostic(
                diags,
                'warn',
                'LEGACY_ZONE_OBJECTS_UNLABELED',
                `Layer zones has ${unlabeled} objects with no name/type/properties.`
            );
        }
    }
}

function checkTargetLayerContract(layers: ReadonlyArray<LayerContext>, diags: Diagnostic[]): void {
    for (let index = 0; index < TARGET_BASE_TILE_LAYER_SPECS.length; index += 1) {
        const actual = layers[index];
        const expected = TARGET_BASE_TILE_LAYER_SPECS[index];
        if (!actual || !expected) {
            pushDiagnostic(diags, 'error', 'TARGET_LAYER_MISSING', `Layer index ${index} expected ${expected?.name ?? 'unknown'}, found <missing>.`);
            continue;
        }
        if (actual.name !== expected.name) {
            pushDiagnostic(
                diags,
                'error',
                'TARGET_LAYER_ORDER_MISMATCH',
                `Layer index ${index} expected name ${expected.name}, found ${actual.name}.`
            );
        }
        if (!matchesExpectedLayerType(actual.type, expected.type)) {
            pushDiagnostic(
                diags,
                'error',
                'TARGET_LAYER_TYPE_MISMATCH',
                `Layer ${actual.name} expected type ${formatExpectedLayerType(expected.type)}, found ${actual.type}.`
            );
        }
        if (actual.visible !== expected.visible) {
            pushDiagnostic(
                diags,
                'error',
                'TARGET_LAYER_VISIBILITY_MISMATCH',
                `Layer ${actual.name} expected visible=${expected.visible}, found ${actual.visible}.`
            );
        }
    }

    let objectStartIndex = -1;
    for (let index = 0; index < layers.length; index += 1) {
        if (layers[index]?.name === TARGET_OBJECT_LAYER_SPECS[0]?.name) {
            objectStartIndex = index;
            break;
        }
    }

    if (objectStartIndex < 0) {
        pushDiagnostic(
            diags,
            'error',
            'TARGET_LAYER_MISSING_OBJECT_TAIL',
            `Missing required object layer "${TARGET_OBJECT_LAYER_SPECS[0]?.name ?? 'resource_nodes'}".`
        );
        return;
    }

    if (objectStartIndex < TARGET_BASE_TILE_LAYER_SPECS.length) {
        pushDiagnostic(
            diags,
            'error',
            'TARGET_LAYER_ORDER_MISMATCH',
            `Object layers start at index ${objectStartIndex} before canonical base tile layers end at ${TARGET_BASE_TILE_LAYER_SPECS.length - 1}.`
        );
    }

    for (let index = TARGET_BASE_TILE_LAYER_SPECS.length; index < objectStartIndex; index += 1) {
        const layer = layers[index];
        if (!layer) {
            continue;
        }
        const layerClass = asString(layer.record.class);
        const properties = getPropertyMap(layer.record.properties);
        const hasLegacyForegroundProps = properties.has('bq_foreground') || properties.has('bq_source_layer');
        const hasForegroundClass = layerClass?.trim() === 'Foreground';
        const isForegroundLayer =
            (layer.type === 'tilelayer' || layer.type === 'objectgroup') &&
            layer.visible === true &&
            layer.name.endsWith('_foreground') &&
            hasForegroundClass;
        if (!isForegroundLayer) {
            pushDiagnostic(
                diags,
                'error',
                'TARGET_LAYER_UNEXPECTED_MIDDLE_LAYER',
                `${formatLayerRef(layer)} must be an explicit foreground render layer (name suffix "_foreground" + class "Foreground").`
            );
        } else if (hasLegacyForegroundProps) {
            pushDiagnostic(
                diags,
                'error',
                'LEGACY_FOREGROUND_PROPERTY_PRESENT',
                `${formatLayerRef(layer)} still uses legacy bq_* foreground properties; class-only foreground marking is required.`
            );
        }
    }

    for (let offset = 0; offset < TARGET_OBJECT_LAYER_SPECS.length; offset += 1) {
        const expected = TARGET_OBJECT_LAYER_SPECS[offset];
        const index = objectStartIndex + offset;
        const actual = layers[index];
        if (!actual || !expected) {
            pushDiagnostic(
                diags,
                'error',
                'TARGET_LAYER_MISSING',
                `Layer index ${index} expected ${expected?.name ?? 'unknown'}, found <missing>.`
            );
            continue;
        }
        if (actual.name !== expected.name) {
            pushDiagnostic(
                diags,
                'error',
                'TARGET_LAYER_ORDER_MISMATCH',
                `Layer index ${index} expected name ${expected.name}, found ${actual.name}.`
            );
        }
        if (!matchesExpectedLayerType(actual.type, expected.type)) {
            pushDiagnostic(
                diags,
                'error',
                'TARGET_LAYER_TYPE_MISMATCH',
                `Layer ${actual.name} expected type ${formatExpectedLayerType(expected.type)}, found ${actual.type}.`
            );
        }
        if (actual.visible !== expected.visible) {
            pushDiagnostic(
                diags,
                'error',
                'TARGET_LAYER_VISIBILITY_MISMATCH',
                `Layer ${actual.name} expected visible=${expected.visible}, found ${actual.visible}.`
            );
        }
    }

    const expectedTotalLayers = objectStartIndex + TARGET_OBJECT_LAYER_SPECS.length;
    if (layers.length > expectedTotalLayers) {
        for (let index = expectedTotalLayers; index < layers.length; index += 1) {
            const extraLayer = layers[index];
            if (!extraLayer) {
                continue;
            }
            pushDiagnostic(
                diags,
                'error',
                'TARGET_LAYER_UNEXPECTED_TAIL_LAYER',
                `${formatLayerRef(extraLayer)} appears after the required object-layer tail.`
            );
        }
    }
}

function requireProperty(
    diags: Diagnostic[],
    layer: LayerContext,
    objectId: number | null,
    props: Map<string, unknown>,
    propertyName: string,
    code: string
): void {
    if (!props.has(propertyName)) {
        pushDiagnostic(diags, 'error', code, `${formatLayerRef(layer)} object ${objectId ?? 'no-id'} is missing ${propertyName}.`);
    }
}

function requireNonEmptyObjectName(
    diags: Diagnostic[],
    layer: LayerContext,
    objectRecord: UnknownRecord,
    code: string
): void {
    const objectId = asInteger(objectRecord.id);
    const name = asString(objectRecord.name) ?? '';
    if (name.trim().length === 0) {
        pushDiagnostic(
            diags,
            'error',
            code,
            `${formatLayerRef(layer)} object ${objectId ?? 'no-id'} is missing stable name.`
        );
    }
}

function requireNonEmptyObjectClass(
    diags: Diagnostic[],
    layer: LayerContext,
    objectRecord: UnknownRecord,
    code: string
): void {
    const objectId = asInteger(objectRecord.id);
    const objectClass = getObjectClassName(objectRecord) ?? '';
    if (objectClass.length === 0) {
        pushDiagnostic(
            diags,
            'error',
            code,
            `${formatLayerRef(layer)} object ${objectId ?? 'no-id'} is missing class.`
        );
    }
}

function checkTargetObjectContracts(layers: ReadonlyArray<LayerContext>, diags: Diagnostic[]): void {
    const byName = new Map<string, LayerContext>();
    for (const layer of layers) {
        byName.set(layer.name, layer);
    }

    const doors = byName.get('doors');
    if (doors?.type === 'objectgroup') {
        for (const objectRecord of getObjects(doors)) {
            const objectId = asInteger(objectRecord.id);
            const props = getPropertyMap(objectRecord.properties);
            requireNonEmptyObjectName(diags, doors, objectRecord, 'OBJECT_NAME_MISSING');
            requireNonEmptyObjectClass(diags, doors, objectRecord, 'OBJECT_CLASS_MISSING');
            requireProperty(diags, doors, objectId, props, 'orientation', 'DOOR_PROPERTY_MISSING');
            requireProperty(diags, doors, objectId, props, 'target_tx', 'DOOR_PROPERTY_MISSING');
            requireProperty(diags, doors, objectId, props, 'target_ty', 'DOOR_PROPERTY_MISSING');

            const forbidden = ['o', 'x', 'y', 'cx', 'cy'];
            for (const key of forbidden) {
                if (props.has(key)) {
                    pushDiagnostic(
                        diags,
                        'error',
                        'DOOR_LEGACY_PROPERTY_PRESENT',
                        `${formatLayerRef(doors)} object ${objectId ?? 'no-id'} still uses legacy property ${key}.`
                    );
                }
            }

            const objectClass = getObjectClassName(objectRecord) ?? '';
            if (objectClass === 'Portal') {
                requireProperty(diags, doors, objectId, props, 'door_id', 'PORTAL_PROPERTY_MISSING');
                requireProperty(diags, doors, objectId, props, 'target_door', 'PORTAL_PROPERTY_MISSING');
                requireProperty(diags, doors, objectId, props, 'target_map', 'PORTAL_PROPERTY_MISSING');
            }
        }
    }

    const chestAreas = byName.get('chest_areas');
    if (chestAreas?.type === 'objectgroup') {
        for (const objectRecord of getObjects(chestAreas)) {
            const objectId = asInteger(objectRecord.id);
            const props = getPropertyMap(objectRecord.properties);
            requireNonEmptyObjectName(diags, chestAreas, objectRecord, 'OBJECT_NAME_MISSING');
            requireNonEmptyObjectClass(diags, chestAreas, objectRecord, 'OBJECT_CLASS_MISSING');
            requireProperty(diags, chestAreas, objectId, props, 'items', 'CHEST_AREA_PROPERTY_MISSING');
            requireProperty(diags, chestAreas, objectId, props, 'spawn_tx', 'CHEST_AREA_PROPERTY_MISSING');
            requireProperty(diags, chestAreas, objectId, props, 'spawn_ty', 'CHEST_AREA_PROPERTY_MISSING');
            if (props.has('x') || props.has('y')) {
                pushDiagnostic(
                    diags,
                    'error',
                    'CHEST_AREA_LEGACY_XY_PRESENT',
                    `${formatLayerRef(chestAreas)} object ${objectId ?? 'no-id'} still uses x/y properties.`
                );
            }
        }
    }

    const chestSpawns = byName.get('chest_spawns');
    if (chestSpawns?.type === 'objectgroup') {
        for (const objectRecord of getObjects(chestSpawns)) {
            const objectId = asInteger(objectRecord.id);
            const props = getPropertyMap(objectRecord.properties);
            requireNonEmptyObjectName(diags, chestSpawns, objectRecord, 'OBJECT_NAME_MISSING');
            requireNonEmptyObjectClass(diags, chestSpawns, objectRecord, 'OBJECT_CLASS_MISSING');
            requireProperty(diags, chestSpawns, objectId, props, 'items', 'CHEST_SPAWN_PROPERTY_MISSING');
        }
    }

    const roaming = byName.get('roaming_areas');
    if (roaming?.type === 'objectgroup') {
        for (const objectRecord of getObjects(roaming)) {
            const objectId = asInteger(objectRecord.id);
            const props = getPropertyMap(objectRecord.properties);
            requireNonEmptyObjectName(diags, roaming, objectRecord, 'OBJECT_NAME_MISSING');
            requireNonEmptyObjectClass(diags, roaming, objectRecord, 'OBJECT_CLASS_MISSING');
            requireProperty(diags, roaming, objectId, props, 'mob_kind', 'ROAMING_PROPERTY_MISSING');
            requireProperty(diags, roaming, objectId, props, 'count', 'ROAMING_PROPERTY_MISSING');
            if (props.has('mob_kind') && !isResolvableMobKindName(props.get('mob_kind'))) {
                pushDiagnostic(
                    diags,
                    'error',
                    'ROAMING_PROPERTY_INVALID',
                    `${formatLayerRef(roaming)} object ${objectId ?? 'no-id'} has invalid mob_kind.`
                );
            }
            if (props.has('count') && !isNumericLike(props.get('count'))) {
                pushDiagnostic(
                    diags,
                    'error',
                    'ROAMING_PROPERTY_INVALID',
                    `${formatLayerRef(roaming)} object ${objectId ?? 'no-id'} has non-numeric count.`
                );
            }
        }
    }

    const musicZones = byName.get('music_zones');
    if (musicZones?.type === 'objectgroup') {
        for (const objectRecord of getObjects(musicZones)) {
            const objectId = asInteger(objectRecord.id);
            const props = getPropertyMap(objectRecord.properties);
            requireNonEmptyObjectName(diags, musicZones, objectRecord, 'OBJECT_NAME_MISSING');
            requireNonEmptyObjectClass(diags, musicZones, objectRecord, 'OBJECT_CLASS_MISSING');
            requireProperty(diags, musicZones, objectId, props, 'track_id', 'MUSIC_PROPERTY_MISSING');
        }
    }

    const checkpoints = byName.get('checkpoints');
    if (checkpoints?.type === 'objectgroup') {
        for (const objectRecord of getObjects(checkpoints)) {
            const objectId = asInteger(objectRecord.id);
            const props = getPropertyMap(objectRecord.properties);
            requireNonEmptyObjectName(diags, checkpoints, objectRecord, 'OBJECT_NAME_MISSING');
            requireNonEmptyObjectClass(diags, checkpoints, objectRecord, 'OBJECT_CLASS_MISSING');
            requireProperty(diags, checkpoints, objectId, props, 'checkpoint_id', 'CHECKPOINT_PROPERTY_MISSING');
            requireProperty(diags, checkpoints, objectId, props, 'spawn', 'CHECKPOINT_PROPERTY_MISSING');
            if (props.has('spawn') && !isBooleanLike(props.get('spawn'))) {
                pushDiagnostic(
                    diags,
                    'error',
                    'CHECKPOINT_PROPERTY_INVALID',
                    `${formatLayerRef(checkpoints)} object ${objectId ?? 'no-id'} has non-boolean spawn.`
                );
            }
        }
    }

    const staticEntities = byName.get('static_entities');
    if (staticEntities?.type === 'objectgroup') {
        for (const objectRecord of getObjects(staticEntities)) {
            const objectId = asInteger(objectRecord.id);
            const props = getPropertyMap(objectRecord.properties);
            requireNonEmptyObjectName(diags, staticEntities, objectRecord, 'OBJECT_NAME_MISSING');
            requireNonEmptyObjectClass(diags, staticEntities, objectRecord, 'OBJECT_CLASS_MISSING');
            const hasEntityKind =
                typeof props.get('entity_kind') === 'string' && String(props.get('entity_kind')).trim().length > 0;
            const hasEntityGid = props.has('entity_gid');
            const hasTileGid = isNumericLike(objectRecord.gid);
            if (!hasEntityKind && !hasEntityGid && !hasTileGid) {
                pushDiagnostic(
                    diags,
                    'error',
                    'STATIC_ENTITY_PROPERTY_MISSING',
                    `${formatLayerRef(staticEntities)} object ${objectId ?? 'no-id'} must define entity_kind, entity_gid, or tile gid.`
                );
            }
            if (hasEntityKind && !isResolvableEntityKindName(props.get('entity_kind'))) {
                pushDiagnostic(
                    diags,
                    'error',
                    'STATIC_ENTITY_PROPERTY_INVALID',
                    `${formatLayerRef(staticEntities)} object ${objectId ?? 'no-id'} has invalid entity_kind.`
                );
            }
            if (hasEntityGid && !isNumericLike(props.get('entity_gid'))) {
                pushDiagnostic(
                    diags,
                    'error',
                    'STATIC_ENTITY_PROPERTY_INVALID',
                    `${formatLayerRef(staticEntities)} object ${objectId ?? 'no-id'} has non-numeric entity_gid.`
                );
            }
        }
    }

    const resourceNodes = byName.get('resource_nodes');
    if (resourceNodes?.type === 'objectgroup') {
        for (const objectRecord of getObjects(resourceNodes)) {
            const objectId = asInteger(objectRecord.id);
            const props = getPropertyMap(objectRecord.properties);
            requireNonEmptyObjectName(diags, resourceNodes, objectRecord, 'OBJECT_NAME_MISSING');
            requireNonEmptyObjectClass(diags, resourceNodes, objectRecord, 'OBJECT_CLASS_MISSING');
            requireProperty(diags, resourceNodes, objectId, props, 'resource_gid', 'RESOURCE_NODE_PROPERTY_MISSING');
            if (props.has('resource_gid') && !isNumericLike(props.get('resource_gid'))) {
                pushDiagnostic(
                    diags,
                    'error',
                    'RESOURCE_NODE_PROPERTY_INVALID',
                    `${formatLayerRef(resourceNodes)} object ${objectId ?? 'no-id'} has non-numeric resource_gid.`
                );
            }
        }
    }
}

function diagnosticsSummary(diags: ReadonlyArray<Diagnostic>): { errors: number; warns: number; infos: number } {
    let errors = 0;
    let warns = 0;
    let infos = 0;
    for (const diag of diags) {
        if (diag.level === 'error') {
            errors += 1;
        } else if (diag.level === 'warn') {
            warns += 1;
        } else {
            infos += 1;
        }
    }
    return { errors, warns, infos };
}

function printUsage(): never {
    console.log('Usage: bun tools/content/world-map-validator.ts [--map <path>] [--profile legacy|target] [--json] [--fail-on-warn]');
    process.exit(0);
}

async function main(): Promise<void> {
    const parsedArgs = parseCliArgs(
        process.argv.slice(2),
        [
            { key: 'map', kind: 'string', defaultValue: 'assets/maps/tiled/world.json' },
            { key: 'profile', kind: 'string', defaultValue: 'legacy' },
            { key: 'json', kind: 'boolean', defaultValue: false },
            { key: 'fail-on-warn', kind: 'boolean', defaultValue: false },
        ],
        { onHelp: printUsage }
    );

    const mapPath = String(parsedArgs.map ?? 'assets/maps/tiled/world.json');
    const profile = parseProfile(String(parsedArgs.profile ?? 'legacy'));
    const jsonOutput = Boolean(parsedArgs.json);
    const failOnWarn = Boolean(parsedArgs['fail-on-warn']);

    const diagnostics: Diagnostic[] = [];
    const map = await loadMap(mapPath, diagnostics);
    if (!map) {
        const summary = diagnosticsSummary(diagnostics);
        if (jsonOutput) {
            console.log(JSON.stringify({ map: mapPath, profile, summary, diagnostics }, null, 2));
        } else {
            for (const diag of diagnostics) {
                console.log(`[${diag.level.toUpperCase()}] ${diag.code}: ${diag.message}`);
            }
            console.log(`Summary: ${summary.errors} errors, ${summary.warns} warnings, ${summary.infos} infos`);
        }
        process.exitCode = 1;
        return;
    }

    const layers = buildLayerContexts(map, diagnostics);
    checkLayerPayloads(map, layers, diagnostics);
    checkLayerNaming(profile, layers, diagnostics);
    checkEmptyPropertyNames(profile, map, layers, diagnostics);
    checkObjectBoundsAndDuplicates(profile, map, layers, diagnostics);
    checkPortalAuthority(profile, map, layers, diagnostics);

    if (profile === 'legacy') {
        checkLegacyHints(layers, diagnostics);
    }

    if (profile === 'target') {
        checkTargetLayerContract(layers, diagnostics);
        checkTargetObjectContracts(layers, diagnostics);
    }

    const summary = diagnosticsSummary(diagnostics);
    if (jsonOutput) {
        console.log(
            JSON.stringify(
                {
                    map: relPath(map.path),
                    profile,
                    summary,
                    diagnostics,
                },
                null,
                2
            )
        );
    } else {
        console.log(`Map: ${relPath(map.path)}`);
        console.log(`Profile: ${profile}`);
        console.log(`Layers: ${layers.length}`);
        for (const diag of diagnostics) {
            console.log(`[${diag.level.toUpperCase()}] ${diag.code}: ${diag.message}`);
        }
        console.log(`Summary: ${summary.errors} errors, ${summary.warns} warnings, ${summary.infos} infos`);
    }

    if (summary.errors > 0 || (failOnWarn && summary.warns > 0)) {
        process.exitCode = 1;
    } else {
        process.exitCode = 0;
    }
}

main().catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    console.error(message);
    process.exit(1);
});
