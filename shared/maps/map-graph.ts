type UnknownRecord = Record<string, unknown>;

export type MapGraphDoor = Readonly<{
    id: string;
    x: number;
    y: number;
}>;

export type MapGraphMap = Readonly<{
    id: string;
    width: number;
    height: number;
    doors: ReadonlyArray<MapGraphDoor>;
}>;

export type MapGraphDoorRef = Readonly<{
    mapId: string;
    doorId: string;
}>;

export type MapGraphEdge = Readonly<{
    from: MapGraphDoorRef;
    to: MapGraphDoorRef;
}>;

export type MapGraph = Readonly<{
    maps: ReadonlyArray<MapGraphMap>;
    edges: ReadonlyArray<MapGraphEdge>;
}>;

export type MapGraphValidationResult = Readonly<{ ok: true }> | Readonly<{ ok: false; errors: string[] }>;

function asRecord(value: unknown): UnknownRecord | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    return value as UnknownRecord;
}

function asNonEmptyString(value: unknown): string | null {
    if (typeof value !== 'string' || value.trim().length === 0) {
        return null;
    }
    return value;
}

function isPositiveInteger(value: unknown): value is number {
    return Number.isInteger(value) && (value as number) > 0;
}

export function mapGraphDoorRefKey(ref: MapGraphDoorRef): string {
    return `${ref.mapId}:${ref.doorId}`;
}

export function validateMapGraph(value: unknown): MapGraphValidationResult {
    const errors: string[] = [];
    const root = asRecord(value);
    if (!root) {
        return { ok: false, errors: ['Invalid map graph: root must be an object.'] };
    }

    const mapsRaw = root.maps;
    const edgesRaw = root.edges;
    if (!Array.isArray(mapsRaw)) {
        errors.push('Invalid map graph: "maps" must be an array.');
    }
    if (!Array.isArray(edgesRaw)) {
        errors.push('Invalid map graph: "edges" must be an array.');
    }

    const maps = Array.isArray(mapsRaw) ? (mapsRaw as unknown[]) : [];
    const edges = Array.isArray(edgesRaw) ? (edgesRaw as unknown[]) : [];

    const knownMapIds = new Set<string>();
    const knownDoorRefs = new Set<string>();

    for (let mapIndex = 0; mapIndex < maps.length; mapIndex += 1) {
        const mapValue = maps[mapIndex];
        const mapRecord = asRecord(mapValue);
        if (!mapRecord) {
            errors.push(`Invalid map graph: maps[${mapIndex}] must be an object.`);
            continue;
        }

        const mapId = asNonEmptyString(mapRecord.id);
        if (!mapId) {
            errors.push(`Invalid map graph: maps[${mapIndex}].id must be a non-empty string.`);
        } else if (knownMapIds.has(mapId)) {
            errors.push(`Invalid map graph: duplicate map id "${mapId}".`);
        } else {
            knownMapIds.add(mapId);
        }

        if (!isPositiveInteger(mapRecord.width)) {
            errors.push(`Invalid map graph: maps[${mapIndex}].width must be a positive integer.`);
        }
        if (!isPositiveInteger(mapRecord.height)) {
            errors.push(`Invalid map graph: maps[${mapIndex}].height must be a positive integer.`);
        }

        const doorsRaw = mapRecord.doors;
        if (!Array.isArray(doorsRaw)) {
            errors.push(`Invalid map graph: maps[${mapIndex}].doors must be an array.`);
            continue;
        }
        const doors = doorsRaw as unknown[];

        const doorIdsInMap = new Set<string>();
        for (let doorIndex = 0; doorIndex < doors.length; doorIndex += 1) {
            const doorValue = doors[doorIndex];
            const doorRecord = asRecord(doorValue);
            if (!doorRecord) {
                errors.push(`Invalid map graph: maps[${mapIndex}].doors[${doorIndex}] must be an object.`);
                continue;
            }

            const doorId = asNonEmptyString(doorRecord.id);
            if (!doorId) {
                errors.push(`Invalid map graph: maps[${mapIndex}].doors[${doorIndex}].id must be a non-empty string.`);
                continue;
            }

            if (doorIdsInMap.has(doorId)) {
                const mapLabel = mapId ?? `maps[${mapIndex}]`;
                errors.push(`Invalid map graph: duplicate door id "${doorId}" in map "${mapLabel}".`);
            } else {
                doorIdsInMap.add(doorId);
            }

            if (!Number.isInteger(doorRecord.x)) {
                errors.push(`Invalid map graph: maps[${mapIndex}].doors[${doorIndex}].x must be an integer.`);
            }
            if (!Number.isInteger(doorRecord.y)) {
                errors.push(`Invalid map graph: maps[${mapIndex}].doors[${doorIndex}].y must be an integer.`);
            }

            if (mapId) {
                knownDoorRefs.add(mapGraphDoorRefKey({ mapId, doorId }));
            }
        }
    }

    const seenEdges = new Set<string>();
    for (let edgeIndex = 0; edgeIndex < edges.length; edgeIndex += 1) {
        const edgeValue = edges[edgeIndex];
        const edgeRecord = asRecord(edgeValue);
        if (!edgeRecord) {
            errors.push(`Invalid map graph: edges[${edgeIndex}] must be an object.`);
            continue;
        }

        const fromRecord = asRecord(edgeRecord.from);
        const toRecord = asRecord(edgeRecord.to);
        if (!fromRecord) {
            errors.push(`Invalid map graph: edges[${edgeIndex}].from must be an object.`);
        }
        if (!toRecord) {
            errors.push(`Invalid map graph: edges[${edgeIndex}].to must be an object.`);
        }
        if (!fromRecord || !toRecord) {
            continue;
        }

        const fromMapId = asNonEmptyString(fromRecord.mapId);
        const fromDoorId = asNonEmptyString(fromRecord.doorId);
        const toMapId = asNonEmptyString(toRecord.mapId);
        const toDoorId = asNonEmptyString(toRecord.doorId);

        if (!fromMapId || !fromDoorId) {
            errors.push(`Invalid map graph: edges[${edgeIndex}].from must include non-empty mapId and doorId.`);
            continue;
        }
        if (!toMapId || !toDoorId) {
            errors.push(`Invalid map graph: edges[${edgeIndex}].to must include non-empty mapId and doorId.`);
            continue;
        }

        const fromKey = mapGraphDoorRefKey({ mapId: fromMapId, doorId: fromDoorId });
        const toKey = mapGraphDoorRefKey({ mapId: toMapId, doorId: toDoorId });

        if (!knownDoorRefs.has(fromKey)) {
            errors.push(`Invalid map graph: dangling edge source "${fromKey}".`);
        }
        if (!knownDoorRefs.has(toKey)) {
            errors.push(`Invalid map graph: dangling edge destination "${toKey}".`);
        }

        const edgeKey = `${fromKey}->${toKey}`;
        if (seenEdges.has(edgeKey)) {
            errors.push(`Invalid map graph: duplicate edge "${edgeKey}".`);
        } else {
            seenEdges.add(edgeKey);
        }
    }

    if (errors.length > 0) {
        return { ok: false, errors };
    }
    return { ok: true };
}

export function isMapGraph(value: unknown): value is MapGraph {
    return validateMapGraph(value).ok;
}
