import { decode as decodeMsgpack, encode as encodeMsgpack } from '@msgpack/msgpack';
import {
    BINARY_FRAME_HEADER_BYTES,
    BINARY_FRAME_KIND_ACTION_BATCH,
    BINARY_PROTOCOL_V1,
    BINARY_WIRE_MAGIC_B,
    BINARY_WIRE_MAGIC_Q,
} from './binary-wire';

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

export function encodeBinaryActionBatchPayload(batch: ReadonlyArray<unknown>): Uint8Array {
    const payload = encodeMsgpack(batch);
    const frame = new Uint8Array(BINARY_FRAME_HEADER_BYTES + payload.length);
    frame[0] = BINARY_WIRE_MAGIC_B;
    frame[1] = BINARY_WIRE_MAGIC_Q;
    frame[2] = BINARY_PROTOCOL_V1;
    frame[3] = BINARY_FRAME_KIND_ACTION_BATCH;
    writeUint32Le(frame, 4, payload.length);
    frame.set(payload, BINARY_FRAME_HEADER_BYTES);
    return frame;
}

export function decodeBinaryActionBatchPayload(payload: ArrayBuffer | Uint8Array): unknown {
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
    if (version !== BINARY_PROTOCOL_V1) {
        throw new Error('unsupported frame version');
    }
    if (frameKind !== BINARY_FRAME_KIND_ACTION_BATCH) {
        throw new Error('unsupported frame kind');
    }

    const expectedFrameLength = BINARY_FRAME_HEADER_BYTES + payloadLength;
    if (expectedFrameLength !== frame.length) {
        throw new Error('invalid frame length');
    }

    const body = frame.slice(BINARY_FRAME_HEADER_BYTES);
    return decodeMsgpack(body);
}
