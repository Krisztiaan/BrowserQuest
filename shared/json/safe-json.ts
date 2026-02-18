export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

function toJsonValue(value: unknown): JsonValue | null {
    if (value === null) {
        return null;
    }
    if (typeof value === 'string' || typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }
    if (Array.isArray(value)) {
        const parsedArray: JsonValue[] = [];
        for (const entry of value) {
            const parsedEntry = toJsonValue(entry);
            if (parsedEntry === null && entry !== null) {
                return null;
            }
            parsedArray.push(parsedEntry);
        }
        return parsedArray;
    }
    if (typeof value === 'object') {
        const parsedRecord: { [key: string]: JsonValue } = {};
        for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
            const parsedEntry = toJsonValue(entry);
            if (parsedEntry === null && entry !== null) {
                return null;
            }
            parsedRecord[key] = parsedEntry;
        }
        return parsedRecord;
    }
    return null;
}

export function safeParseJsonValue(payload: string): JsonValue | null {
    try {
        const parsed: unknown = JSON.parse(payload);
        return toJsonValue(parsed);
    } catch (_) {
        return null;
    }
}
