import { gunzipSync, gzipSync } from 'fflate';

export type ChunkSnapshotOverride = [number, number, number];
type JsonScalar = string | number | boolean | null;
type JsonLike = JsonScalar | JsonLike[] | { [key: string]: JsonLike };
type JsonRecord = { [key: string]: JsonLike };

type ChunkSnapshotJsonEnvelopeV1 = Readonly<{
    schemaVersion: 1;
    encoding: 'json';
    chunkSize: number;
    overrides: ChunkSnapshotOverride[];
}>;

type ChunkSnapshotGzipEnvelopeV1 = Readonly<{
    schemaVersion: 1;
    encoding: 'gzip+base64';
    chunkSize: number;
    data: string;
    uncompressedUtf8Bytes: number;
}>;

export type ChunkSnapshotPayloadEnvelopeV1 = ChunkSnapshotJsonEnvelopeV1 | ChunkSnapshotGzipEnvelopeV1;

export const DEFAULT_MAX_CHUNK_SNAPSHOT_PAYLOAD_UTF8_BYTES = 64 * 1024;
export const DEFAULT_MAX_CHUNK_SNAPSHOT_DECOMPRESSED_UTF8_BYTES = 512 * 1024;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8', { fatal: false });

function utf8Encode(value: string): Uint8Array {
    return textEncoder.encode(value);
}

function utf8Decode(value: Uint8Array): string {
    return textDecoder.decode(value);
}

function utf8ByteLength(value: string): number {
    return utf8Encode(value).length;
}

function base64Encode(bytes: Uint8Array): string {
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(bytes).toString('base64');
    }
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i] ?? 0);
    }
    return btoa(binary);
}

function base64Decode(base64: string): Uint8Array | null {
    try {
        if (typeof Buffer !== 'undefined') {
            return new Uint8Array(Buffer.from(base64, 'base64'));
        }
        const binary = atob(base64);
        const out = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
            out[i] = binary.charCodeAt(i);
        }
        return out;
    } catch (_) {
        return null;
    }
}

function isRecord(value: JsonLike | object | null | undefined): value is JsonRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateDecodedChunkSize(chunkSize: JsonLike | object | null | undefined): number | null {
    if (typeof chunkSize !== 'number' || !Number.isSafeInteger(chunkSize) || chunkSize <= 0 || chunkSize > 256) {
        return null;
    }
    return chunkSize;
}

function validateDecodedOverrides(overrides: JsonLike | object | null | undefined, chunkSize: number): ChunkSnapshotOverride[] | null {
    if (!Array.isArray(overrides)) {
        return null;
    }
    const out: ChunkSnapshotOverride[] = [];
    for (let i = 0; i < overrides.length; i += 1) {
        const entry = overrides[i];
        if (!Array.isArray(entry) || entry.length !== 3) {
            return null;
        }
        const x = entry[0];
        const y = entry[1];
        const value = entry[2];
        if (
            typeof x !== 'number'
            || typeof y !== 'number'
            || typeof value !== 'number'
            || !Number.isSafeInteger(x)
            || !Number.isSafeInteger(y)
            || !Number.isSafeInteger(value)
            || x < 0
            || y < 0
            || x >= chunkSize
            || y >= chunkSize
            || value < 0
        ) {
            return null;
        }
        out.push([x, y, value]);
    }
    return out;
}

export function encodeChunkSnapshotPayloadJson({
    chunkSize,
    overrides,
    maxUtf8Bytes = DEFAULT_MAX_CHUNK_SNAPSHOT_PAYLOAD_UTF8_BYTES,
}: {
    chunkSize: number;
    overrides: ChunkSnapshotOverride[];
    maxUtf8Bytes?: number;
}): string {
    if (!Number.isInteger(chunkSize) || chunkSize <= 0 || chunkSize > 256) {
        throw new Error(`encodeChunkSnapshotPayloadJson: invalid chunkSize: ${String(chunkSize)}`);
    }
    if (!Number.isInteger(maxUtf8Bytes) || maxUtf8Bytes <= 0) {
        throw new Error(`encodeChunkSnapshotPayloadJson: invalid maxUtf8Bytes: ${String(maxUtf8Bytes)}`);
    }

    const jsonEnvelope: ChunkSnapshotJsonEnvelopeV1 = Object.freeze({
        schemaVersion: 1,
        encoding: 'json',
        chunkSize,
        overrides,
    });
    const json = JSON.stringify(jsonEnvelope);
    if (utf8ByteLength(json) <= maxUtf8Bytes) {
        return json;
    }

    const uncompressed = JSON.stringify({ chunkSize, overrides });
    const gz = gzipSync(utf8Encode(uncompressed));
    const gzipEnvelope: ChunkSnapshotGzipEnvelopeV1 = Object.freeze({
        schemaVersion: 1,
        encoding: 'gzip+base64',
        chunkSize,
        data: base64Encode(gz),
        uncompressedUtf8Bytes: utf8ByteLength(uncompressed),
    });
    const wrapped = JSON.stringify(gzipEnvelope);
    if (utf8ByteLength(wrapped) <= maxUtf8Bytes) {
        return wrapped;
    }

    throw new Error(
        `encodeChunkSnapshotPayloadJson: payload exceeds cap even after gzip (cap=${maxUtf8Bytes}B, wrapped=${utf8ByteLength(wrapped)}B)`
    );
}

export function encodeChunkSnapshotPayloadJsonParts({
    chunkSize,
    overrides,
    maxUtf8Bytes = DEFAULT_MAX_CHUNK_SNAPSHOT_PAYLOAD_UTF8_BYTES,
}: {
    chunkSize: number;
    overrides: ChunkSnapshotOverride[];
    maxUtf8Bytes?: number;
}): string[] {
    const encodeRangeCache = new Map<string, string | null>();
    const tryEncodeRange = (startInclusive: number, endExclusive: number): string | null => {
        const cacheKey = `${startInclusive}:${endExclusive}`;
        if (encodeRangeCache.has(cacheKey)) {
            return encodeRangeCache.get(cacheKey) ?? null;
        }
        let encoded: string | null = null;
        try {
            encoded = encodeChunkSnapshotPayloadJson({
                chunkSize,
                overrides: overrides.slice(startInclusive, endExclusive),
                maxUtf8Bytes,
            });
        } catch (_) {
            encoded = null;
        }
        encodeRangeCache.set(cacheKey, encoded);
        return encoded;
    };

    const full = tryEncodeRange(0, overrides.length);
    if (full !== null) {
        return [full];
    }

    if (overrides.length === 0) {
        // Should have succeeded above, but keep this defensive.
        return [encodeChunkSnapshotPayloadJson({ chunkSize, overrides, maxUtf8Bytes })];
    }

    // Find the largest prefix length that fits under the cap.
    let lo = 1;
    let hi = overrides.length;
    let best = 0;
    while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (tryEncodeRange(0, mid) !== null) {
            best = mid;
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }

    if (best <= 0) {
        // Even a single override doesn't fit; caller should treat this as "cannot send".
        throw new Error('encodeChunkSnapshotPayloadJsonParts: cannot fit even 1 override under cap');
    }

    // Validate across all slices; later slices may encode slightly larger due to numeric string lengths.
    let perPart = best;
    while (perPart > 0) {
        const parts: string[] = [];
        let ok = true;
        for (let i = 0; i < overrides.length; i += perPart) {
            const encoded = tryEncodeRange(i, i + perPart);
            if (encoded === null) {
                ok = false;
                break;
            }
            parts.push(encoded);
        }
        if (ok) {
            return parts;
        }
        perPart = Math.floor(perPart / 2);
    }

    throw new Error('encodeChunkSnapshotPayloadJsonParts: could not find a valid split under cap');
}

export function decodeChunkSnapshotPayloadJson(
    payloadJson: string,
    {
        maxDecompressedUtf8Bytes = DEFAULT_MAX_CHUNK_SNAPSHOT_DECOMPRESSED_UTF8_BYTES,
    }: { maxDecompressedUtf8Bytes?: number } = {}
): { schemaVersion: 1; encoding: 'json' | 'gzip+base64'; chunkSize: number; overrides: ChunkSnapshotOverride[] } | null {
    if (typeof payloadJson !== 'string') {
        return null;
    }
    if (!Number.isInteger(maxDecompressedUtf8Bytes) || maxDecompressedUtf8Bytes <= 0) {
        return null;
    }

    let parsed: JsonLike;
    try {
        parsed = JSON.parse(payloadJson) as JsonLike;
    } catch (_) {
        return null;
    }
    if (!isRecord(parsed)) {
        return null;
    }

    const record = parsed;
    if (record.schemaVersion !== 1) {
        return null;
    }
    const encoding = record.encoding;
    const chunkSize = validateDecodedChunkSize(record.chunkSize);
    if (!chunkSize || (encoding !== 'json' && encoding !== 'gzip+base64')) {
        return null;
    }

    if (encoding === 'json') {
        const overrides = validateDecodedOverrides(record.overrides, chunkSize);
        if (!overrides) {
            return null;
        }
        return { schemaVersion: 1, encoding: 'json', chunkSize, overrides };
    }

    if (typeof record.data !== 'string' || typeof record.uncompressedUtf8Bytes !== 'number') {
        return null;
    }

    const gz = base64Decode(record.data);
    if (!gz) {
        return null;
    }

    let uncompressed: Uint8Array;
    try {
        uncompressed = gunzipSync(gz);
    } catch (_) {
        return null;
    }

    if (uncompressed.length > maxDecompressedUtf8Bytes) {
        return null;
    }

    let innerParsed: JsonLike;
    try {
        innerParsed = JSON.parse(utf8Decode(uncompressed)) as JsonLike;
    } catch (_) {
        return null;
    }
    if (!isRecord(innerParsed)) {
        return null;
    }

    const inner = innerParsed;
    const innerChunkSize = validateDecodedChunkSize(inner.chunkSize);
    if (!innerChunkSize || innerChunkSize !== chunkSize) {
        return null;
    }
    const overrides = validateDecodedOverrides(inner.overrides, chunkSize);
    if (!overrides) {
        return null;
    }

    return { schemaVersion: 1, encoding: 'gzip+base64', chunkSize, overrides };
}
