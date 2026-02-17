export const PROTOCOL_REVISION = 1 as const;

const MAX_CAPABILITIES_JSON_BYTES = 4096;
const MAX_ID_COUNT = 256;
const MAX_ID_LENGTH = 96;

export type ProtocolCapabilities = Readonly<{
    moduleIds?: ReadonlyArray<string>;
    intentTypeIds?: ReadonlyArray<string>;
    outcomeTypeIds?: ReadonlyArray<string>;
}>;

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
type JsonRecord = Record<string, JsonValue>;

function isStringArray(value: JsonValue | object | null | undefined): value is string[] {
    return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isJsonRecord(value: JsonValue | object | null | undefined): value is JsonRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
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

    let parsed: JsonValue;
    try {
        parsed = JSON.parse(json) as JsonValue;
    } catch (_) {
        return null;
    }
    if (!isJsonRecord(parsed)) {
        return null;
    }
    const moduleIdsRaw = parsed.moduleIds;
    const intentTypeIdsRaw = parsed.intentTypeIds;
    const outcomeTypeIdsRaw = parsed.outcomeTypeIds;

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
