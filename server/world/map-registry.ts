import type { MapGraph, MapGraphDoorRef } from '../../shared/maps/map-graph';
import { isMapGraph, mapGraphDoorRefKey } from '../../shared/maps/map-graph';
import ServerMap from '../map';

type DoorTeleportDestination = Readonly<{ toMapId: string; to: Readonly<{ x: number; y: number }> }>;
type DoorCoords = Readonly<{ mapId: string; x: number; y: number }>;
type ServerMapRecord = Record<string, unknown>;

function mapTileDoorKey(mapId: string, x: number, y: number): string {
    return `${mapId}@${x},${y}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    return value as Record<string, unknown>;
}

function asNonEmptyString(value: unknown): string | null {
    if (typeof value !== 'string' || value.trim().length === 0) {
        return null;
    }
    return value;
}

function asFiniteNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function createMapFromServerPayload(serverPayload: ServerMapRecord): ServerMap {
    const map = new ServerMap();
    map.initMap(serverPayload as never);
    map.generateCollisionGrid();
    return map;
}

export class WorldMapRegistry {
    readonly defaultMapId: string;
    readonly graph: MapGraph;
    readonly #mapsById: Map<string, ServerMap>;
    readonly #doorRefByTileKey: Map<string, MapGraphDoorRef>;
    readonly #doorCoordsByRefKey: Map<string, DoorCoords>;
    readonly #edgeTargetBySourceRefKey: Map<string, MapGraphDoorRef>;

    constructor({
        defaultMapId,
        graph,
        mapsById,
    }: {
        defaultMapId: string;
        graph: MapGraph;
        mapsById: Map<string, ServerMap>;
    }) {
        this.defaultMapId = defaultMapId;
        this.graph = graph;
        this.#mapsById = mapsById;
        this.#doorRefByTileKey = new Map();
        this.#doorCoordsByRefKey = new Map();
        this.#edgeTargetBySourceRefKey = new Map();

        for (let mapIndex = 0; mapIndex < graph.maps.length; mapIndex += 1) {
            const map = graph.maps[mapIndex];
            if (!map) {
                continue;
            }
            for (let doorIndex = 0; doorIndex < map.doors.length; doorIndex += 1) {
                const door = map.doors[doorIndex];
                if (!door) {
                    continue;
                }
                const ref = { mapId: map.id, doorId: door.id } satisfies MapGraphDoorRef;
                const refKey = mapGraphDoorRefKey(ref);
                this.#doorCoordsByRefKey.set(refKey, { mapId: map.id, x: door.x, y: door.y });
                this.#doorRefByTileKey.set(mapTileDoorKey(map.id, door.x, door.y), ref);
            }
        }

        for (let edgeIndex = 0; edgeIndex < graph.edges.length; edgeIndex += 1) {
            const edge = graph.edges[edgeIndex];
            if (!edge) {
                continue;
            }
            const sourceKey = mapGraphDoorRefKey(edge.from);
            if (!this.#edgeTargetBySourceRefKey.has(sourceKey)) {
                this.#edgeTargetBySourceRefKey.set(sourceKey, edge.to);
            }
        }

        for (const [mapId, map] of this.#mapsById.entries()) {
            const mapDoors = Array.isArray((map as unknown as { doors?: unknown }).doors)
                ? ((map as unknown as { doors?: unknown[] }).doors ?? [])
                : [];
            for (let i = 0; i < mapDoors.length; i += 1) {
                const door = asRecord(mapDoors[i]);
                if (!door) {
                    continue;
                }
                const sourceX = asFiniteNumber(door.x);
                const sourceY = asFiniteNumber(door.y);
                const targetX = asFiniteNumber(door.tx);
                const targetY = asFiniteNumber(door.ty);
                if (sourceX === null || sourceY === null || targetX === null || targetY === null) {
                    continue;
                }

                const sourceRef = this.#doorRefByTileKey.get(mapTileDoorKey(mapId, sourceX, sourceY));
                if (!sourceRef) {
                    continue;
                }
                const sourceRefKey = mapGraphDoorRefKey(sourceRef);
                if (this.#edgeTargetBySourceRefKey.has(sourceRefKey)) {
                    continue;
                }

                let targetRef = this.#doorRefByTileKey.get(mapTileDoorKey(mapId, targetX, targetY));
                if (!targetRef) {
                    targetRef = { mapId, doorId: `__coord_${targetX}_${targetY}` } satisfies MapGraphDoorRef;
                    const targetRefKey = mapGraphDoorRefKey(targetRef);
                    if (!this.#doorCoordsByRefKey.has(targetRefKey)) {
                        this.#doorCoordsByRefKey.set(targetRefKey, { mapId, x: targetX, y: targetY });
                    }
                }
                this.#edgeTargetBySourceRefKey.set(sourceRefKey, targetRef);
            }
        }
    }

    getDefaultMap(): ServerMap {
        const map = this.#mapsById.get(this.defaultMapId);
        if (!map) {
            throw new Error(`Missing default map "${this.defaultMapId}" in registry.`);
        }
        return map;
    }

    getMapById(mapId: string): ServerMap | null {
        return this.#mapsById.get(mapId) ?? null;
    }

    forEachMap(callback: (mapId: string, map: ServerMap) => void): void {
        for (const [mapId, map] of this.#mapsById.entries()) {
            callback(mapId, map);
        }
    }

    isValidPosition(mapId: string, x: number, y: number): boolean {
        const map = this.getMapById(mapId);
        return Boolean(
            map
            && typeof x === 'number'
            && typeof y === 'number'
            && Number.isFinite(x)
            && Number.isFinite(y)
            && !map.isOutOfBounds(x, y)
            && !map.isColliding(x, y)
        );
    }

    resolveDoorTeleport(mapId: string, x: number, y: number): DoorTeleportDestination | null {
        const sourceRef = this.#doorRefByTileKey.get(mapTileDoorKey(mapId, x, y));
        if (sourceRef) {
            const targetRef = this.#edgeTargetBySourceRefKey.get(mapGraphDoorRefKey(sourceRef));
            if (targetRef) {
                const targetCoords = this.#doorCoordsByRefKey.get(mapGraphDoorRefKey(targetRef));
                if (targetCoords) {
                    return {
                        toMapId: targetCoords.mapId,
                        to: { x: targetCoords.x, y: targetCoords.y },
                    };
                }
            }
        }
        return null;
    }
}

export function createWorldMapRegistryFromMapPack(pack: unknown): WorldMapRegistry {
    const root = asRecord(pack);
    if (!root) {
        throw new Error('Invalid map pack: root must be an object.');
    }
    if (!isMapGraph(root.graph)) {
        throw new Error('Invalid map pack: graph payload is invalid.');
    }
    const graph = root.graph;
    const mapsRaw = Array.isArray(root.maps) ? root.maps : [];
    if (mapsRaw.length === 0) {
        throw new Error('Invalid map pack: no maps.');
    }

    const mapsById = new Map<string, ServerMap>();
    const mapEntries: Array<{ id: string; server: Record<string, unknown> }> = [];
    for (let i = 0; i < mapsRaw.length; i += 1) {
        const entry = asRecord(mapsRaw[i]);
        const id = entry ? asNonEmptyString(entry.id) : null;
        const serverPayload = entry ? asRecord(entry.server) : null;
        if (!id || !serverPayload) {
            throw new Error(`Invalid map pack: maps[${i}] must include string id + object server payload.`);
        }
        mapEntries.push({ id, server: serverPayload });
    }

    const graphMapsById = new Map(graph.maps.map((map) => [map.id, map]));
    if (graphMapsById.size !== mapEntries.length) {
        throw new Error(
            `Invalid map pack: graph/maps id mismatch (graph=${graphMapsById.size}, payload=${mapEntries.length}).`
        );
    }

    for (let i = 0; i < mapEntries.length; i += 1) {
        const entry = mapEntries[i];
        if (!entry) {
            continue;
        }
        if (mapsById.has(entry.id)) {
            throw new Error(`Invalid map pack: duplicate map id "${entry.id}".`);
        }
        const map = createMapFromServerPayload(entry.server);
        const graphMap = graphMapsById.get(entry.id);
        if (!graphMap) {
            throw new Error(`Invalid map pack: map "${entry.id}" is missing from graph.maps.`);
        }
        if (map.width !== graphMap.width || map.height !== graphMap.height) {
            throw new Error(
                `Invalid map pack: map "${entry.id}" dimensions mismatch graph (${graphMap.width}x${graphMap.height}) vs payload (${map.width}x${map.height}).`
            );
        }
        mapsById.set(entry.id, map);
    }

    for (const graphMapId of graphMapsById.keys()) {
        if (!mapsById.has(graphMapId)) {
            throw new Error(`Invalid map pack: graph map "${graphMapId}" is missing runtime payload.`);
        }
    }

    const defaultMapId =
        mapEntries.find((entry) => entry.id === 'world_01')?.id ??
        mapEntries.find((entry) => entry.id === 'world')?.id ??
        mapEntries[0]?.id;
    if (!defaultMapId) {
        throw new Error('Invalid map pack: missing default map id.');
    }

    return new WorldMapRegistry({
        defaultMapId,
        graph,
        mapsById,
    });
}
