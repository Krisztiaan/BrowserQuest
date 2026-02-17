export type ChunkDeltaChange = [number, number, number | null];

export type ChunkDeltaPayloadEnvelopeV1 = Readonly<{
    schemaVersion: 1;
    encoding: 'json';
    chunkSize: number;
    changes: ChunkDeltaChange[];
}>;

type JsonScalar = string | number | boolean | null;
type JsonLike = JsonScalar | JsonLike[] | { [key: string]: JsonLike };
type JsonRecord = Record<string, JsonLike>;

function isJsonRecord(value: JsonLike | object | null | undefined): value is JsonRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateChunkSize(chunkSize: JsonLike | object | undefined): number | null {
    if (typeof chunkSize !== 'number' || !Number.isSafeInteger(chunkSize) || chunkSize <= 0 || chunkSize > 256) {
        return null;
    }
    return chunkSize;
}

function validateChanges(changes: JsonLike | object | undefined, chunkSize: number, maxChanges: number): ChunkDeltaChange[] | null {
    if (!Array.isArray(changes) || changes.length > maxChanges) {
        return null;
    }
    const out: ChunkDeltaChange[] = [];
    for (let i = 0; i < changes.length; i += 1) {
        const entry = changes[i];
        if (!Array.isArray(entry) || entry.length !== 3) {
            return null;
        }
        const [x, y, value] = entry;
        if (
            typeof x !== 'number'
            || typeof y !== 'number'
            || !Number.isSafeInteger(x)
            || !Number.isSafeInteger(y)
            || x < 0
            || y < 0
            || x >= chunkSize
            || y >= chunkSize
        ) {
            return null;
        }
        if (value !== null) {
            if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
                return null;
            }
            out.push([x, y, value]);
        } else {
            out.push([x, y, null]);
        }
    }
    return out;
}

export function encodeChunkDeltaPayloadJson({
    chunkSize,
    changes,
}: {
    chunkSize: number;
    changes: ChunkDeltaChange[];
}): string {
    if (!Number.isInteger(chunkSize) || chunkSize <= 0 || chunkSize > 256) {
        throw new Error(`encodeChunkDeltaPayloadJson: invalid chunkSize: ${String(chunkSize)}`);
    }
    return JSON.stringify(
        Object.freeze({
            schemaVersion: 1,
            encoding: 'json',
            chunkSize,
            changes,
        } satisfies ChunkDeltaPayloadEnvelopeV1)
    );
}

export function decodeChunkDeltaPayloadJson(
    payloadJson: string,
    { maxChanges = 4096 }: { maxChanges?: number } = {}
): ChunkDeltaPayloadEnvelopeV1 | null {
    if (typeof payloadJson !== 'string' || !Number.isInteger(maxChanges) || maxChanges <= 0) {
        return null;
    }
    let parsed: JsonLike;
    try {
        parsed = JSON.parse(payloadJson) as JsonLike;
    } catch (_) {
        return null;
    }
    if (!isJsonRecord(parsed)) {
        return null;
    }
    if (parsed.schemaVersion !== 1 || parsed.encoding !== 'json') {
        return null;
    }
    const chunkSize = validateChunkSize(parsed.chunkSize);
    if (!chunkSize) {
        return null;
    }
    const changes = validateChanges(parsed.changes, chunkSize, maxChanges);
    if (!changes) {
        return null;
    }
    return Object.freeze({
        schemaVersion: 1,
        encoding: 'json',
        chunkSize,
        changes,
    });
}
