import { gridPos, type GridPos } from '../domain/positions';

export const INTENT_MOVE_STEP = 'move.step' as const;
export const INTENT_MOVE_TO = 'move.to' as const;
export const INTENT_MOVE_INPUT = 'move.input' as const;
export const INTENT_DOOR_TELEPORT = 'door.teleport' as const;
export const INTENT_TILE_EDIT = 'tile.edit' as const;
export const INTENT_CLAIM_CREATE = 'claim.create' as const;
export const INTENT_CLAIM_UPDATE = 'claim.update' as const;
export const INTENT_CLAIM_DELETE = 'claim.delete' as const;

export const OUTCOME_DOOR_TELEPORT = 'teleport.door' as const;

export type CoreIntentTypeId =
    | typeof INTENT_MOVE_STEP
    | typeof INTENT_MOVE_TO
    | typeof INTENT_MOVE_INPUT
    | typeof INTENT_DOOR_TELEPORT
    | typeof INTENT_TILE_EDIT
    | typeof INTENT_CLAIM_CREATE
    | typeof INTENT_CLAIM_UPDATE
    | typeof INTENT_CLAIM_DELETE;

export type IntentPayloadBytes = ReadonlyArray<number> | Uint8Array;

export type MoveStepIntentPayload = GridPos;
export type MoveToIntentPayload = Readonly<{ x: number; y: number; stopAdjacentToTarget: boolean }>;
export type MoveInputIntentPayload = Readonly<{ keysMask: number }>;
export type DoorTeleportIntentPayload = GridPos;
export type TileEditIntentPayload = Readonly<{ x: number; y: number; value: number | null }>;
export type ClaimCreateIntentPayload = Readonly<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    editors: ReadonlyArray<string>;
}>;
export type ClaimUpdateIntentPayload = Readonly<{
    id: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    editors?: ReadonlyArray<string>;
}>;
export type ClaimDeleteIntentPayload = Readonly<{ id: number }>;

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder('utf-8', { fatal: true });

const I32_MIN = -2_147_483_648;
const I32_MAX = 2_147_483_647;
const U16_MAX = 0xffff;

const MOVE_TO_FLAG_STOP_ADJACENT = 1 << 0;
const MOVE_TO_FLAGS_ALLOWED = MOVE_TO_FLAG_STOP_ADJACENT;

export const MOVE_INPUT_KEY_W = 1 << 0;
export const MOVE_INPUT_KEY_A = 1 << 1;
export const MOVE_INPUT_KEY_S = 1 << 2;
export const MOVE_INPUT_KEY_D = 1 << 3;
const MOVE_INPUT_KEYS_ALLOWED = MOVE_INPUT_KEY_W | MOVE_INPUT_KEY_A | MOVE_INPUT_KEY_S | MOVE_INPUT_KEY_D;

function isByte(value: unknown): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 0xff;
}

function toByteArray(payload: unknown): Uint8Array | null {
    if (payload instanceof Uint8Array) {
        return payload;
    }
    if (!Array.isArray(payload)) {
        return null;
    }
    const list: unknown[] = payload;
    const bytes = new Uint8Array(list.length);
    for (let i = 0; i < list.length; i += 1) {
        const value = list[i];
        if (!isByte(value)) {
            return null;
        }
        bytes[i] = value;
    }
    return bytes;
}

function isI32(value: number): boolean {
    return Number.isSafeInteger(value) && value >= I32_MIN && value <= I32_MAX;
}

function pushU8(bytes: number[], value: number): void {
    bytes.push(value & 0xff);
}

function pushU16(bytes: number[], value: number): void {
    bytes.push(value & 0xff, (value >>> 8) & 0xff);
}

function pushI32(bytes: number[], value: number): void {
    const view = new DataView(new ArrayBuffer(4));
    view.setInt32(0, value, true);
    bytes.push(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
}

function encodeEditors(bytes: number[], editors: ReadonlyArray<string>): boolean {
    if (editors.length > U16_MAX) {
        return false;
    }
    pushU16(bytes, editors.length);
    for (let i = 0; i < editors.length; i += 1) {
        const value = editors[i];
        if (typeof value !== 'string') {
            return false;
        }
        const encoded = TEXT_ENCODER.encode(value);
        if (encoded.length > U16_MAX) {
            return false;
        }
        pushU16(bytes, encoded.length);
        for (let j = 0; j < encoded.length; j += 1) {
            bytes.push(encoded[j] ?? 0);
        }
    }
    return true;
}

function decodeEditors(reader: ByteReader): string[] | null {
    const count = reader.readU16();
    if (count === null) {
        return null;
    }
    const editors: string[] = [];
    for (let i = 0; i < count; i += 1) {
        const length = reader.readU16();
        if (length === null) {
            return null;
        }
        const raw = reader.readBytes(length);
        if (raw === null) {
            return null;
        }
        try {
            editors.push(TEXT_DECODER.decode(raw));
        } catch (_) {
            return null;
        }
    }
    return editors;
}

class ByteReader {
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

    readU16(): number | null {
        if (this.offset + 2 > this.bytes.length) {
            return null;
        }
        const b0 = this.bytes[this.offset] ?? 0;
        const b1 = this.bytes[this.offset + 1] ?? 0;
        this.offset += 2;
        return b0 | (b1 << 8);
    }

    readI32(): number | null {
        if (this.offset + 4 > this.bytes.length) {
            return null;
        }
        const value = new DataView(this.bytes.buffer, this.bytes.byteOffset, this.bytes.byteLength).getInt32(this.offset, true);
        this.offset += 4;
        return value;
    }

    readBytes(length: number): Uint8Array | null {
        if (this.offset + length > this.bytes.length) {
            return null;
        }
        const value = this.bytes.slice(this.offset, this.offset + length);
        this.offset += length;
        return value;
    }

    isDone(): boolean {
        return this.offset === this.bytes.length;
    }
}

function decodeGridPosPayload(payload: IntentPayloadBytes): GridPos | null {
    const bytes = toByteArray(payload);
    if (bytes?.length !== 8) {
        return null;
    }
    const reader = new ByteReader(bytes);
    const x = reader.readI32();
    const y = reader.readI32();
    if (x === null || y === null || !reader.isDone()) {
        return null;
    }
    return gridPos(x, y);
}

function encodeGridPosPayload(payload: Readonly<{ x: number; y: number }>): number[] | null {
    if (!isI32(payload.x) || !isI32(payload.y)) {
        return null;
    }
    const bytes: number[] = [];
    pushI32(bytes, payload.x);
    pushI32(bytes, payload.y);
    return bytes;
}

export function encodeMoveStepIntentPayload(payload: MoveStepIntentPayload): number[] | null {
    return encodeGridPosPayload(payload);
}

export function decodeMoveStepIntentPayload(payload: IntentPayloadBytes): MoveStepIntentPayload | null {
    return decodeGridPosPayload(payload);
}

export function encodeMoveToIntentPayload(payload: MoveToIntentPayload): number[] | null {
    const base = encodeGridPosPayload(payload);
    if (!base) {
        return null;
    }
    pushU8(base, payload.stopAdjacentToTarget ? MOVE_TO_FLAG_STOP_ADJACENT : 0);
    return base;
}

export function decodeMoveToIntentPayload(payload: IntentPayloadBytes): MoveToIntentPayload | null {
    const bytes = toByteArray(payload);
    if (bytes?.length !== 9) {
        return null;
    }
    const reader = new ByteReader(bytes);
    const x = reader.readI32();
    const y = reader.readI32();
    const flags = reader.readU8();
    if (x === null || y === null || flags === null || !reader.isDone()) {
        return null;
    }
    if ((flags & ~MOVE_TO_FLAGS_ALLOWED) !== 0) {
        return null;
    }
    return { x, y, stopAdjacentToTarget: (flags & MOVE_TO_FLAG_STOP_ADJACENT) !== 0 };
}

export function encodeMoveInputIntentPayload(payload: MoveInputIntentPayload): number[] | null {
    const keysMask = payload.keysMask;
    if (!isByte(keysMask) || (keysMask & ~MOVE_INPUT_KEYS_ALLOWED) !== 0) {
        return null;
    }
    return [keysMask & 0xff];
}

export function decodeMoveInputIntentPayload(payload: IntentPayloadBytes): MoveInputIntentPayload | null {
    const bytes = toByteArray(payload);
    if (bytes?.length !== 1) {
        return null;
    }
    const keysMask = bytes[0] ?? 0;
    if ((keysMask & ~MOVE_INPUT_KEYS_ALLOWED) !== 0) {
        return null;
    }
    return { keysMask };
}

export function encodeDoorTeleportIntentPayload(payload: DoorTeleportIntentPayload): number[] | null {
    return encodeGridPosPayload(payload);
}

export function decodeDoorTeleportIntentPayload(payload: IntentPayloadBytes): DoorTeleportIntentPayload | null {
    return decodeGridPosPayload(payload);
}

export function encodeTileEditIntentPayload(payload: TileEditIntentPayload): number[] | null {
    if (!isI32(payload.x) || !isI32(payload.y)) {
        return null;
    }
    if (payload.value !== null && (!isI32(payload.value) || payload.value < 0)) {
        return null;
    }

    const bytes: number[] = [];
    pushI32(bytes, payload.x);
    pushI32(bytes, payload.y);
    if (payload.value === null) {
        pushU8(bytes, 0);
        return bytes;
    }
    pushU8(bytes, 1);
    pushI32(bytes, payload.value);
    return bytes;
}

export function decodeTileEditIntentPayload(payload: IntentPayloadBytes): TileEditIntentPayload | null {
    const bytes = toByteArray(payload);
    if (!bytes) {
        return null;
    }
    const reader = new ByteReader(bytes);
    const x = reader.readI32();
    const y = reader.readI32();
    const hasValue = reader.readU8();
    if (x === null || y === null || hasValue === null) {
        return null;
    }
    if (hasValue === 0) {
        return reader.isDone() ? { x, y, value: null } : null;
    }
    if (hasValue !== 1) {
        return null;
    }
    const value = reader.readI32();
    if (value === null || value < 0 || !reader.isDone()) {
        return null;
    }
    return { x, y, value };
}

export function encodeClaimCreateIntentPayload(payload: ClaimCreateIntentPayload): number[] | null {
    if (![payload.x1, payload.y1, payload.x2, payload.y2].every(isI32)) {
        return null;
    }
    const bytes: number[] = [];
    pushI32(bytes, payload.x1);
    pushI32(bytes, payload.y1);
    pushI32(bytes, payload.x2);
    pushI32(bytes, payload.y2);
    if (!encodeEditors(bytes, payload.editors)) {
        return null;
    }
    return bytes;
}

export function decodeClaimCreateIntentPayload(payload: IntentPayloadBytes): ClaimCreateIntentPayload | null {
    const bytes = toByteArray(payload);
    if (!bytes) {
        return null;
    }
    const reader = new ByteReader(bytes);
    const x1 = reader.readI32();
    const y1 = reader.readI32();
    const x2 = reader.readI32();
    const y2 = reader.readI32();
    const editors = decodeEditors(reader);
    if (x1 === null || y1 === null || x2 === null || y2 === null || editors === null || !reader.isDone()) {
        return null;
    }
    return { x1, y1, x2, y2, editors };
}

export function encodeClaimUpdateIntentPayload(payload: ClaimUpdateIntentPayload): number[] | null {
    if (!isI32(payload.id) || payload.id <= 0 || ![payload.x1, payload.y1, payload.x2, payload.y2].every(isI32)) {
        return null;
    }
    const bytes: number[] = [];
    pushI32(bytes, payload.id);
    pushI32(bytes, payload.x1);
    pushI32(bytes, payload.y1);
    pushI32(bytes, payload.x2);
    pushI32(bytes, payload.y2);
    if (payload.editors === undefined) {
        pushU8(bytes, 0);
        return bytes;
    }
    pushU8(bytes, 1);
    if (!encodeEditors(bytes, payload.editors)) {
        return null;
    }
    return bytes;
}

export function decodeClaimUpdateIntentPayload(payload: IntentPayloadBytes): ClaimUpdateIntentPayload | null {
    const bytes = toByteArray(payload);
    if (!bytes) {
        return null;
    }
    const reader = new ByteReader(bytes);
    const id = reader.readI32();
    const x1 = reader.readI32();
    const y1 = reader.readI32();
    const x2 = reader.readI32();
    const y2 = reader.readI32();
    const hasEditors = reader.readU8();
    if (id === null || x1 === null || y1 === null || x2 === null || y2 === null || hasEditors === null || id <= 0) {
        return null;
    }
    if (hasEditors === 0) {
        return reader.isDone() ? { id, x1, y1, x2, y2 } : null;
    }
    if (hasEditors !== 1) {
        return null;
    }
    const editors = decodeEditors(reader);
    if (editors === null || !reader.isDone()) {
        return null;
    }
    return { id, x1, y1, x2, y2, editors };
}

export function encodeClaimDeleteIntentPayload(payload: ClaimDeleteIntentPayload): number[] | null {
    if (!isI32(payload.id) || payload.id <= 0) {
        return null;
    }
    const bytes: number[] = [];
    pushI32(bytes, payload.id);
    return bytes;
}

export function decodeClaimDeleteIntentPayload(payload: IntentPayloadBytes): ClaimDeleteIntentPayload | null {
    const bytes = toByteArray(payload);
    if (bytes?.length !== 4) {
        return null;
    }
    const id = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getInt32(0, true);
    if (id <= 0) {
        return null;
    }
    return { id };
}
