import {
    BINARY_FRAME_HEADER_BYTES,
    BINARY_FRAME_KIND_ACTION_BATCH,
    BINARY_PROTOCOL_V1,
    BINARY_WIRE_MAGIC_B,
    BINARY_WIRE_MAGIC_Q,
} from './binary-wire';

type WireValue = null | boolean | number | string | WireValue[];

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

    writeU16(value: number): void {
        this.ensure(2);
        this.buffer[this.offset] = value & 0xff;
        this.buffer[this.offset + 1] = (value >>> 8) & 0xff;
        this.offset += 2;
    }

    writeU32(value: number): void {
        this.ensure(4);
        this.buffer[this.offset] = value & 0xff;
        this.buffer[this.offset + 1] = (value >>> 8) & 0xff;
        this.buffer[this.offset + 2] = (value >>> 16) & 0xff;
        this.buffer[this.offset + 3] = (value >>> 24) & 0xff;
        this.offset += 4;
    }

    writeI32(value: number): void {
        this.writeU32(value >>> 0);
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

    readU16(): number {
        this.require(2);
        const byte0 = this.bytes[this.offset] ?? 0;
        const byte1 = this.bytes[this.offset + 1] ?? 0;
        this.offset += 2;
        return byte0 | (byte1 << 8);
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

    readI32(): number {
        return this.readU32() | 0;
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

function msgpackWriteInt(writer: ByteWriter, value: number): void {
    if (value >= 0 && value <= 0x7f) {
        writer.writeU8(value);
        return;
    }
    if (value >= -32 && value < 0) {
        writer.writeU8((0xe0 | (value + 32)) & 0xff);
        return;
    }
    if (value >= 0 && value <= 0xffff) {
        writer.writeU8(0xcd);
        writer.writeU16(value);
        return;
    }

    writer.writeU8(0xd2);
    writer.writeI32(value);
}

function msgpackEncodeValue(writer: ByteWriter, value: WireValue): void {
    if (value === null) {
        writer.writeU8(0xc0);
        return;
    }

    if (typeof value === 'boolean') {
        writer.writeU8(value ? 0xc3 : 0xc2);
        return;
    }

    if (typeof value === 'number') {
        if (Number.isInteger(value) && value >= -2_147_483_648 && value <= 2_147_483_647) {
            msgpackWriteInt(writer, value);
            return;
        }

        writer.writeU8(0xcb);
        writer.writeF64(value);
        return;
    }

    if (typeof value === 'string') {
        const bytes = TEXT_ENCODER.encode(value);
        if (bytes.length <= 31) {
            writer.writeU8(0xa0 | bytes.length);
        } else if (bytes.length <= 0xff) {
            writer.writeU8(0xd9);
            writer.writeU8(bytes.length);
        } else {
            writer.writeU8(0xda);
            writer.writeU16(bytes.length);
        }
        writer.writeBytes(bytes);
        return;
    }

    if (value.length <= 15) {
        writer.writeU8(0x90 | value.length);
    } else {
        writer.writeU8(0xdc);
        writer.writeU16(value.length);
    }
    for (const entry of value) {
        msgpackEncodeValue(writer, entry);
    }
}

function msgpackDecodeValue(reader: ByteReader): WireValue {
    const first = reader.readU8();

    if (first <= 0x7f) {
        return first;
    }
    if (first >= 0xe0) {
        return (first - 0x100) | 0;
    }
    if (first >= 0xa0 && first <= 0xbf) {
        return TEXT_DECODER.decode(reader.readBytes(first & 0x1f));
    }
    if (first >= 0x90 && first <= 0x9f) {
        const length = first & 0x0f;
        const out: WireValue[] = [];
        for (let i = 0; i < length; i += 1) {
            out.push(msgpackDecodeValue(reader));
        }
        return out;
    }

    if (first === 0xc0) {
        return null;
    }
    if (first === 0xc2) {
        return false;
    }
    if (first === 0xc3) {
        return true;
    }
    if (first === 0xcb) {
        return reader.readF64();
    }
    if (first === 0xcd) {
        return reader.readU16();
    }
    if (first === 0xd2) {
        return reader.readI32();
    }
    if (first === 0xd9) {
        return TEXT_DECODER.decode(reader.readBytes(reader.readU8()));
    }
    if (first === 0xda) {
        return TEXT_DECODER.decode(reader.readBytes(reader.readU16()));
    }
    if (first === 0xdc) {
        const length = reader.readU16();
        const out: WireValue[] = [];
        for (let i = 0; i < length; i += 1) {
            out.push(msgpackDecodeValue(reader));
        }
        return out;
    }

    throw new Error(`unsupported msgpack token: ${first}`);
}

function coerceInputToBytes(payload: ArrayBuffer | Uint8Array): Uint8Array {
    if (payload instanceof Uint8Array) {
        return payload;
    }
    return new Uint8Array(payload);
}

export function encodeBinaryActionBatchPayload(batch: ReadonlyArray<unknown>): Uint8Array {
    const payloadWriter = new ByteWriter();
    msgpackEncodeValue(payloadWriter, batch as WireValue);
    const payload = payloadWriter.toBytes();

    const frameWriter = new ByteWriter(BINARY_FRAME_HEADER_BYTES + payload.length);
    frameWriter.writeU8(BINARY_WIRE_MAGIC_B);
    frameWriter.writeU8(BINARY_WIRE_MAGIC_Q);
    frameWriter.writeU8(BINARY_PROTOCOL_V1);
    frameWriter.writeU8(BINARY_FRAME_KIND_ACTION_BATCH);
    frameWriter.writeU32(payload.length);
    frameWriter.writeBytes(payload);
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
    const decoded = msgpackDecodeValue(payloadReader);
    if (payloadReader.remaining() !== 0) {
        throw new Error('invalid payload trailing bytes');
    }
    return decoded;
}
