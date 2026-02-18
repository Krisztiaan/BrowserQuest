import {
    BINARY_FRAME_HEADER_BYTES,
    BINARY_FRAME_KIND_ACTION_BATCH,
    BINARY_PROTOCOL_V1,
    BINARY_WIRE_MAGIC_B,
    BINARY_WIRE_MAGIC_Q,
} from '../../shared/protocol/binary-wire';

type WireValue = null | boolean | number | string | WireValue[];
type WireBatch = WireValue[];

type CodecResult = {
    codec: string;
    encodeMs: number;
    decodeMs: number;
    totalBytes: number;
    avgBytes: number;
    p95Bytes: number;
};

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();
const FRAMES = 20_000;

const SERVER_SAMPLES: WireBatch[] = [
    [[32, 1], [4, 500000000, 158, 117]],
    [[31, 2, 'move.step', 'Invalid move.step (non-adjacent).'], [33, 2, 158, 117]],
    [7, 174, 500000000],
    [[15, 500000000, 155, 113], [10, 108], [10, 103]],
    [36, 7, 6, 0, '{"schemaVersion":1,"encoding":"json","chunkSize":32,"overrides":[]}'],
    [[2, 184, 2, 156, 117, 1], [4, 500000000, 155, 115], [10, 62, 1]],
];

const CLIENT_SAMPLES: WireBatch[] = [
    [1, 'bench', 2, 60],
    [11, 'benchmark chat payload'],
    [22],
    [26, 1, 'move.step', '{"x":155,"y":114}'],
    [26, 2, 'claim.create', '{"x1":10,"y1":10,"x2":12,"y2":12,"editors":["bob"]}'],
    [28, 184],
    [9, 184],
    [6, 155, 113, 174],
    [34, 8, 4, 3],
];

function cloneValue<T extends WireValue>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

function mutateNumber(value: number, frameIndex: number): number {
    if (!Number.isInteger(value)) {
        return value;
    }
    if (value > 1_000_000) {
        return value + (frameIndex % 9);
    }
    if (value > 100) {
        return value + (frameIndex % 5);
    }
    return value;
}

function mutateValue(value: WireValue, frameIndex: number): WireValue {
    if (Array.isArray(value)) {
        return value.map((entry) => mutateValue(entry, frameIndex));
    }
    if (typeof value === 'number') {
        return mutateNumber(value, frameIndex);
    }
    return value;
}

function buildFrameCorpus(): WireBatch[] {
    const corpus: WireBatch[] = [];
    const source = [...SERVER_SAMPLES, ...CLIENT_SAMPLES];

    for (let i = 0; i < FRAMES; i += 1) {
        const base = source[i % source.length] ?? source[0];
        if (!base) {
            throw new Error('benchmark corpus source is empty');
        }
        const cloned = cloneValue(base);
        const mutated = mutateValue(cloned, i);
        corpus.push(Array.isArray(mutated) ? mutated : [mutated]);
    }

    return corpus;
}

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

    bytes(): Uint8Array {
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
        const value = byte0 | (byte1 << 8);
        this.offset += 2;
        return value;
    }

    readU32(): number {
        this.require(4);
        const byte0 = this.bytes[this.offset] ?? 0;
        const byte1 = this.bytes[this.offset + 1] ?? 0;
        const byte2 = this.bytes[this.offset + 2] ?? 0;
        const byte3 = this.bytes[this.offset + 3] ?? 0;
        const value = byte0 | (byte1 << 8) | (byte2 << 16) | (byte3 << 24);
        this.offset += 4;
        return value >>> 0;
    }

    readI32(): number {
        const unsigned = this.readU32();
        return unsigned | 0;
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

const CUSTOM_TAG_NULL = 0x00;
const CUSTOM_TAG_FALSE = 0x01;
const CUSTOM_TAG_TRUE = 0x02;
const CUSTOM_TAG_INT32 = 0x10;
const CUSTOM_TAG_FLOAT64 = 0x11;
const CUSTOM_TAG_STRING = 0x20;
const CUSTOM_TAG_ARRAY = 0x30;

function customEncodeValue(writer: ByteWriter, value: WireValue): void {
    if (value === null) {
        writer.writeU8(CUSTOM_TAG_NULL);
        return;
    }

    if (typeof value === 'boolean') {
        writer.writeU8(value ? CUSTOM_TAG_TRUE : CUSTOM_TAG_FALSE);
        return;
    }

    if (typeof value === 'number') {
        if (Number.isInteger(value) && value >= -2_147_483_648 && value <= 2_147_483_647) {
            writer.writeU8(CUSTOM_TAG_INT32);
            writer.writeI32(value);
            return;
        }

        writer.writeU8(CUSTOM_TAG_FLOAT64);
        writer.writeF64(value);
        return;
    }

    if (typeof value === 'string') {
        writer.writeU8(CUSTOM_TAG_STRING);
        const bytes = TEXT_ENCODER.encode(value);
        writer.writeU16(bytes.length);
        writer.writeBytes(bytes);
        return;
    }

    writer.writeU8(CUSTOM_TAG_ARRAY);
    writer.writeU16(value.length);
    for (const entry of value) {
        customEncodeValue(writer, entry);
    }
}

function customDecodeValue(reader: ByteReader): WireValue {
    const tag = reader.readU8();
    if (tag === CUSTOM_TAG_NULL) {
        return null;
    }
    if (tag === CUSTOM_TAG_FALSE) {
        return false;
    }
    if (tag === CUSTOM_TAG_TRUE) {
        return true;
    }
    if (tag === CUSTOM_TAG_INT32) {
        return reader.readI32();
    }
    if (tag === CUSTOM_TAG_FLOAT64) {
        return reader.readF64();
    }
    if (tag === CUSTOM_TAG_STRING) {
        const bytes = reader.readBytes(reader.readU16());
        return TEXT_DECODER.decode(bytes);
    }
    if (tag === CUSTOM_TAG_ARRAY) {
        const length = reader.readU16();
        const out: WireValue[] = [];
        for (let i = 0; i < length; i += 1) {
            out.push(customDecodeValue(reader));
        }
        return out;
    }
    throw new Error(`unknown custom tag: ${tag}`);
}

function customEncodeBatch(batch: WireBatch): Uint8Array {
    const payloadWriter = new ByteWriter();
    customEncodeValue(payloadWriter, batch);
    const payload = payloadWriter.bytes();

    const frameWriter = new ByteWriter(BINARY_FRAME_HEADER_BYTES + payload.length);
    frameWriter.writeU8(BINARY_WIRE_MAGIC_B);
    frameWriter.writeU8(BINARY_WIRE_MAGIC_Q);
    frameWriter.writeU8(BINARY_PROTOCOL_V1);
    frameWriter.writeU8(BINARY_FRAME_KIND_ACTION_BATCH);
    frameWriter.writeU32(payload.length);
    frameWriter.writeBytes(payload);
    return frameWriter.bytes();
}

function customDecodeBatch(frame: Uint8Array): WireBatch {
    const reader = new ByteReader(frame);
    const magicB = reader.readU8();
    const magicQ = reader.readU8();
    const version = reader.readU8();
    const frameKind = reader.readU8();
    const payloadBytes = reader.readU32();

    if (magicB !== BINARY_WIRE_MAGIC_B || magicQ !== BINARY_WIRE_MAGIC_Q) {
        throw new Error('invalid custom frame magic');
    }
    if (version !== BINARY_PROTOCOL_V1) {
        throw new Error('invalid custom frame version');
    }
    if (frameKind !== BINARY_FRAME_KIND_ACTION_BATCH) {
        throw new Error('invalid custom frame kind');
    }

    const payload = reader.readBytes(payloadBytes);
    if (reader.remaining() !== 0) {
        throw new Error('invalid custom trailing bytes');
    }

    const payloadReader = new ByteReader(payload);
    const decoded = customDecodeValue(payloadReader);
    if (!Array.isArray(decoded) || payloadReader.remaining() !== 0) {
        throw new Error('invalid custom payload');
    }
    return decoded;
}

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

function msgpackReadValue(reader: ByteReader): WireValue {
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
            out.push(msgpackReadValue(reader));
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
    if (first === 0xd1) {
        return ((reader.readU16() << 16) >> 16) | 0;
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
            out.push(msgpackReadValue(reader));
        }
        return out;
    }

    throw new Error(`unsupported msgpack token: ${first}`);
}

function msgpackEncodeBatch(batch: WireBatch): Uint8Array {
    const writer = new ByteWriter();
    msgpackEncodeValue(writer, batch);
    return writer.bytes();
}

function msgpackDecodeBatch(bytes: Uint8Array): WireBatch {
    const reader = new ByteReader(bytes);
    const decoded = msgpackReadValue(reader);
    if (!Array.isArray(decoded) || reader.remaining() !== 0) {
        throw new Error('invalid msgpack batch');
    }
    return decoded;
}

function jsonEncodeBatch(batch: WireBatch): Uint8Array {
    return TEXT_ENCODER.encode(JSON.stringify(batch));
}

function jsonDecodeBatch(bytes: Uint8Array): WireBatch {
    const parsed = JSON.parse(TEXT_DECODER.decode(bytes)) as unknown;
    if (!Array.isArray(parsed)) {
        throw new Error('invalid json batch');
    }
    return parsed as WireBatch;
}

function p95(values: number[]): number {
    if (values.length === 0) {
        return 0;
    }
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1] ?? 0;
}

function benchmarkCodec(
    codec: string,
    frames: WireBatch[],
    encode: (frame: WireBatch) => Uint8Array,
    decode: (frame: Uint8Array) => WireBatch
): CodecResult {
    const encoded: Uint8Array[] = [];
    const byteSizes: number[] = [];

    const encodeStart = performance.now();
    for (const frame of frames) {
        const bytes = encode(frame);
        encoded.push(bytes);
        byteSizes.push(bytes.byteLength);
    }
    const encodeMs = performance.now() - encodeStart;

    const decodeStart = performance.now();
    for (let i = 0; i < encoded.length; i += 1) {
        const encodedFrame = encoded[i];
        if (!encodedFrame) {
            throw new Error(`missing encoded frame at index ${i}`);
        }
        const decoded = decode(encodedFrame);
        if (i < 100) {
            const original = frames[i];
            if (JSON.stringify(decoded) !== JSON.stringify(original)) {
                throw new Error(`${codec} roundtrip mismatch at frame ${i}`);
            }
        }
    }
    const decodeMs = performance.now() - decodeStart;

    const totalBytes = byteSizes.reduce((sum, size) => sum + size, 0);
    return {
        codec,
        encodeMs,
        decodeMs,
        totalBytes,
        avgBytes: totalBytes / frames.length,
        p95Bytes: p95(byteSizes),
    };
}

function printResults(results: CodecResult[], frames: number): void {
    console.log('Protocol Wire Benchmark');
    console.log(`frames: ${frames}`);
    console.log('');
    console.log('| codec | encode ms | decode ms | total bytes | avg bytes/frame | p95 bytes/frame |');
    console.log('|---|---:|---:|---:|---:|---:|');

    for (const result of results) {
        console.log(
            `| ${result.codec}`
                + ` | ${result.encodeMs.toFixed(2)}`
                + ` | ${result.decodeMs.toFixed(2)}`
                + ` | ${result.totalBytes}`
                + ` | ${result.avgBytes.toFixed(2)}`
                + ` | ${result.p95Bytes.toFixed(2)} |`
        );
    }

    const baseline = results.find((entry) => entry.codec === 'json');
    if (!baseline) {
        return;
    }

    console.log('');
    console.log('Relative vs json baseline');
    for (const result of results) {
        if (result.codec === 'json') {
            continue;
        }
        const bytesDeltaPct = ((result.totalBytes - baseline.totalBytes) / baseline.totalBytes) * 100;
        const encodeDeltaPct = ((result.encodeMs - baseline.encodeMs) / baseline.encodeMs) * 100;
        const decodeDeltaPct = ((result.decodeMs - baseline.decodeMs) / baseline.decodeMs) * 100;
        console.log(
            `${result.codec}: bytes ${bytesDeltaPct.toFixed(2)}%,`
                + ` encode ${encodeDeltaPct.toFixed(2)}%,`
                + ` decode ${decodeDeltaPct.toFixed(2)}%`
        );
    }
}

function main(): void {
    const frames = buildFrameCorpus();
    const results = [
        benchmarkCodec('json', frames, jsonEncodeBatch, jsonDecodeBatch),
        benchmarkCodec('msgpack-subset', frames, msgpackEncodeBatch, msgpackDecodeBatch),
        benchmarkCodec('binary-v1-custom', frames, customEncodeBatch, customDecodeBatch),
    ];

    printResults(results, frames.length);
}

main();
