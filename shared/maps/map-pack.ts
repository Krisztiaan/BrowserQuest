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
}>;

export type MapPackCompiledMap = Readonly<{
    id: string;
    sourcePath?: string;
    client: Record<string, unknown>;
    server: Record<string, unknown>;
}>;

export type MapPack = Readonly<{
    schemaVersion: 1;
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

function compareStrings(a: string, b: string): number {
    return a.localeCompare(b);
}

function hasRenderableTerrainTiles(client: Record<string, unknown>): boolean {
    const data = asArray(client.data);
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
    const layers = asArray(root.layers);
    for (let i = 0; i < layers.length; i += 1) {
        const layer = asRecord(layers[i]);
        if (!layer) {
            continue;
        }
        if (layer.type !== 'objectgroup' || layer.name !== 'doors') {
            continue;
        }
        return asArray(layer.objects) as TiledDoorObject[];
    }
    return [];
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
        const orientation = asNonEmptyString(properties.o);
        const isWorldInteriorEntryDoor = mapId === 'world' && orientation === 'u';
        if (hasTargetMap !== hasTargetDoor) {
            errors.push(
                `Invalid map "${mapId}" door "${resolvedDoorId.id}": "target_map" and "target_door" must be provided together.`
            );
        }
        if (isWorldInteriorEntryDoor && (!hasTargetMap || !hasTargetDoor)) {
            errors.push(
                `Invalid map "${mapId}" door "${resolvedDoorId.id}": world interior-entry doors (o=u) require explicit "target_map" and "target_door".`
            );
        }
        if (hasTargetMap && hasTargetDoor) {
            if (!resolvedDoorId.explicit) {
                errors.push(`Invalid map "${mapId}" door "${resolvedDoorId.id}": graph-linked doors require explicit "door_id" property.`);
            }
            edges.push({
                from: { mapId, doorId: resolvedDoorId.id },
                to: { mapId: targetMap, doorId: targetDoor },
            });
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
        errors,
    };
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

export function compileMapPack(input: MapPackBuildInput): MapPack {
    const knownMapIds = new Set<string>();
    const compiledMaps: MapPackCompiledMap[] = [];
    const graphMaps: MapGraphMap[] = [];
    const derivedEdges: MapGraphEdge[] = [];
    const authoringErrors: string[] = [];
    const explicitDoorRefs = new Set<string>();
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
        const tileSize = requirePositiveInteger(server.tilesize, `processed map "${mapId}" tilesize`);

        const graphDoorExtraction = extractDoorGraphEntries(mapId, source.tiled, tileSize);
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
    }

    const edges = sortEdgesStable([...(input.edges ?? []), ...derivedEdges]);
    const graph: MapGraph = {
        maps: graphMaps.sort((a, b) => compareStrings(a.id, b.id)),
        edges,
    };
    const validation = validateMapGraph(graph);
    if (!validation.ok) {
        authoringErrors.push(...validation.errors);
    } else {
        authoringErrors.push(...findEdgesWithImplicitDoorIds(graph.edges, explicitDoorRefs));
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

    return {
        schemaVersion: 1,
        maps: compiledMaps,
        graph,
    };
}

export function renderMapPackJson(pack: MapPack): string {
    return `${JSON.stringify(pack, null, 2)}\n`;
}

function hasSchemaVersionOne(value: unknown): value is 1 {
    return value === 1;
}

export function isMapPack(value: unknown): value is MapPack {
    const root = asRecord(value);
    if (!root || !hasSchemaVersionOne(root.schemaVersion) || !Array.isArray(root.maps) || !isMapGraph(root.graph)) {
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
