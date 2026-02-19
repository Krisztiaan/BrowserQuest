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
        const entry: unknown = changes[i];
        if (!Array.isArray(entry) || entry.length !== 3) {
            return null;
        }
        const x: unknown = entry[0];
        const y: unknown = entry[1];
        const value: unknown = entry[2];
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

// ---- Binary wire codec (FixedBin v2 chunk payloads; no JSON strings) ----

export const CHUNK_DELTA_BINARY_SCHEMA_VERSION = 1 as const;

function varu32Len(value: number): number {
    if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
        throw new Error('invalid varu32');
    }
    let remaining = value >>> 0;
    let len = 1;
    while (remaining >= 0x80) {
        remaining >>>= 7;
        len += 1;
    }
    return len;
}

function isByte(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xff;
}

function toByteArray(payload: unknown): Uint8Array | null {
    if (payload instanceof Uint8Array) {
        return payload;
    }
    if (!Array.isArray(payload)) {
        return null;
    }
    const list: unknown[] = payload;
    const out = new Uint8Array(list.length);
    for (let i = 0; i < list.length; i += 1) {
        const value = list[i];
        if (!isByte(value)) {
            return null;
        }
        out[i] = value;
    }
    return out;
}

class BinWriter {
    private buffer: Uint8Array;
    private offset = 0;

    constructor(initialCapacity = 256) {
        this.buffer = new Uint8Array(initialCapacity);
    }

    private ensure(neededBytes: number): void {
        if (this.offset + neededBytes <= this.buffer.length) {
            return;
        }
        let nextLength = this.buffer.length;
        while (this.offset + neededBytes > nextLength) {
            nextLength *= 2;
        }
        const next = new Uint8Array(nextLength);
        next.set(this.buffer);
        this.buffer = next;
    }

    writeU8(value: number): void {
        this.ensure(1);
        this.buffer[this.offset] = value & 0xff;
        this.offset += 1;
    }

    writeU16Le(value: number): void {
        this.ensure(2);
        this.buffer[this.offset] = value & 0xff;
        this.buffer[this.offset + 1] = (value >>> 8) & 0xff;
        this.offset += 2;
    }

    writeVarU32(value: number): void {
        if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
            throw new Error('invalid varu32');
        }
        this.ensure(5);
        let remaining = value >>> 0;
        while (remaining >= 0x80) {
            this.buffer[this.offset] = (remaining & 0x7f) | 0x80;
            this.offset += 1;
            remaining >>>= 7;
        }
        this.buffer[this.offset] = remaining & 0xff;
        this.offset += 1;
    }

    toUint8Array(): Uint8Array {
        return this.buffer.slice(0, this.offset);
    }
}

class BinReader {
    private offset = 0;
    constructor(private readonly bytes: Uint8Array) {}

    readU8(): number | null {
        if (this.offset + 1 > this.bytes.length) {
            return null;
        }
        const value = this.bytes[this.offset] ?? 0;
        this.offset += 1;
        return value;
    }

    readU16Le(): number | null {
        if (this.offset + 2 > this.bytes.length) {
            return null;
        }
        const b0 = this.bytes[this.offset] ?? 0;
        const b1 = this.bytes[this.offset + 1] ?? 0;
        this.offset += 2;
        return b0 | (b1 << 8);
    }

    readVarU32(): number | null {
        const bytes = this.bytes;
        let offset = this.offset;
        let shift = 0;
        let value = 0;
        while (shift < 35) {
            if (offset >= bytes.length) {
                return null;
            }
            const byte = bytes[offset] ?? 0;
            offset += 1;
            value |= (byte & 0x7f) << shift;
            if ((byte & 0x80) === 0) {
                this.offset = offset;
                return value >>> 0;
            }
            shift += 7;
        }
        return null;
    }

    remaining(): number {
        return this.bytes.length - this.offset;
    }
}

export function encodeChunkDeltaPayloadBinary({
    chunkSize,
    changes,
}: {
    chunkSize: number;
    changes: ChunkDeltaChange[];
}): number[] {
    if (!Number.isInteger(chunkSize) || chunkSize <= 0 || chunkSize > 256) {
        throw new Error(`encodeChunkDeltaPayloadBinary: invalid chunkSize: ${String(chunkSize)}`);
    }

    let size = 1 + varu32Len(chunkSize) + varu32Len(changes.length);
    for (let i = 0; i < changes.length; i += 1) {
        const entry = changes[i];
        if (!entry) {
            continue;
        }
        const x = entry[0];
        const y = entry[1];
        const value = entry[2];
        if (
            !Number.isInteger(x)
            || !Number.isInteger(y)
            || x < 0
            || y < 0
            || x >= chunkSize
            || y >= chunkSize
        ) {
            throw new Error('encodeChunkDeltaPayloadBinary: invalid change');
        }
        if (value !== null && (!Number.isInteger(value) || value < 0)) {
            throw new Error('encodeChunkDeltaPayloadBinary: invalid change value');
        }
        const valuePlusOne = value === null ? 0 : value + 1;
        size += 2 + varu32Len(valuePlusOne);
    }

    const writer = new BinWriter(size);
    writer.writeU8(CHUNK_DELTA_BINARY_SCHEMA_VERSION);
    writer.writeVarU32(chunkSize);
    writer.writeVarU32(changes.length);
    for (let i = 0; i < changes.length; i += 1) {
        const [x, y, value] = changes[i] ?? [0, 0, null];
        const idx = y * chunkSize + x;
        writer.writeU16Le(idx);
        writer.writeVarU32(value === null ? 0 : value + 1);
    }
    return Array.from(writer.toUint8Array());
}

export function decodeChunkDeltaPayloadBinary(
    payloadBytes: unknown,
    { maxChanges = 4096 }: { maxChanges?: number } = {}
): { schemaVersion: 1; encoding: 'binary'; chunkSize: number; changes: ChunkDeltaChange[] } | null {
    if (!Number.isInteger(maxChanges) || maxChanges <= 0) {
        return null;
    }
    const bytes = toByteArray(payloadBytes);
    if (!bytes) {
        return null;
    }
    const reader = new BinReader(bytes);
    const schemaVersion = reader.readU8();
    if (schemaVersion !== CHUNK_DELTA_BINARY_SCHEMA_VERSION) {
        return null;
    }
    const chunkSize = reader.readVarU32();
    if (chunkSize === null || chunkSize <= 0 || chunkSize > 256) {
        return null;
    }
    const count = reader.readVarU32();
    if (count === null || count > maxChanges) {
        return null;
    }
    const maxIdx = chunkSize * chunkSize;
    const changes: ChunkDeltaChange[] = [];
    for (let i = 0; i < count; i += 1) {
        const idx = reader.readU16Le();
        const valuePlusOne = reader.readVarU32();
        if (idx === null || valuePlusOne === null || idx < 0 || idx >= maxIdx) {
            return null;
        }
        const x = idx % chunkSize;
        const y = Math.floor(idx / chunkSize);
        const value = valuePlusOne === 0 ? null : valuePlusOne - 1;
        changes.push([x, y, value]);
    }
    if (reader.remaining() !== 0) {
        return null;
    }
    return { schemaVersion: 1, encoding: 'binary', chunkSize, changes };
}
