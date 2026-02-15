export const PROTOCOL_REVISION = 1 as const;

const MAX_CAPABILITIES_JSON_BYTES = 4096;
const MAX_ID_COUNT = 256;
const MAX_ID_LENGTH = 96;

export type ProtocolCapabilities = Readonly<{
    moduleIds?: ReadonlyArray<string>;
    intentTypeIds?: ReadonlyArray<string>;
    outcomeTypeIds?: ReadonlyArray<string>;
}>;

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function normalizeIdList(list: ReadonlyArray<string>): string[] {
    const out: string[] = [];
    for (const raw of list) {
        const id = raw.trim();
        if (!id) {
            continue;
        }
        if (id.length > MAX_ID_LENGTH) {
            continue;
        }
        out.push(id);
        if (out.length >= MAX_ID_COUNT) {
            break;
        }
    }
    return out;
}

export function encodeProtocolCapabilitiesJson(payload: ProtocolCapabilities): string {
    return JSON.stringify(payload);
}

export function decodeProtocolCapabilitiesJson(json: string): ProtocolCapabilities | null {
    if (typeof json !== 'string') {
        return null;
    }
    if (json.length > MAX_CAPABILITIES_JSON_BYTES) {
        return null;
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch (_) {
        return null;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null;
    }
    const record = parsed as Record<string, unknown>;

    const moduleIdsRaw = record.moduleIds;
    const intentTypeIdsRaw = record.intentTypeIds;
    const outcomeTypeIdsRaw = record.outcomeTypeIds;

    const moduleIds = isStringArray(moduleIdsRaw) ? normalizeIdList(moduleIdsRaw) : undefined;
    const intentTypeIds = isStringArray(intentTypeIdsRaw) ? normalizeIdList(intentTypeIdsRaw) : undefined;
    const outcomeTypeIds = isStringArray(outcomeTypeIdsRaw) ? normalizeIdList(outcomeTypeIdsRaw) : undefined;

    if (!moduleIds && !intentTypeIds && !outcomeTypeIds) {
        return {};
    }

    return {
        ...(moduleIds ? { moduleIds } : {}),
        ...(intentTypeIds ? { intentTypeIds } : {}),
        ...(outcomeTypeIds ? { outcomeTypeIds } : {}),
    };
}

