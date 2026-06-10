import processMap from './processmap';
import {
    isMapGraph,
    mapGraphDoorRefKey,
    validateMapGraph,
    type MapGraph,
    type MapGraphDoor,
    type MapGraphEdge,
    type MapGraphMap,
} from './map-graph';

type UnknownRecord = Record<string, unknown>;

type TiledProperty = Readonly<{
    name: string;
    value: unknown;
}>;

type TiledDoorObject = Readonly<{
    id?: number;
    x?: number;
    y?: number;
    properties?: TiledProperty[];
}>;

type DoorGraphExtractionResult = Readonly<{
    doors: ReadonlyArray<MapGraphDoor>;
    edges: ReadonlyArray<MapGraphEdge>;
    explicitDoorIds: ReadonlySet<string>;
    oneWayEdgeKeys: ReadonlySet<string>;
    errors: ReadonlyArray<string>;
}>;

export type MapPackBuildMapInput = Readonly<{
    id: string;
    tiled: unknown;
    sourcePath?: string;
}>;

export type MapPackBuildInput = Readonly<{
    maps: ReadonlyArray<MapPackBuildMapInput>;
    edges?: ReadonlyArray<MapGraphEdge>;
    allowMissingTargetMaps?: boolean;
}>;

export type MapPackCompiledMap = Readonly<{
    id: string;
    sourcePath?: string;
    client: Record<string, unknown>;
    server: Record<string, unknown>;
}>;

export type MapPack = Readonly<{
    schemaVersion: 2;
    maps: ReadonlyArray<MapPackCompiledMap>;
    graph: MapGraph;
}>;

function asRecord(value: unknown): UnknownRecord | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    return value as UnknownRecord;
}

function asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? (value as unknown[]) : [];
}

function asNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asNonEmptyString(value: unknown): string | null {
    if (typeof value !== 'string' || value.trim().length === 0) {
        return null;
    }
    return value;
}

function isTruthyProperty(value: unknown): boolean {
    if (value === true || value === 1) {
        return true;
    }
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        return normalized === 'true' || normalized === '1' || normalized === 'yes';
    }
    return false;
}

function flattenLayersForExtraction(
    layers: unknown[],
    state: Readonly<{ visible: boolean; offsetX: number; offsetY: number }> = { visible: true, offsetX: 0, offsetY: 0 }
): UnknownRecord[] {
    const flattened: UnknownRecord[] = [];
    for (let i = 0; i < layers.length; i += 1) {
        const layer = asRecord(layers[i]);
        if (!layer) {
            continue;
        }
        const type = asNonEmptyString(layer.type);
        const visible = layer.visible !== false && state.visible;
        const ownOffsetX = asNumber(layer.offsetx) ?? 0;
        const ownOffsetY = asNumber(layer.offsety) ?? 0;
        const offsetX = state.offsetX + ownOffsetX;
        const offsetY = state.offsetY + ownOffsetY;
        if (type === 'group') {
            flattened.push(...flattenLayersForExtraction(asArray(layer.layers), { visible, offsetX, offsetY }));
            continue;
        }
        if (type === 'objectgroup') {
            flattened.push({
                ...layer,
                visible,
                offsetx: 0,
                offsety: 0,
                objects: asArray(layer.objects)
                    .map((entry) => asRecord(entry))
                    .filter((entry): entry is UnknownRecord => entry !== null)
                    .map((objectRecord) => ({
                        ...objectRecord,
                        x: (asNumber(objectRecord.x) ?? 0) + offsetX,
                        y: (asNumber(objectRecord.y) ?? 0) + offsetY,
                    })),
            });
            continue;
        }
        flattened.push({
            ...layer,
            visible,
            offsetx: 0,
            offsety: 0,
        });
    }
    return flattened;
}

function compareStrings(a: string, b: string): number {
    return a.localeCompare(b);
}

function hasRenderableTerrainTiles(client: Record<string, unknown>): boolean {
    const fields: unknown[] = [client.data, client.foreground];
    for (let fieldIndex = 0; fieldIndex < fields.length; fieldIndex += 1) {
        const data = asArray(fields[fieldIndex]);
        for (let i = 0; i < data.length; i += 1) {
            const cell = data[i];
            if (Array.isArray(cell)) {
                for (let j = 0; j < cell.length; j += 1) {
                    const tileId = asNumber(cell[j]);
                    if (tileId !== null && tileId > 0) {
                        return true;
                    }
                }
                continue;
            }
            const tileId = asNumber(cell);
            if (tileId !== null && tileId > 0) {
                return true;
            }
        }
    }
    return false;
}

function requirePositiveInteger(value: unknown, label: string): number {
    if (!Number.isInteger(value) || (value as number) <= 0) {
        throw new Error(`Invalid ${label}: expected positive integer.`);
    }
    return value as number;
}

function normalizeSourcePathForPack(value: string | undefined): string | undefined {
    if (!value) {
        return undefined;
    }
    return value.replace(/\\/g, '/');
}

function extractDoorObjects(tiled: unknown): ReadonlyArray<TiledDoorObject> {
    const root = asRecord(tiled);
    if (!root) {
        return [];
    }
    const out: TiledDoorObject[] = [];
    const layers = flattenLayersForExtraction(asArray(root.layers));
    for (let i = 0; i < layers.length; i += 1) {
        const layer = asRecord(layers[i]);
        if (!layer) {
            continue;
        }
        if (layer.type !== 'objectgroup' || layer.name !== 'doors') {
            continue;
        }
        out.push(...(asArray(layer.objects) as TiledDoorObject[]));
    }
    return out;
}

function doorPropertyMap(object: TiledDoorObject): Readonly<Record<string, unknown>> {
    const out: Record<string, unknown> = {};
    const props = asArray(object.properties);
    for (let i = 0; i < props.length; i += 1) {
        const prop = asRecord(props[i]);
        if (!prop) {
            continue;
        }
        const name = asNonEmptyString(prop.name);
        if (!name) {
            continue;
        }
        out[name] = prop.value;
    }
    return out;
}

function resolveDoorId(object: TiledDoorObject, index: number): Readonly<{ id: string; explicit: boolean }> {
    const properties = doorPropertyMap(object);
    const explicitId = asNonEmptyString(properties.door_id) ?? asNonEmptyString(properties.id);
    if (explicitId) {
        return { id: explicitId, explicit: true };
    }
    if (Number.isInteger(object.id)) {
        return { id: String(object.id), explicit: false };
    }
    return { id: `door_${index + 1}`, explicit: false };
}

function extractDoorGraphEntries(mapId: string, tiled: unknown, tileSize: number): DoorGraphExtractionResult {
    const doors = extractDoorObjects(tiled);
    const out: MapGraphDoor[] = [];
    const edges: MapGraphEdge[] = [];
    const explicitDoorIds = new Set<string>();
    const oneWayEdgeKeys = new Set<string>();
    const errors: string[] = [];
    for (let i = 0; i < doors.length; i += 1) {
        const door = doors[i];
        if (!door) {
            continue;
        }
        const properties = doorPropertyMap(door);
        const resolvedDoorId = resolveDoorId(door, i);
        if (resolvedDoorId.explicit) {
            explicitDoorIds.add(resolvedDoorId.id);
        }

        const targetMap = asNonEmptyString(properties.target_map);
        const targetDoor = asNonEmptyString(properties.target_door);
        const hasTargetMap = !!targetMap;
        const hasTargetDoor = !!targetDoor;
        const orientation = asNonEmptyString(properties.orientation);
        const isWorldInteriorEntryDoor = mapId.startsWith('world_') && orientation === 'u';
        if (targetMap === 'world') {
            errors.push(
                `Invalid map "${mapId}" door "${resolvedDoorId.id}": target_map "world" is not supported; use "world_01".`
            );
        }
        if (hasTargetMap !== hasTargetDoor) {
            errors.push(
                `Invalid map "${mapId}" door "${resolvedDoorId.id}": "target_map" and "target_door" must be provided together.`
            );
        }
        if (isWorldInteriorEntryDoor && (!hasTargetMap || !hasTargetDoor)) {
            errors.push(
                `Invalid map "${mapId}" door "${resolvedDoorId.id}": world interior-entry doors (orientation=u) require explicit "target_map" and "target_door".`
            );
        }
        if (hasTargetMap && hasTargetDoor) {
            if (!resolvedDoorId.explicit) {
                errors.push(`Invalid map "${mapId}" door "${resolvedDoorId.id}": graph-linked doors require explicit "door_id" property.`);
            }
            if (!orientation) {
                errors.push(
                    `Invalid map "${mapId}" door "${resolvedDoorId.id}": graph-linked doors require explicit "orientation" property.`
                );
            }
            if (properties.tx !== undefined || properties.ty !== undefined) {
                errors.push(
                    `Invalid map "${mapId}" door "${resolvedDoorId.id}": graph-linked doors must not declare raw "tx" or "ty".`
                );
            }
            const edge = {
                from: { mapId, doorId: resolvedDoorId.id },
                to: { mapId: targetMap, doorId: targetDoor },
            };
            edges.push(edge);
            if (isTruthyProperty(properties.one_way)) {
                oneWayEdgeKeys.add(`${mapGraphDoorRefKey(edge.from)}->${mapGraphDoorRefKey(edge.to)}`);
            }
        }

        const x = asNumber(door.x);
        const y = asNumber(door.y);
        if (x === null || y === null) {
            continue;
        }
        out.push({
            id: resolvedDoorId.id,
            x: Math.floor(x / tileSize),
            y: Math.floor(y / tileSize),
        });
    }
    out.sort((a, b) => compareStrings(a.id, b.id));
    return {
        doors: out,
        edges,
        explicitDoorIds,
        oneWayEdgeKeys,
        errors,
    };
}

function findMissingReverseLinks(edges: ReadonlyArray<MapGraphEdge>, oneWayEdgeKeys: ReadonlySet<string>): ReadonlyArray<string> {
    const edgeKeys = new Set(edges.map((edge) => `${mapGraphDoorRefKey(edge.from)}->${mapGraphDoorRefKey(edge.to)}`));
    const errors: string[] = [];
    for (let i = 0; i < edges.length; i += 1) {
        const edge = edges[i];
        if (!edge) {
            continue;
        }
        const key = `${mapGraphDoorRefKey(edge.from)}->${mapGraphDoorRefKey(edge.to)}`;
        const reverseKey = `${mapGraphDoorRefKey(edge.to)}->${mapGraphDoorRefKey(edge.from)}`;
        if (!edgeKeys.has(reverseKey) && !oneWayEdgeKeys.has(key)) {
            errors.push(
                `Invalid map pack graph: reverse link missing for "${mapGraphDoorRefKey(edge.from)}" -> "${mapGraphDoorRefKey(edge.to)}".`
            );
        }
    }
    return errors;
}

function findEdgesWithImplicitDoorIds(
    edges: ReadonlyArray<MapGraphEdge>,
    explicitDoorRefs: ReadonlySet<string>
): ReadonlyArray<string> {
    const errors: string[] = [];
    const missingRefs = new Set<string>();
    for (let i = 0; i < edges.length; i += 1) {
        const edge = edges[i];
        if (!edge) {
            continue;
        }
        const refs = [edge.from, edge.to];
        for (let j = 0; j < refs.length; j += 1) {
            const ref = refs[j];
            if (!ref) {
                continue;
            }
            const key = mapGraphDoorRefKey(ref);
            if (explicitDoorRefs.has(key) || missingRefs.has(key)) {
                continue;
            }
            missingRefs.add(key);
            errors.push(`Invalid map pack graph: edge endpoint "${key}" must reference a door with explicit "door_id" property.`);
        }
    }
    return errors;
}

function sortEdgesStable(edges: ReadonlyArray<MapGraphEdge>): MapGraphEdge[] {
    return [...edges].sort((a, b) => {
        const aKey = `${mapGraphDoorRefKey(a.from)}->${mapGraphDoorRefKey(a.to)}`;
        const bKey = `${mapGraphDoorRefKey(b.from)}->${mapGraphDoorRefKey(b.to)}`;
        return compareStrings(aKey, bKey);
    });
}

function indexDoorRecordsByDoorId(mapPayload: Record<string, unknown>): Map<string, Record<string, unknown>> {
    const out = new Map<string, Record<string, unknown>>();
    const doors = asArray(mapPayload.doors);
    for (let i = 0; i < doors.length; i += 1) {
        const door = asRecord(doors[i]);
        if (!door) {
            continue;
        }
        const id = asNonEmptyString(door.tdoor_id);
        if (!id) {
            continue;
        }
        out.set(id, door);
    }
    return out;
}

function setExportedDoorDestinationCoords({
    door,
    toX,
    toY,
}: {
    door: Record<string, unknown>;
    toX: number;
    toY: number;
}): void {
    // `processMap` exports door-object properties under `t*`, where `x/y` become `tx/ty` and represent the
    // destination tile coordinates. For graph-linked doors, the authoritative destination is the graph's
    // destination door coordinate; normalize to that so client/server validation stays consistent.
    door.tx = toX;
    door.ty = toY;
}

function tileIndex(x: number, y: number, width: number): number {
    return y * width + x;
}

function asNumberArray(value: unknown): number[] {
    return Array.isArray(value) ? (value.filter((entry) => typeof entry === 'number' && Number.isFinite(entry)) as number[]) : [];
}

function ensureGraphDoorEgress({
    mapId,
    door,
    clientPayload,
    serverPayload,
}: {
    mapId: string;
    door: MapGraphDoor;
    clientPayload: Record<string, unknown>;
    serverPayload: Record<string, unknown>;
}): string | null {
    const width = requirePositiveInteger(serverPayload.width, `processed map "${mapId}" width`);
    const height = requirePositiveInteger(serverPayload.height, `processed map "${mapId}" height`);
    const x = door.x;
    const y = door.y;
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= width || y >= height) {
        return `Invalid map "${mapId}" door "${door.id}": door position out of bounds.`;
    }

    const clientCollisions = asNumberArray(clientPayload.collisions);
    const clientBlocking = asNumberArray(clientPayload.blocking);
    const serverCollisions = asNumberArray(serverPayload.collisions);

    const blocked = new Uint8Array(width * height);
    for (let i = 0; i < serverCollisions.length; i += 1) {
        const idx = serverCollisions[i] ?? -1;
        if (idx >= 0 && idx < blocked.length) {
            blocked[idx] = 1;
        }
    }

    const blockCarveable = new Uint8Array(width * height);
    for (let i = 0; i < clientBlocking.length; i += 1) {
        const idx = clientBlocking[i] ?? -1;
        if (idx >= 0 && idx < blockCarveable.length) {
            blockCarveable[idx] = 1;
        }
    }
    for (let i = 0; i < clientCollisions.length; i += 1) {
        const idx = clientCollisions[i] ?? -1;
        if (idx >= 0 && idx < blockCarveable.length) {
            // Never carve tileset-colliding geometry.
            blockCarveable[idx] = 0;
        }
    }

    const doorIdx = tileIndex(x, y, width);
    if (blocked[doorIdx] === 1) {
        return `Invalid map "${mapId}" door "${door.id}": door tile is colliding.`;
    }

    const neighbors: ReadonlyArray<readonly [number, number]> = [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
    ];
    for (let i = 0; i < neighbors.length; i += 1) {
        const [dx, dy] = neighbors[i] ?? [0, 0];
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
            continue;
        }
        if (blocked[tileIndex(nx, ny, width)] === 0) {
            return null;
        }
    }

    // Door tile has no non-colliding adjacent tile. Attempt a minimal carve from the authored blocking layer:
    // if the doorway is sealed by 1+ tiles of blocking, carve a straight corridor out of carveable blocking
    // until we connect to an existing walkable tile.
    const maxCarveSteps = 8;
    let carvedIndices: number[] | null = null;
    for (let i = 0; i < neighbors.length; i += 1) {
        const [dx, dy] = neighbors[i] ?? [0, 0];
        const candidate: number[] = [];
        for (let step = 1; step <= maxCarveSteps; step += 1) {
            const nx = x + dx * step;
            const ny = y + dy * step;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
                break;
            }
            const idx = tileIndex(nx, ny, width);
            if (blocked[idx] === 0) {
                if (candidate.length > 0) {
                    carvedIndices = candidate;
                }
                break;
            }
            if (blockCarveable[idx] !== 1) {
                break;
            }
            candidate.push(idx);
        }
        if (carvedIndices) {
            break;
        }
    }
    if (!carvedIndices || carvedIndices.length === 0) {
        return `Invalid map "${mapId}" door "${door.id}": trapped door has no carveable blocking neighbor.`;
    }

    // Apply carve to both payloads (client uses `blocking`, server uses `collisions` for authority).
    const carvedSet = new Set(carvedIndices);
    clientPayload.blocking = clientBlocking.filter((idx) => !carvedSet.has(idx));
    serverPayload.collisions = serverCollisions.filter((idx) => !carvedSet.has(idx));
    return null;
}

export function compileMapPack(input: MapPackBuildInput): MapPack {
    const knownMapIds = new Set<string>();
    const compiledMaps: MapPackCompiledMap[] = [];
    const graphMaps: MapGraphMap[] = [];
    const derivedEdges: MapGraphEdge[] = [];
    const authoringErrors: string[] = [];
    const explicitDoorRefs = new Set<string>();
    const oneWayEdgeKeys = new Set<string>();
    const mapHasRenderableTerrainById = new Map<string, boolean>();

    const sortedInputs = [...input.maps].sort((a, b) => compareStrings(a.id, b.id));
    for (let i = 0; i < sortedInputs.length; i += 1) {
        const source = sortedInputs[i];
        if (!source) {
            continue;
        }
        const mapId = asNonEmptyString(source.id);
        if (!mapId) {
            throw new Error(`Invalid map pack input: maps[${i}].id must be a non-empty string.`);
        }
        if (knownMapIds.has(mapId)) {
            throw new Error(`Invalid map pack input: duplicate map id "${mapId}".`);
        }
        knownMapIds.add(mapId);

        const sourceRoot = asRecord(source.tiled);
        const sourceTileSize = requirePositiveInteger(sourceRoot?.tilewidth, `source map "${mapId}" tilewidth`);
        const graphDoorExtraction = extractDoorGraphEntries(mapId, source.tiled, sourceTileSize);

        const client = processMap(source.tiled as Parameters<typeof processMap>[0], { mode: 'client', quiet: true }) as Record<
            string,
            unknown
        >;
        const server = processMap(source.tiled as Parameters<typeof processMap>[0], { mode: 'server', quiet: true }) as Record<
            string,
            unknown
        >;
        const width = requirePositiveInteger(server.width, `processed map "${mapId}" width`);
        const height = requirePositiveInteger(server.height, `processed map "${mapId}" height`);
        requirePositiveInteger(server.tilesize, `processed map "${mapId}" tilesize`);
        authoringErrors.push(...graphDoorExtraction.errors);
        const explicitDoorIds = [...graphDoorExtraction.explicitDoorIds];
        for (let doorIndex = 0; doorIndex < explicitDoorIds.length; doorIndex += 1) {
            const doorId = explicitDoorIds[doorIndex];
            if (!doorId) {
                continue;
            }
            explicitDoorRefs.add(mapGraphDoorRefKey({ mapId, doorId }));
        }
        graphMaps.push({
            id: mapId,
            width,
            height,
            doors: graphDoorExtraction.doors,
        });

        const mappedSourcePath = normalizeSourcePathForPack(source.sourcePath);
        compiledMaps.push({
            id: mapId,
            sourcePath: mappedSourcePath,
            client,
            server,
        });
        mapHasRenderableTerrainById.set(mapId, hasRenderableTerrainTiles(client));

        derivedEdges.push(...graphDoorExtraction.edges);
        for (const edgeKey of graphDoorExtraction.oneWayEdgeKeys) {
            oneWayEdgeKeys.add(edgeKey);
        }
    }

    const edges = sortEdgesStable([...(input.edges ?? []), ...derivedEdges]);
    const allowMissingTargetMaps = input.allowMissingTargetMaps === true;
    const filteredEdges = allowMissingTargetMaps
        ? edges.filter((edge) => knownMapIds.has(edge.from.mapId) && knownMapIds.has(edge.to.mapId))
        : edges;
    const graph: MapGraph = {
        maps: graphMaps.sort((a, b) => compareStrings(a.id, b.id)),
        edges: filteredEdges,
    };
    const validation = validateMapGraph(graph);
    if (!validation.ok) {
        authoringErrors.push(...validation.errors);
    } else {
        authoringErrors.push(...findEdgesWithImplicitDoorIds(graph.edges, explicitDoorRefs));
        authoringErrors.push(...findMissingReverseLinks(graph.edges, oneWayEdgeKeys));
        const transitionDestinations = new Set<string>();
        for (let edgeIndex = 0; edgeIndex < graph.edges.length; edgeIndex += 1) {
            const edge = graph.edges[edgeIndex];
            if (!edge) {
                continue;
            }
            if (edge.from.mapId !== edge.to.mapId) {
                transitionDestinations.add(edge.to.mapId);
            }
        }
        for (const mapId of transitionDestinations) {
            if (!mapHasRenderableTerrainById.get(mapId)) {
                authoringErrors.push(
                    `Invalid map "${mapId}": cross-map transition destination must include at least one non-zero renderable tile.`
                );
            }
        }
    }
    if (authoringErrors.length > 0) {
        throw new Error(`Invalid map pack graph:\n- ${authoringErrors.join('\n- ')}`);
    }

    // Normalize exported door destination coords for graph-linked transitions.
    const doorCoordsByRefKey = new Map<string, Readonly<{ x: number; y: number }>>();
    for (let i = 0; i < graph.maps.length; i += 1) {
        const map = graph.maps[i];
        if (!map) {
            continue;
        }
        for (let j = 0; j < map.doors.length; j += 1) {
            const door = map.doors[j];
            if (!door) {
                continue;
            }
            doorCoordsByRefKey.set(mapGraphDoorRefKey({ mapId: map.id, doorId: door.id }), { x: door.x, y: door.y });
        }
    }

    const compiledById = new Map<string, MapPackCompiledMap>();
    for (let i = 0; i < compiledMaps.length; i += 1) {
        const entry = compiledMaps[i];
        if (entry) {
            compiledById.set(entry.id, entry);
        }
    }

    for (let i = 0; i < graph.edges.length; i += 1) {
        const edge = graph.edges[i];
        if (!edge) {
            continue;
        }
        const destCoords = doorCoordsByRefKey.get(mapGraphDoorRefKey(edge.to));
        if (!destCoords) {
            continue;
        }
        const sourceMap = compiledById.get(edge.from.mapId);
        if (!sourceMap) {
            continue;
        }

        const clientDoors = indexDoorRecordsByDoorId(sourceMap.client);
        const serverDoors = indexDoorRecordsByDoorId(sourceMap.server);
        const sourceDoorClient = clientDoors.get(edge.from.doorId) ?? null;
        const sourceDoorServer = serverDoors.get(edge.from.doorId) ?? null;
        if (sourceDoorClient) {
            setExportedDoorDestinationCoords({ door: sourceDoorClient, toX: destCoords.x, toY: destCoords.y });
        }
        if (sourceDoorServer) {
            setExportedDoorDestinationCoords({ door: sourceDoorServer, toX: destCoords.x, toY: destCoords.y });
        }
    }

    // Ensure graph door destinations are not immediate soft-locks (e.g. teleported onto an isolated tile).
    // We keep this conservative: only carve from the authored `blocking` layer, never from tileset-collision.
    const egressErrors: string[] = [];
    const doorRefKeysNeedingEgress = new Set<string>();
    for (let i = 0; i < graph.edges.length; i += 1) {
        const edge = graph.edges[i];
        if (edge) {
            doorRefKeysNeedingEgress.add(mapGraphDoorRefKey(edge.to));
        }
    }
    for (let i = 0; i < graph.maps.length; i += 1) {
        const map = graph.maps[i];
        if (!map) {
            continue;
        }
        const compiled = compiledById.get(map.id);
        if (!compiled) {
            continue;
        }
        for (let j = 0; j < map.doors.length; j += 1) {
            const door = map.doors[j];
            if (!door) {
                continue;
            }
            if (!doorRefKeysNeedingEgress.has(mapGraphDoorRefKey({ mapId: map.id, doorId: door.id }))) {
                continue;
            }
            const err = ensureGraphDoorEgress({
                mapId: map.id,
                door,
                clientPayload: compiled.client,
                serverPayload: compiled.server,
            });
            if (err) {
                egressErrors.push(err);
            }
        }
    }
    if (egressErrors.length > 0) {
        throw new Error(`Invalid map pack egress:\n- ${egressErrors.join('\n- ')}`);
    }

    return {
        schemaVersion: 2,
        maps: compiledMaps,
        graph,
    };
}

export function renderMapPackJson(pack: MapPack): string {
    return `${JSON.stringify(pack, null, 2)}\n`;
}

function hasSchemaVersionTwo(value: unknown): value is 2 {
    return value === 2;
}

export function isMapPack(value: unknown): value is MapPack {
    const root = asRecord(value);
    if (!root || !hasSchemaVersionTwo(root.schemaVersion) || !Array.isArray(root.maps) || !isMapGraph(root.graph)) {
        return false;
    }

    for (let i = 0; i < root.maps.length; i += 1) {
        const mapEntry = asRecord(root.maps[i]);
        if (!mapEntry || !asNonEmptyString(mapEntry.id) || !asRecord(mapEntry.client) || !asRecord(mapEntry.server)) {
            return false;
        }
    }

    return true;
}
