import type { MusicKey } from './asset-key-domain';

const runtimeMapPackUrl = '/assets/maps/runtime/map-pack.json';

type JsonScalar = string | number | boolean | null;
type JsonLike = JsonScalar | JsonLike[] | { [key: string]: JsonLike };
type UnknownRecord = Record<string, unknown>;
type RawMapRecord = { [key: string]: JsonLike | undefined };

type ClientRuntimeMap = {
    width: number;
    height: number;
    tilesize: number;
    data: Array<number | number[]>;
    foreground: Array<number | number[]>;
    blocking: number[];
    plateau: number[];
    navIslandByTile: number[];
    navIslandCount: number;
    primaryNavIslandId: number;
    musicAreas: Array<{ x: number; y: number; w: number; h: number; id: MusicKey }>;
    collisions: number[];
    animated: Record<number, { l?: number; d?: number }>;
    doors: RawMapRecord[];
    checkpoints: RawMapRecord[];
};

function cloneClientRuntimeMap(map: ClientRuntimeMap): ClientRuntimeMap {
    if (typeof structuredClone === 'function') {
        return structuredClone(map);
    }
    return JSON.parse(JSON.stringify(map)) as ClientRuntimeMap;
}

function asRecord(value: unknown): UnknownRecord | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    return value as UnknownRecord;
}

function asNonEmptyString(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function asFiniteInteger(value: unknown): number | null {
    if (!Number.isInteger(value) || !Number.isFinite(value as number)) {
        return null;
    }
    return value as number;
}

function normalizeNumberArray(value: unknown, label: string): number[] {
    if (!Array.isArray(value)) {
        throw new Error(`Invalid runtime map pack payload: ${label} must be an array.`);
    }
    const out: number[] = [];
    for (let i = 0; i < value.length; i += 1) {
        const candidate = asFiniteInteger(value[i]);
        if (candidate === null) {
            throw new Error(`Invalid runtime map pack payload: ${label}[${i}] must be an integer.`);
        }
        out.push(candidate);
    }
    return out;
}

function normalizeTileData(value: unknown, label: string): Array<number | number[]> {
    if (!Array.isArray(value)) {
        throw new Error(`Invalid runtime map pack payload: ${label} must be an array.`);
    }
    const entries = value as unknown[];
    const out: Array<number | number[]> = [];
    for (let i = 0; i < entries.length; i += 1) {
        const candidate: unknown = entries[i];
        if (Array.isArray(candidate)) {
            out[i] = normalizeNumberArray(candidate, `${label}[${i}]`);
            continue;
        }
        const tileId = asFiniteInteger(candidate);
        if (tileId === null) {
            throw new Error(`Invalid runtime map pack payload: ${label}[${i}] must be an integer or integer array.`);
        }
        out[i] = tileId;
    }
    return out;
}

function normalizeAnimatedConfig(value: unknown, label: string): Record<number, { l?: number; d?: number }> {
    const record = asRecord(value);
    if (!record) {
        throw new Error(`Invalid runtime map pack payload: ${label} must be an object.`);
    }
    const out: Record<number, { l?: number; d?: number }> = {};
    for (const [key, config] of Object.entries(record)) {
        const tileId = Number.parseInt(key, 10);
        if (!Number.isInteger(tileId) || tileId <= 0) {
            throw new Error(`Invalid runtime map pack payload: ${label} key "${key}" must be a positive integer.`);
        }
        const parsedConfig = asRecord(config);
        if (!parsedConfig) {
            throw new Error(`Invalid runtime map pack payload: ${label}.${key} must be an object.`);
        }
        const length = parsedConfig.l;
        const delay = parsedConfig.d;
        const next: { l?: number; d?: number } = {};
        if (length !== undefined) {
            const parsedLength = asFiniteInteger(length);
            if (parsedLength === null || parsedLength <= 0) {
                throw new Error(`Invalid runtime map pack payload: ${label}.${key}.l must be a positive integer.`);
            }
            next.l = parsedLength;
        }
        if (delay !== undefined) {
            const parsedDelay = asFiniteInteger(delay);
            if (parsedDelay === null || parsedDelay <= 0) {
                throw new Error(`Invalid runtime map pack payload: ${label}.${key}.d must be a positive integer.`);
            }
            next.d = parsedDelay;
        }
        out[tileId] = next;
    }
    return out;
}

function normalizeRawRecordArray(value: unknown, label: string): RawMapRecord[] {
    if (!Array.isArray(value)) {
        throw new Error(`Invalid runtime map pack payload: ${label} must be an array.`);
    }
    return value.map((entry, index) => {
        const record = asRecord(entry);
        if (!record) {
            throw new Error(`Invalid runtime map pack payload: ${label}[${index}] must be an object.`);
        }
        return record as RawMapRecord;
    });
}

function normalizeMusicAreas(value: unknown, label: string): Array<{ x: number; y: number; w: number; h: number; id: MusicKey }> {
    if (!Array.isArray(value)) {
        throw new Error(`Invalid runtime map pack payload: ${label} must be an array.`);
    }
    const out: Array<{ x: number; y: number; w: number; h: number; id: MusicKey }> = [];
    for (let i = 0; i < value.length; i += 1) {
        const area = asRecord(value[i]);
        if (!area) {
            throw new Error(`Invalid runtime map pack payload: ${label}[${i}] must be an object.`);
        }
        const x = asFiniteInteger(area.x);
        const y = asFiniteInteger(area.y);
        const w = asFiniteInteger(area.w);
        const h = asFiniteInteger(area.h);
        const id = asNonEmptyString(area.id);
        if (x === null || y === null || w === null || h === null || !id) {
            throw new Error(`Invalid runtime map pack payload: ${label}[${i}] must include x/y/w/h integers and string id.`);
        }
        out.push({ x, y, w, h, id: id as MusicKey });
    }
    return out;
}

function normalizeClientRuntimeMap(value: unknown, mapId: string): ClientRuntimeMap {
    const record = asRecord(value);
    if (!record) {
        throw new Error(`Invalid runtime map pack payload: map "${mapId}" client payload must be an object.`);
    }

    const width = asFiniteInteger(record.width);
    const height = asFiniteInteger(record.height);
    const tilesize = asFiniteInteger(record.tilesize);
    if (width === null || width <= 0 || height === null || height <= 0 || tilesize === null || tilesize <= 0) {
        throw new Error(`Invalid runtime map pack payload: map "${mapId}" width/height/tilesize must be positive integers.`);
    }
    const navIslandCountRaw = asFiniteInteger(record.navIslandCount);
    const primaryNavIslandIdRaw = asFiniteInteger(record.primaryNavIslandId);

    return {
        width,
        height,
        tilesize,
        data: normalizeTileData(record.data, `map "${mapId}" client.data`),
        foreground: normalizeTileData(record.foreground, `map "${mapId}" client.foreground`),
        blocking: normalizeNumberArray(record.blocking ?? [], `map "${mapId}" client.blocking`),
        plateau: normalizeNumberArray(record.plateau ?? [], `map "${mapId}" client.plateau`),
        navIslandByTile: normalizeNumberArray(record.navIslandByTile ?? [], `map "${mapId}" client.navIslandByTile`),
        navIslandCount: navIslandCountRaw ?? 0,
        primaryNavIslandId: primaryNavIslandIdRaw ?? 0,
        musicAreas: normalizeMusicAreas(record.musicAreas ?? [], `map "${mapId}" client.musicAreas`),
        collisions: normalizeNumberArray(record.collisions, `map "${mapId}" client.collisions`),
        animated: normalizeAnimatedConfig(record.animated ?? {}, `map "${mapId}" client.animated`),
        doors: normalizeRawRecordArray(record.doors ?? [], `map "${mapId}" client.doors`),
        checkpoints: normalizeRawRecordArray(record.checkpoints ?? [], `map "${mapId}" client.checkpoints`),
    };
}

let cachedClientRuntimeMapPayloadById: Map<string, unknown> | null = null;
let cachedClientRuntimeMapsById: Map<string, ClientRuntimeMap> | null = null;
let cachedDefaultMapId: string | null = null;
let pendingMapPackLoad: Promise<void> | null = null;

async function ensureClientRuntimeMapsLoaded(): Promise<void> {
    if (cachedClientRuntimeMapsById !== null && cachedDefaultMapId !== null) {
        return;
    }

    pendingMapPackLoad ??= (async () => {
        const response = await fetch(runtimeMapPackUrl, { credentials: 'same-origin' });
        if (!response.ok) {
            throw new Error(`Failed to fetch runtime map pack (${response.status}).`);
        }

        const payload = (await response.json()) as unknown;
        const root = asRecord(payload);
        if (!root) {
            throw new Error('Invalid runtime map pack payload: expected an object payload.');
        }
        if (root.schemaVersion !== 2 || !Array.isArray(root.maps)) {
            throw new Error('Invalid runtime map pack payload: expected schemaVersion=2 with maps array.');
        }

        const payloadById = new Map<string, unknown>();
        for (let i = 0; i < root.maps.length; i += 1) {
            const entry = asRecord(root.maps[i]);
            if (!entry) {
                throw new Error(`Invalid runtime map pack payload: maps[${i}] must be an object.`);
            }
            const mapId = asNonEmptyString(entry.id);
            if (!mapId) {
                throw new Error(`Invalid runtime map pack payload: maps[${i}].id must be a non-empty string.`);
            }
            if (payloadById.has(mapId)) {
                throw new Error(`Invalid runtime map pack payload: duplicate map id "${mapId}".`);
            }
            payloadById.set(mapId, entry.client);
        }

        let defaultMapId: string | null = null;
        for (let i = 0; i < root.maps.length; i += 1) {
            const entry = asRecord(root.maps[i]);
            const mapId = asNonEmptyString(entry?.id);
            if (mapId === 'world_01') {
                defaultMapId = mapId;
                break;
            }
        }
        if (!defaultMapId) {
            for (let i = 0; i < root.maps.length; i += 1) {
                const entry = asRecord(root.maps[i]);
                const mapId = asNonEmptyString(entry?.id);
                if (mapId === 'world') {
                    defaultMapId = mapId;
                    break;
                }
            }
        }
        defaultMapId ??= root.maps.length > 0 ? asNonEmptyString(asRecord(root.maps[0])?.id) : null;
        if (!defaultMapId || !payloadById.has(defaultMapId)) {
            throw new Error('Invalid runtime map pack payload: unable to resolve default map id.');
        }

        cachedClientRuntimeMapPayloadById = payloadById;
        cachedClientRuntimeMapsById = new Map<string, ClientRuntimeMap>();
        cachedDefaultMapId = defaultMapId;
    })();

    try {
        await pendingMapPackLoad;
    } finally {
        pendingMapPackLoad = null;
    }
}

function normalizeRequestedMapId(requestedMapId: string | undefined): string | null {
    if (typeof requestedMapId !== 'string') {
        return null;
    }
    const trimmed = requestedMapId.trim();
    return trimmed.length > 0 ? trimmed : null;
}

export async function fetchClientDefaultRuntimeMapId(): Promise<string> {
    await ensureClientRuntimeMapsLoaded();
    return cachedDefaultMapId as string;
}

export async function fetchClientRuntimeMap(mapId?: string): Promise<ClientRuntimeMap> {
    await ensureClientRuntimeMapsLoaded();
    const mapPayloadsById = cachedClientRuntimeMapPayloadById as Map<string, unknown>;
    const mapsById = cachedClientRuntimeMapsById as Map<string, ClientRuntimeMap>;
    const requested = normalizeRequestedMapId(mapId);
    const resolvedMapId = requested ?? (cachedDefaultMapId as string);
    let runtimeMap = mapsById.get(resolvedMapId);
    if (!runtimeMap) {
        const rawPayload = mapPayloadsById.get(resolvedMapId);
        if (rawPayload === undefined) {
            throw new Error(`Unknown runtime map id "${resolvedMapId}".`);
        }
        runtimeMap = normalizeClientRuntimeMap(rawPayload, resolvedMapId);
        mapsById.set(resolvedMapId, runtimeMap);
    }
    return cloneClientRuntimeMap(runtimeMap);
}

export function __resetClientRuntimeMapSourceCacheForTests(): void {
    cachedClientRuntimeMapPayloadById = null;
    cachedClientRuntimeMapsById = null;
    cachedDefaultMapId = null;
    pendingMapPackLoad = null;
}
