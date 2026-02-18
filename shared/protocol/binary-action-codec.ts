import {
    BINARY_FRAME_HEADER_BYTES,
    BINARY_FRAME_KIND_ACTION_BATCH,
    BINARY_PROTOCOL_VERSION,
    BINARY_WIRE_MAGIC_B,
    BINARY_WIRE_MAGIC_Q,
} from './binary-wire';

type WireAction = readonly [number, ...unknown[]];
type WireBatchLike = ReadonlyArray<unknown>;
type WireValue = null | boolean | number | string | WireValue[];

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

const TAG_NULL = 0x00;
const TAG_FALSE = 0x01;
const TAG_TRUE = 0x02;
const TAG_INT32 = 0x03;
const TAG_FLOAT64 = 0x04;
const TAG_STRING = 0x05;
const TAG_ARRAY = 0x06;
const TAG_INT32_ARRAY = 0x07;
const TAG_STATIC_STRING = 0x08;

const STATIC_STRINGS = [
    'move.step',
    'Invalid move.step (non-adjacent).',
    'move.step queue full.',
    'claim.create',
    'claim.expand',
    'claim.editors',
    'claim.delete',
    'claim.owner',
    'claim.error',
    'claim.denied',
    'claim.conflict',
    'claim.ok',
    'teleport.door',
] as const;

const STATIC_STRING_TO_ID = new Map<string, number>(STATIC_STRINGS.map((value, index) => [value, index]));

class ByteWriter {
    private buffer: Uint8Array;
    private view: DataView;
    private offset: number;

    constructor(initialCapacity = 128) {
        this.buffer = new Uint8Array(initialCapacity);
        this.view = new DataView(this.buffer.buffer);
        this.offset = 0;
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
        this.view = new DataView(this.buffer.buffer);
    }

    writeU8(value: number): void {
        this.ensure(1);
        this.buffer[this.offset] = value & 0xff;
        this.offset += 1;
    }

    writeVarUint(value: number): void {
        if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
            throw new Error('invalid varuint');
        }

        let remaining = value >>> 0;
        while (remaining >= 0x80) {
            this.writeU8((remaining & 0x7f) | 0x80);
            remaining >>>= 7;
        }
        this.writeU8(remaining);
    }

    writeF64(value: number): void {
        this.ensure(8);
        this.view.setFloat64(this.offset, value, true);
        this.offset += 8;
    }

    writeBytes(bytes: Uint8Array): void {
        this.ensure(bytes.length);
        this.buffer.set(bytes, this.offset);
        this.offset += bytes.length;
    }

    toUint8Array(): Uint8Array {
        return this.buffer.slice(0, this.offset);
    }
}

class ByteReader {
    private offset = 0;
    private readonly view: DataView;

    constructor(private readonly bytes: Uint8Array) {
        this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    }

    private require(neededBytes: number): void {
        if (this.offset + neededBytes > this.bytes.length) {
            throw new Error('decode overflow');
        }
    }

    readU8(): number {
        this.require(1);
        const value = this.bytes[this.offset] ?? 0;
        this.offset += 1;
        return value;
    }

    readVarUint(): number {
        let shift = 0;
        let value = 0;
        while (shift < 35) {
            const byte = this.readU8();
            value |= (byte & 0x7f) << shift;
            if ((byte & 0x80) === 0) {
                return value >>> 0;
            }
            shift += 7;
        }
        throw new Error('varuint overflow');
    }

    readF64(): number {
        this.require(8);
        const value = this.view.getFloat64(this.offset, true);
        this.offset += 8;
        return value;
    }

    readBytes(length: number): Uint8Array {
        this.require(length);
        const value = this.bytes.subarray(this.offset, this.offset + length);
        this.offset += length;
        return value;
    }

    remaining(): number {
        return this.bytes.length - this.offset;
    }
}

function isSafeInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value);
}

function isInt32(value: number): boolean {
    return value >= -2_147_483_648 && value <= 2_147_483_647;
}

function isInt32Number(value: unknown): value is number {
    return isSafeInteger(value) && isInt32(value);
}

function zigZagEncodeInt32(value: number): number {
    return ((value << 1) ^ (value >> 31)) >>> 0;
}

function zigZagDecodeInt32(value: number): number {
    return (value >>> 1) ^ -(value & 1);
}

function coerceInputToBytes(payload: ArrayBuffer | Uint8Array): Uint8Array {
    if (payload instanceof Uint8Array) {
        return payload;
    }
    return new Uint8Array(payload);
}

function readUint32Le(bytes: Uint8Array, offset: number): number {
    if (offset + 4 > bytes.length) {
        throw new Error('decode overflow');
    }
    return (
        (bytes[offset] ?? 0)
        | ((bytes[offset + 1] ?? 0) << 8)
        | ((bytes[offset + 2] ?? 0) << 16)
        | ((bytes[offset + 3] ?? 0) << 24)
    ) >>> 0;
}

function writeUint32Le(bytes: Uint8Array, offset: number, value: number): void {
    bytes[offset] = value & 0xff;
    bytes[offset + 1] = (value >>> 8) & 0xff;
    bytes[offset + 2] = (value >>> 16) & 0xff;
    bytes[offset + 3] = (value >>> 24) & 0xff;
}

function encodeString(writer: ByteWriter, value: string): void {
    const staticId = STATIC_STRING_TO_ID.get(value);
    if (staticId !== undefined) {
        writer.writeU8(TAG_STATIC_STRING);
        writer.writeVarUint(staticId);
        return;
    }

    const encoded = TEXT_ENCODER.encode(value);
    writer.writeU8(TAG_STRING);
    writer.writeVarUint(encoded.length);
    writer.writeBytes(encoded);
}

function decodeString(reader: ByteReader, tag: number): string {
    if (tag === TAG_STATIC_STRING) {
        const staticId = reader.readVarUint();
        const value = STATIC_STRINGS[staticId];
        if (value === undefined) {
            throw new Error('invalid static string id');
        }
        return value;
    }

    const length = reader.readVarUint();
    return TEXT_DECODER.decode(reader.readBytes(length));
}

function encodeArray(writer: ByteWriter, value: WireValue[]): void {
    let allInt32 = true;
    for (let i = 0; i < value.length; i += 1) {
        if (!isInt32Number(value[i])) {
            allInt32 = false;
            break;
        }
    }

    if (allInt32) {
        writer.writeU8(TAG_INT32_ARRAY);
        writer.writeVarUint(value.length);
        for (let i = 0; i < value.length; i += 1) {
            writer.writeVarUint(zigZagEncodeInt32(value[i] as number));
        }
        return;
    }

    writer.writeU8(TAG_ARRAY);
    writer.writeVarUint(value.length);
    for (let i = 0; i < value.length; i += 1) {
        const entry = value[i];
        if (entry === undefined) {
            throw new Error('invalid array entry');
        }
        encodeValue(writer, entry);
    }
}

function decodeArray(reader: ByteReader, tag: number): WireValue[] {
    const length = reader.readVarUint();
    const out: WireValue[] = [];
    if (tag === TAG_INT32_ARRAY) {
        for (let i = 0; i < length; i += 1) {
            out.push(zigZagDecodeInt32(reader.readVarUint()));
        }
        return out;
    }

    for (let i = 0; i < length; i += 1) {
        out.push(decodeValue(reader));
    }
    return out;
}

function encodeValue(writer: ByteWriter, value: WireValue): void {
    if (value === null) {
        writer.writeU8(TAG_NULL);
        return;
    }
    if (value === false) {
        writer.writeU8(TAG_FALSE);
        return;
    }
    if (value === true) {
        writer.writeU8(TAG_TRUE);
        return;
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            throw new Error('invalid non-finite number');
        }

        if (isInt32(value)) {
            writer.writeU8(TAG_INT32);
            writer.writeVarUint(zigZagEncodeInt32(value));
            return;
        }

        writer.writeU8(TAG_FLOAT64);
        writer.writeF64(value);
        return;
    }
    if (typeof value === 'string') {
        encodeString(writer, value);
        return;
    }
    if (Array.isArray(value)) {
        encodeArray(writer, value);
        return;
    }

    throw new Error('invalid protocol value');
}

function decodeValue(reader: ByteReader): WireValue {
    const tag = reader.readU8();

    if (tag === TAG_NULL) {
        return null;
    }
    if (tag === TAG_FALSE) {
        return false;
    }
    if (tag === TAG_TRUE) {
        return true;
    }
    if (tag === TAG_INT32) {
        return zigZagDecodeInt32(reader.readVarUint());
    }
    if (tag === TAG_FLOAT64) {
        return reader.readF64();
    }
    if (tag === TAG_STRING || tag === TAG_STATIC_STRING) {
        return decodeString(reader, tag);
    }
    if (tag === TAG_ARRAY || tag === TAG_INT32_ARRAY) {
        return decodeArray(reader, tag);
    }

    throw new Error(`invalid tag: ${tag}`);
}

function isWireAction(value: unknown): value is WireAction {
    if (!Array.isArray(value) || value.length === 0) {
        return false;
    }
    const opcode = value[0];
    return isSafeInteger(opcode) && opcode >= 0;
}

function coerceBatchPayloadInput(root: WireBatchLike): ReadonlyArray<unknown> {
    const first = root[0];
    if (Array.isArray(first)) {
        return root;
    }
    return [root as unknown];
}

function encodeActionBatchPayload(actions: ReadonlyArray<unknown>): Uint8Array {
    const writer = new ByteWriter();
    writer.writeVarUint(actions.length);
    for (let i = 0; i < actions.length; i += 1) {
        const action = actions[i];
        if (!action) {
            throw new Error('missing action');
        }
        encodeValue(writer, action as unknown as WireValue);
    }
    return writer.toUint8Array();
}

function decodeActionBatchPayload(payloadBody: Uint8Array, validateActions: boolean): unknown[][] {
    const reader = new ByteReader(payloadBody);
    const count = reader.readVarUint();
    const out: unknown[][] = [];

    for (let i = 0; i < count; i += 1) {
        const action = decodeValue(reader);
        if (validateActions && !isWireAction(action)) {
            throw new Error('invalid decoded action payload');
        }
        out.push(action as unknown[]);
    }

    if (reader.remaining() !== 0) {
        throw new Error('trailing payload bytes');
    }

    return out;
}

function wrapFrame(payloadBody: Uint8Array): Uint8Array {
    const frame = new Uint8Array(BINARY_FRAME_HEADER_BYTES + payloadBody.length);
    frame[0] = BINARY_WIRE_MAGIC_B;
    frame[1] = BINARY_WIRE_MAGIC_Q;
    frame[2] = BINARY_PROTOCOL_VERSION;
    frame[3] = BINARY_FRAME_KIND_ACTION_BATCH;
    writeUint32Le(frame, 4, payloadBody.length);
    frame.set(payloadBody, BINARY_FRAME_HEADER_BYTES);
    return frame;
}

function unwrapFrame(payload: ArrayBuffer | Uint8Array): Uint8Array {
    const frame = coerceInputToBytes(payload);
    if (frame.length < BINARY_FRAME_HEADER_BYTES) {
        throw new Error('frame too short');
    }

    const magicB = frame[0];
    const magicQ = frame[1];
    const version = frame[2];
    const frameKind = frame[3];
    const payloadLength = readUint32Le(frame, 4);

    if (magicB !== BINARY_WIRE_MAGIC_B || magicQ !== BINARY_WIRE_MAGIC_Q) {
        throw new Error('invalid frame magic');
    }
    if (version !== BINARY_PROTOCOL_VERSION) {
        throw new Error('unsupported frame version');
    }
    if (frameKind !== BINARY_FRAME_KIND_ACTION_BATCH) {
        throw new Error('unsupported frame kind');
    }

    const expectedFrameLength = BINARY_FRAME_HEADER_BYTES + payloadLength;
    if (expectedFrameLength !== frame.length) {
        throw new Error('invalid frame length');
    }

    return frame.subarray(BINARY_FRAME_HEADER_BYTES);
}

export function encodeClientToServerBinaryActionBatchPayload(batch: WireBatchLike): Uint8Array {
    return wrapFrame(encodeActionBatchPayload(coerceBatchPayloadInput(batch)));
}

export function encodeServerToClientBinaryActionBatchPayload(batch: WireBatchLike): Uint8Array {
    return wrapFrame(encodeActionBatchPayload(coerceBatchPayloadInput(batch)));
}

export function encodeBinaryActionBatchPayload(batch: WireBatchLike): Uint8Array {
    return wrapFrame(encodeActionBatchPayload(coerceBatchPayloadInput(batch)));
}

export function decodeClientToServerBinaryActionBatchPayload(payload: ArrayBuffer | Uint8Array): unknown[] {
    return decodeActionBatchPayload(unwrapFrame(payload), false);
}

export function decodeServerToClientBinaryActionBatchPayload(payload: ArrayBuffer | Uint8Array): unknown[] {
    return decodeActionBatchPayload(unwrapFrame(payload), false);
}

export function decodeBinaryActionBatchPayload(payload: ArrayBuffer | Uint8Array): unknown {
    const actions = decodeActionBatchPayload(unwrapFrame(payload), true);
    if (actions.length === 1) {
        return actions[0] ?? [];
    }
    return actions;
}
