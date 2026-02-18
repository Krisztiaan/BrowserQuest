import {
    BINARY_FRAME_HEADER_BYTES,
    BINARY_FRAME_KIND_ACTION_BATCH,
    BINARY_PROTOCOL_V1,
    BINARY_WIRE_MAGIC_B,
    BINARY_WIRE_MAGIC_Q,
} from './binary-wire';

const DIRECT_POS_INT_MAX = 0x3f;
const DIRECT_NEG_INT_BASE = 0x40;
const DIRECT_NEG_INT_MAX_TOKEN = 0x5f;
const DIRECT_STRING_BASE = 0x60;
const DIRECT_STRING_MAX_TOKEN = 0x7f;

const TAG_NULL = 0x80;
const TAG_FALSE = 0x81;
const TAG_TRUE = 0x82;
const TAG_INT32 = 0x83;
const TAG_FLOAT64 = 0x84;
const TAG_STRING = 0x85;
const TAG_ARRAY = 0x86;
const TAG_NUMBER_ARRAY = 0x87;

class ByteWriter {
    private buffer: Uint8Array;
    private offset: number;

    constructor(initial = 128) {
        this.buffer = new Uint8Array(initial);
        this.offset = 0;
    }

    private ensure(needed: number): void {
        if (this.offset + needed <= this.buffer.length) {
            return;
        }

        let nextLength = this.buffer.length;
        while (this.offset + needed > nextLength) {
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

    writeU32(value: number): void {
        this.ensure(4);
        this.buffer[this.offset] = value & 0xff;
        this.buffer[this.offset + 1] = (value >>> 8) & 0xff;
        this.buffer[this.offset + 2] = (value >>> 16) & 0xff;
        this.buffer[this.offset + 3] = (value >>> 24) & 0xff;
        this.offset += 4;
    }

    writeVarUint32(value: number): void {
        if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) {
            throw new Error('varuint32 out of range');
        }

        let next = value >>> 0;
        while (next >= 0x80) {
            this.writeU8((next & 0x7f) | 0x80);
            next >>>= 7;
        }
        this.writeU8(next);
    }

    writeF64(value: number): void {
        this.ensure(8);
        new DataView(this.buffer.buffer).setFloat64(this.offset, value, true);
        this.offset += 8;
    }

    writeBytes(bytes: Uint8Array): void {
        this.ensure(bytes.length);
        this.buffer.set(bytes, this.offset);
        this.offset += bytes.length;
    }

    toBytes(): Uint8Array {
        return this.buffer.slice(0, this.offset);
    }
}

class ByteReader {
    private offset = 0;

    constructor(private readonly bytes: Uint8Array) {}

    private require(size: number): void {
        if (this.offset + size > this.bytes.length) {
            throw new Error('decode overflow');
        }
    }

    readU8(): number {
        this.require(1);
        const value = this.bytes[this.offset] ?? 0;
        this.offset += 1;
        return value;
    }

    readU32(): number {
        this.require(4);
        const byte0 = this.bytes[this.offset] ?? 0;
        const byte1 = this.bytes[this.offset + 1] ?? 0;
        const byte2 = this.bytes[this.offset + 2] ?? 0;
        const byte3 = this.bytes[this.offset + 3] ?? 0;
        this.offset += 4;
        return (byte0 | (byte1 << 8) | (byte2 << 16) | (byte3 << 24)) >>> 0;
    }

    readVarUint32(): number {
        let result = 0;
        let shift = 0;

        for (let i = 0; i < 5; i += 1) {
            const byte = this.readU8();
            result |= (byte & 0x7f) << shift;
            if ((byte & 0x80) === 0) {
                return result >>> 0;
            }
            shift += 7;
        }

        throw new Error('invalid varuint32');
    }

    readF64(): number {
        this.require(8);
        const value = new DataView(this.bytes.buffer, this.bytes.byteOffset, this.bytes.byteLength).getFloat64(this.offset, true);
        this.offset += 8;
        return value;
    }

    readBytes(length: number): Uint8Array {
        this.require(length);
        const value = this.bytes.slice(this.offset, this.offset + length);
        this.offset += length;
        return value;
    }

    remaining(): number {
        return this.bytes.length - this.offset;
    }
}

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

function isInt32(value: number): boolean {
    return Number.isSafeInteger(value) && value >= -2_147_483_648 && value <= 2_147_483_647;
}

function zigZagEncodeInt32(value: number): number {
    return ((value << 1) ^ (value >> 31)) >>> 0;
}

function zigZagDecodeInt32(value: number): number {
    return (value >>> 1) ^ -(value & 1);
}

function encodeInt32(writer: ByteWriter, value: number): void {
    if (value >= 0 && value <= DIRECT_POS_INT_MAX) {
        writer.writeU8(value);
        return;
    }

    if (value >= -32 && value <= -1) {
        const token = DIRECT_NEG_INT_BASE + (-value - 1);
        writer.writeU8(token);
        return;
    }

    writer.writeU8(TAG_INT32);
    writer.writeVarUint32(zigZagEncodeInt32(value));
}

function decodeDirectTokenOrNull(token: number): number | string | null {
    if (token <= DIRECT_POS_INT_MAX) {
        return token;
    }

    if (token >= DIRECT_NEG_INT_BASE && token <= DIRECT_NEG_INT_MAX_TOKEN) {
        return -((token - DIRECT_NEG_INT_BASE) + 1);
    }

    if (token >= DIRECT_STRING_BASE && token <= DIRECT_STRING_MAX_TOKEN) {
        return '';
    }

    return null;
}

function writeString(writer: ByteWriter, value: string): void {
    const bytes = TEXT_ENCODER.encode(value);
    if (bytes.length <= 31) {
        writer.writeU8(DIRECT_STRING_BASE + bytes.length);
        writer.writeBytes(bytes);
        return;
    }

    writer.writeU8(TAG_STRING);
    writer.writeVarUint32(bytes.length);
    writer.writeBytes(bytes);
}

function isInt32NumberArray(value: unknown[]): value is number[] {
    for (let i = 0; i < value.length; i += 1) {
        const entry = value[i];
        if (typeof entry !== 'number' || !isInt32(entry)) {
            return false;
        }
    }
    return true;
}

function encodeValue(writer: ByteWriter, value: unknown): void {
    if (value === null) {
        writer.writeU8(TAG_NULL);
        return;
    }

    if (typeof value === 'boolean') {
        writer.writeU8(value ? TAG_TRUE : TAG_FALSE);
        return;
    }

    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            throw new Error('unsupported number');
        }

        if (isInt32(value)) {
            encodeInt32(writer, value);
            return;
        }

        writer.writeU8(TAG_FLOAT64);
        writer.writeF64(value);
        return;
    }

    if (typeof value === 'string') {
        writeString(writer, value);
        return;
    }

    if (Array.isArray(value)) {
        if (isInt32NumberArray(value)) {
            writer.writeU8(TAG_NUMBER_ARRAY);
            writer.writeVarUint32(value.length);
            for (let i = 0; i < value.length; i += 1) {
                const entry = value[i] ?? 0;
                writer.writeVarUint32(zigZagEncodeInt32(entry));
            }
            return;
        }

        writer.writeU8(TAG_ARRAY);
        writer.writeVarUint32(value.length);
        for (let i = 0; i < value.length; i += 1) {
            encodeValue(writer, value[i]);
        }
        return;
    }

    throw new Error('unsupported value type');
}

function decodeValue(reader: ByteReader): unknown {
    const token = reader.readU8();
    const direct = decodeDirectTokenOrNull(token);
    if (typeof direct === 'number') {
        return direct;
    }
    if (typeof direct === 'string') {
        const length = token - DIRECT_STRING_BASE;
        const bytes = reader.readBytes(length);
        return TEXT_DECODER.decode(bytes);
    }

    if (token === TAG_NULL) {
        return null;
    }
    if (token === TAG_FALSE) {
        return false;
    }
    if (token === TAG_TRUE) {
        return true;
    }
    if (token === TAG_INT32) {
        return zigZagDecodeInt32(reader.readVarUint32());
    }
    if (token === TAG_FLOAT64) {
        return reader.readF64();
    }
    if (token === TAG_STRING) {
        const length = reader.readVarUint32();
        const bytes = reader.readBytes(length);
        return TEXT_DECODER.decode(bytes);
    }
    if (token === TAG_NUMBER_ARRAY) {
        const length = reader.readVarUint32();
        const out: number[] = [];
        for (let i = 0; i < length; i += 1) {
            out.push(zigZagDecodeInt32(reader.readVarUint32()));
        }
        return out;
    }
    if (token === TAG_ARRAY) {
        const length = reader.readVarUint32();
        const out: unknown[] = [];
        for (let i = 0; i < length; i += 1) {
            out.push(decodeValue(reader));
        }
        return out;
    }

    throw new Error(`unsupported payload token: ${token}`);
}

function coerceInputToBytes(payload: ArrayBuffer | Uint8Array): Uint8Array {
    if (payload instanceof Uint8Array) {
        return payload;
    }
    return new Uint8Array(payload);
}

export function encodeBinaryActionBatchPayload(batch: ReadonlyArray<unknown>): Uint8Array {
    const payloadWriter = new ByteWriter();
    encodeValue(payloadWriter, batch);
    const encodedPayload = payloadWriter.toBytes();

    const frameWriter = new ByteWriter(BINARY_FRAME_HEADER_BYTES + encodedPayload.length);
    frameWriter.writeU8(BINARY_WIRE_MAGIC_B);
    frameWriter.writeU8(BINARY_WIRE_MAGIC_Q);
    frameWriter.writeU8(BINARY_PROTOCOL_V1);
    frameWriter.writeU8(BINARY_FRAME_KIND_ACTION_BATCH);
    frameWriter.writeU32(encodedPayload.length);
    frameWriter.writeBytes(encodedPayload);
    return frameWriter.toBytes();
}

export function decodeBinaryActionBatchPayload(payload: ArrayBuffer | Uint8Array): unknown {
    const frame = coerceInputToBytes(payload);
    const reader = new ByteReader(frame);

    const magicB = reader.readU8();
    const magicQ = reader.readU8();
    const version = reader.readU8();
    const frameKind = reader.readU8();
    const payloadLength = reader.readU32();

    if (magicB !== BINARY_WIRE_MAGIC_B || magicQ !== BINARY_WIRE_MAGIC_Q) {
        throw new Error('invalid frame magic');
    }
    if (version !== BINARY_PROTOCOL_V1) {
        throw new Error('unsupported frame version');
    }
    if (frameKind !== BINARY_FRAME_KIND_ACTION_BATCH) {
        throw new Error('unsupported frame kind');
    }

    const body = reader.readBytes(payloadLength);
    if (reader.remaining() !== 0) {
        throw new Error('invalid trailing bytes');
    }

    const payloadReader = new ByteReader(body);
    const decoded = decodeValue(payloadReader);
    if (payloadReader.remaining() !== 0) {
        throw new Error('invalid payload trailing bytes');
    }
    return decoded;
}
