import {
    BINARY_FRAME_HEADER_BYTES,
    BINARY_FRAME_KIND_ACTION_BATCH,
    BINARY_PROTOCOL_VERSION,
    BINARY_WIRE_MAGIC_B,
    BINARY_WIRE_MAGIC_Q,
} from './binary-wire';
import { ENTITY_KIND_DOMAIN } from '../entity-kind-domain';
import Types from '../gametypes-browser';
import {
    INTENT_ATTACK,
    INTENT_CHEST_TRANSFER,
    INTENT_CLAIM_CREATE,
    INTENT_CLAIM_DELETE,
    INTENT_CLAIM_UPDATE,
    INTENT_DOOR_TELEPORT,
    INTENT_CROP_HARVEST,
    INTENT_CROP_PLANT,
    INTENT_NPC_TALK,
    INTENT_RESOURCE_HARVEST,
    INTENT_SHOP_BUY,
    INTENT_SHOP_SELL,
    INTENT_MOVE_INPUT,
    INTENT_MOVE_STEP,
    INTENT_MOVE_TO,
    INTENT_TILE_EDIT,
    INTENT_TOOL_USE,
    OUTCOME_CHEST_TRANSFER,
    OUTCOME_DOOR_TELEPORT,
    OUTCOME_MAP_TRANSITION_BEGIN,
    OUTCOME_MAP_TRANSITION_COMMIT,
} from './intents';
import { CLIENT_TO_SERVER_PROTOCOL_MANIFEST, SERVER_TO_CLIENT_PROTOCOL_MANIFEST } from './manifest';

type WireAction = readonly [number, ...unknown[]];
type WireBatchLike = ReadonlyArray<unknown>;

type Direction = 0 | 1;
const DIR_CLIENT_TO_SERVER: Direction = 0;
const DIR_SERVER_TO_CLIENT: Direction = 1;

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder('utf-8', { fatal: false });

const POS20_MAX = 1023;

const SPAWN_FLAG_HAS_NAME = 1 << 0;
const SPAWN_FLAG_HAS_ORIENTATION = 1 << 1;
const SPAWN_FLAG_HAS_EQUIPMENT = 1 << 2;
const SPAWN_FLAG_HAS_TARGET = 1 << 3;
const SPAWN_FLAG_HAS_MAP_ID = 1 << 4;

const WIRE_INTENT_TYPE_IDS = [
    INTENT_MOVE_STEP,
    INTENT_DOOR_TELEPORT,
    INTENT_TILE_EDIT,
    INTENT_CLAIM_CREATE,
    INTENT_CLAIM_UPDATE,
    INTENT_CLAIM_DELETE,
    // Append-only: once shipped on the wire, never reorder.
    INTENT_MOVE_TO,
    INTENT_MOVE_INPUT,
    INTENT_ATTACK,
    INTENT_CHEST_TRANSFER,
    INTENT_TOOL_USE,
    INTENT_CROP_PLANT,
    INTENT_CROP_HARVEST,
    INTENT_RESOURCE_HARVEST,
    INTENT_NPC_TALK,
    INTENT_SHOP_BUY,
    INTENT_SHOP_SELL,
] as const;

const WIRE_OUTCOME_TYPE_IDS = [
    OUTCOME_DOOR_TELEPORT,
    OUTCOME_MAP_TRANSITION_BEGIN,
    OUTCOME_MAP_TRANSITION_COMMIT,
    OUTCOME_CHEST_TRANSFER,
] as const;

const WIRE_INTENT_TYPE_ID_TO_ID = new Map<string, number>(
    WIRE_INTENT_TYPE_IDS.map((value, index) => [value, index])
);

const WIRE_OUTCOME_TYPE_ID_TO_ID = new Map<string, number>(
    WIRE_OUTCOME_TYPE_IDS.map((value, index) => [value, index])
);

function encodeWireIntentTypeId(intentTypeId: unknown): number {
    if (typeof intentTypeId !== 'string') {
        throw new Error('invalid intent type');
    }
    const id = WIRE_INTENT_TYPE_ID_TO_ID.get(intentTypeId);
    if (id === undefined) {
        throw new Error(`unknown intent type: ${intentTypeId}`);
    }
    return id >>> 0;
}

function decodeWireIntentTypeId(id: number): string {
    const value = WIRE_INTENT_TYPE_IDS[id];
    if (value === undefined) {
        throw new Error('unknown intent type id');
    }
    return value;
}

function encodeWireOutcomeTypeId(outcomeTypeId: unknown): number {
    if (typeof outcomeTypeId !== 'string') {
        throw new Error('invalid outcome type');
    }
    const id = WIRE_OUTCOME_TYPE_ID_TO_ID.get(outcomeTypeId);
    if (id === undefined) {
        throw new Error(`unknown outcome type: ${outcomeTypeId}`);
    }
    return id >>> 0;
}

function decodeWireOutcomeTypeId(id: number): string {
    const value = WIRE_OUTCOME_TYPE_IDS[id];
    if (value === undefined) {
        throw new Error('unknown outcome type id');
    }
    return value;
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

class ByteWriter {
    private buffer: Uint8Array;
    private offset: number;

    constructor(initialCapacity = 256) {
        this.buffer = new Uint8Array(initialCapacity);
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
    }

    writeU8(value: number): void {
        this.ensure(1);
        this.buffer[this.offset] = value & 0xff;
        this.offset += 1;
    }

    writeBytes(bytes: Uint8Array): void {
        this.ensure(bytes.length);
        this.buffer.set(bytes, this.offset);
        this.offset += bytes.length;
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

    writeString(value: string): void {
        if (typeof value !== 'string') {
            throw new Error('invalid string');
        }
        const encoded = TEXT_ENCODER.encode(value);
        this.writeVarU32(encoded.length);
        this.writeBytes(encoded);
    }

    writePos20(x: number, y: number): void {
        if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x > POS20_MAX || y > POS20_MAX) {
            throw new Error(`invalid pos20: (${String(x)}, ${String(y)})`);
        }
        const packed = ((x & 0x3ff) | ((y & 0x3ff) << 10)) >>> 0;
        this.ensure(3);
        this.buffer[this.offset] = packed & 0xff;
        this.buffer[this.offset + 1] = (packed >>> 8) & 0xff;
        this.buffer[this.offset + 2] = (packed >>> 16) & 0xff;
        this.offset += 3;
    }

    writePosVarU32(x: number, y: number): void {
        // World-space fixed-point coords can exceed `pos20` (0..1023). Use varu32 for those.
        this.writeVarU32(x);
        this.writeVarU32(y);
    }

    toUint8Array(): Uint8Array {
        return this.buffer.slice(0, this.offset);
    }
}

class ByteReader {
    private offset = 0;

    constructor(private readonly bytes: Uint8Array) {}

    private require(neededBytes: number): void {
        if (this.offset + neededBytes > this.bytes.length) {
            throw new Error('decode overflow');
        }
    }

    readU8(): number {
        if (this.offset >= this.bytes.length) {
            throw new Error('decode overflow');
        }
        const value = this.bytes[this.offset] ?? 0;
        this.offset += 1;
        return value;
    }

    readBytes(length: number): Uint8Array {
        this.require(length);
        const value = this.bytes.subarray(this.offset, this.offset + length);
        this.offset += length;
        return value;
    }

    readVarU32(): number {
        const bytes = this.bytes;
        let offset = this.offset;
        let shift = 0;
        let value = 0;
        while (shift < 35) {
            if (offset >= bytes.length) {
                throw new Error('decode overflow');
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
        throw new Error('varu32 overflow');
    }

    readString(): string {
        const len = this.readVarU32();
        return TEXT_DECODER.decode(this.readBytes(len));
    }

    readPos20(): { x: number; y: number } {
        const b0 = this.readU8();
        const b1 = this.readU8();
        const b2 = this.readU8();
        const packed = (b0 | (b1 << 8) | (b2 << 16)) >>> 0;
        const x = packed & 0x3ff;
        const y = (packed >>> 10) & 0x3ff;
        return { x, y };
    }

    readPosVarU32(): { x: number; y: number } {
        const x = this.readVarU32();
        const y = this.readVarU32();
        return { x, y };
    }

    remaining(): number {
        return this.bytes.length - this.offset;
    }
}

const KIND_NAME_TO_ID = new Map<string, number>(
    Object.entries(ENTITY_KIND_DOMAIN).map(([name, [id]]) => [name, id])
);

const KIND_ID_TO_CATEGORY = new Map<number, string>(
    Object.values(ENTITY_KIND_DOMAIN).map(([id, category]) => [id, category])
);

const C2S_OPCODES = new Set<number>(CLIENT_TO_SERVER_PROTOCOL_MANIFEST.map((entry) => entry.opcode));
const S2C_OPCODES = new Set<number>(SERVER_TO_CLIENT_PROTOCOL_MANIFEST.map((entry) => entry.opcode));

function normalizeKindId(kind: unknown): number {
    if (typeof kind === 'number') {
        if (!Number.isInteger(kind) || kind < 0) {
            throw new Error('invalid kind id');
        }
        return kind >>> 0;
    }
    if (typeof kind === 'string') {
        const id = KIND_NAME_TO_ID.get(kind);
        if (id === undefined) {
            throw new Error('unknown kind');
        }
        return id >>> 0;
    }
    throw new Error('invalid kind');
}

function isKindCategory(kindId: number, category: string): boolean {
    return KIND_ID_TO_CATEGORY.get(kindId) === category;
}

function decodeSignedChunkCoord(encoded: number): number {
    // Chunk coordinates are written as 32-bit two's-complement via `>>> 0`.
    // Convert decoded varu32 back to signed int32 for runtime handlers.
    return encoded | 0;
}

function toByteArray(payload: unknown): Uint8Array {
    if (payload instanceof Uint8Array) {
        return payload;
    }
    if (!Array.isArray(payload)) {
        throw new Error('invalid byte array');
    }
    const list: unknown[] = payload;
    const out = new Uint8Array(list.length);
    for (let i = 0; i < list.length; i += 1) {
        const value = list[i];
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 0xff) {
            throw new Error('invalid byte');
        }
        out[i] = value;
    }
    return out;
}

function isWireAction(value: unknown): value is WireAction {
    return Array.isArray(value) && value.length > 0 && typeof value[0] === 'number';
}

function normalizeRoot(batch: WireBatchLike): WireAction[] {
    if (isWireAction(batch)) {
        return [batch];
    }
    const actions: WireAction[] = [];
    for (let i = 0; i < batch.length; i += 1) {
        const entry = batch[i];
        if (!isWireAction(entry)) {
            throw new Error('invalid action in batch');
        }
        actions.push(entry);
    }
    return actions;
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

function encodeClientToServerAction(writer: ByteWriter, action: WireAction): void {
    const opcode = action[0] >>> 0;
    writer.writeU8(opcode);

    switch (opcode) {
        case Types.Messages.HELLO: {
            const name = action[1];
            const armor = action[2];
            const weapon = action[3];
            const protocolRevision = action[4];
            const capabilitiesJson = action[5];
            const hasExtras = action.length === 6;

            writer.writeU8(hasExtras ? 1 : 0);
            writer.writeString(typeof name === 'string' ? name : '');
            writer.writeVarU32(normalizeKindId(armor));
            writer.writeVarU32(normalizeKindId(weapon));

            if (hasExtras) {
                if (typeof protocolRevision !== 'number' || !Number.isInteger(protocolRevision) || protocolRevision < 0) {
                    throw new Error('invalid protocolRevision');
                }
                if (typeof capabilitiesJson !== 'string') {
                    throw new Error('invalid capabilitiesJson');
                }
                writer.writeVarU32(protocolRevision >>> 0);
                writer.writeString(capabilitiesJson);
            }
            return;
        }
        case Types.Messages.LOOTMOVE: {
            const x = action[1];
            const y = action[2];
            const targetId = action[3];
            writer.writePos20(Number(x), Number(y));
            writer.writeVarU32(Number(targetId) >>> 0);
            return;
        }
        case Types.Messages.AGGRO:
        case Types.Messages.LOOT:
        case Types.Messages.OPEN:
        case Types.Messages.CHECK:
        case Types.Messages.ACHIEVEMENT: {
            const id = action[1];
            writer.writeVarU32(Number(id) >>> 0);
            return;
        }
        case Types.Messages.CHAT: {
            const message = action[1];
            if (typeof message !== 'string') {
                throw new Error('invalid chat message');
            }
            writer.writeString(message);
            return;
        }
        case Types.Messages.WHO: {
            const count = action.length - 1;
            if (count < 1) {
                throw new Error('invalid WHO count');
            }
            writer.writeVarU32(count);
            for (let i = 1; i < action.length; i += 1) {
                writer.writeVarU32(Number(action[i]) >>> 0);
            }
            return;
        }
        case Types.Messages.ZONE:
        case Types.Messages.CHUNK_UNSUBSCRIBE:
            return;
        case Types.Messages.INTENT: {
            const seq = action[1];
            const intentTypeId = action[2];
            const payloadBytes = action[3];
            if (typeof seq !== 'number' || !Number.isInteger(seq) || seq < 0) {
                throw new Error('invalid intent seq');
            }
            const intentTypeWireId = encodeWireIntentTypeId(intentTypeId);
            const bytes = toByteArray(payloadBytes);
            writer.writeVarU32(seq >>> 0);
            writer.writeVarU32(intentTypeWireId);
            writer.writeVarU32(bytes.length);
            writer.writeBytes(bytes);
            return;
        }
        case Types.Messages.CHUNK_SUBSCRIBE: {
            const chunkX = action[1];
            const chunkY = action[2];
            const radius = action[3];
            writer.writeVarU32(Number(chunkX) >>> 0);
            writer.writeVarU32(Number(chunkY) >>> 0);
            writer.writeVarU32(Number(radius) >>> 0);
            return;
        }
        default:
            throw new Error(`unknown c2s opcode: ${opcode}`);
    }
}

function encodeServerToClientAction(writer: ByteWriter, action: WireAction): void {
    const opcode = action[0] >>> 0;
    writer.writeU8(opcode);

    switch (opcode) {
        case Types.Messages.WELCOME: {
            const id = action[1];
            const name = action[2];
            const x = action[3];
            const y = action[4];
            const hp = action[5];
            const protocolRevision = action[6];
            const capabilitiesJson = action[7];
            const hasExtras = action.length === 8;

            writer.writeU8(hasExtras ? 1 : 0);
            writer.writeVarU32(Number(id) >>> 0);
            writer.writeString(typeof name === 'string' ? name : '');
            writer.writePos20(Number(x), Number(y));
            writer.writeVarU32(Number(hp) >>> 0);

            if (hasExtras) {
                if (typeof protocolRevision !== 'number' || !Number.isInteger(protocolRevision) || protocolRevision < 0) {
                    throw new Error('invalid protocolRevision');
                }
                if (typeof capabilitiesJson !== 'string') {
                    throw new Error('invalid capabilitiesJson');
                }
                writer.writeVarU32(protocolRevision >>> 0);
                writer.writeString(capabilitiesJson);
            }
            return;
        }
        case Types.Messages.SPAWN: {
            const id = action[1];
            const kind = action[2];
            const x = action[3];
            const y = action[4];
            writer.writeVarU32(Number(id) >>> 0);
            const kindId = normalizeKindId(kind);
            writer.writeVarU32(kindId);
            writer.writePos20(Number(x), Number(y));

            // Tail uses the existing snapshot encoding in shared/replication/spawn-snapshot.ts.
            // Player tail: [name, orientation, armor, weapon, target?]
            // Mob tail: [orientation, target?]
            // Simple: []
            let flags = 0;
            const tail = action.slice(5);

            if (isKindCategory(kindId, 'player')) {
                const maybeTail4 = tail[4];
                const maybeTail5 = tail[5];
                const targetId = typeof maybeTail4 === 'number' ? maybeTail4 : undefined;
                const mapId = typeof maybeTail5 === 'string'
                    ? maybeTail5
                    : (targetId === undefined && typeof maybeTail4 === 'string' ? maybeTail4 : undefined);
                flags |= SPAWN_FLAG_HAS_NAME | SPAWN_FLAG_HAS_ORIENTATION | SPAWN_FLAG_HAS_EQUIPMENT;
                if (typeof targetId === 'number') {
                    flags |= SPAWN_FLAG_HAS_TARGET;
                }
                if (typeof mapId === 'string') {
                    flags |= SPAWN_FLAG_HAS_MAP_ID;
                }
                writer.writeU8(flags);
                writer.writeString(typeof tail[0] === 'string' ? tail[0] : '');
                writer.writeVarU32(Number(tail[1]) >>> 0);
                writer.writeVarU32(normalizeKindId(tail[2]));
                writer.writeVarU32(normalizeKindId(tail[3]));
                if ((flags & SPAWN_FLAG_HAS_TARGET) !== 0) {
                    writer.writeVarU32(Number(targetId) >>> 0);
                }
                if ((flags & SPAWN_FLAG_HAS_MAP_ID) !== 0) {
                    writer.writeString(mapId as string);
                }
                return;
            }

            if (isKindCategory(kindId, 'mob')) {
                const maybeTail1 = tail[1];
                const maybeTail2 = tail[2];
                const targetId = typeof maybeTail1 === 'number' ? maybeTail1 : undefined;
                const mapId = typeof maybeTail2 === 'string'
                    ? maybeTail2
                    : (targetId === undefined && typeof maybeTail1 === 'string' ? maybeTail1 : undefined);
                flags |= SPAWN_FLAG_HAS_ORIENTATION;
                if (typeof targetId === 'number') {
                    flags |= SPAWN_FLAG_HAS_TARGET;
                }
                if (typeof mapId === 'string') {
                    flags |= SPAWN_FLAG_HAS_MAP_ID;
                }
                writer.writeU8(flags);
                writer.writeVarU32(Number(tail[0]) >>> 0);
                if ((flags & SPAWN_FLAG_HAS_TARGET) !== 0) {
                    writer.writeVarU32(Number(targetId) >>> 0);
                }
                if ((flags & SPAWN_FLAG_HAS_MAP_ID) !== 0) {
                    writer.writeString(mapId as string);
                }
                return;
            }

            if (typeof tail[0] === 'string') {
                flags |= SPAWN_FLAG_HAS_MAP_ID;
            }
            writer.writeU8(flags);
            if ((flags & SPAWN_FLAG_HAS_MAP_ID) !== 0) {
                writer.writeString(String(tail[0]));
            }
            return;
        }
        case Types.Messages.DESPAWN:
        case Types.Messages.DESTROY:
        case Types.Messages.HP:
        case Types.Messages.BLINK:
        case Types.Messages.ACK: {
            writer.writeVarU32(Number(action[1]) >>> 0);
            return;
        }
        case Types.Messages.MOVE: {
            const id = action[1];
            const x = action[2];
            const y = action[3];
            writer.writeVarU32(Number(id) >>> 0);
            writer.writePos20(Number(x), Number(y));
            return;
        }
        case Types.Messages.TELEPORT: {
            const id = action[1];
            const x = action[2];
            const y = action[3];
            const mapId = action[4];
            writer.writeVarU32(Number(id) >>> 0);
            writer.writePos20(Number(x), Number(y));
            if (typeof mapId !== 'string') {
                throw new Error('invalid teleport mapId');
            }
            writer.writeString(mapId);
            return;
        }
        case Types.Messages.LOOTMOVE:
        case Types.Messages.ATTACK:
        case Types.Messages.DAMAGE:
        case Types.Messages.POPULATION: {
            writer.writeVarU32(Number(action[1]) >>> 0);
            writer.writeVarU32(Number(action[2]) >>> 0);
            return;
        }
        case Types.Messages.HEALTH: {
            const points = action[1];
            const isRegen = action.length === 3 && action[2] === 1;
            writer.writeVarU32(Number(points) >>> 0);
            writer.writeU8(isRegen ? 1 : 0);
            return;
        }
        case Types.Messages.CHAT: {
            const id = action[1];
            const message = action[2];
            writer.writeVarU32(Number(id) >>> 0);
            if (typeof message !== 'string') {
                throw new Error('invalid chat message');
            }
            writer.writeString(message);
            return;
        }
        case Types.Messages.EQUIP: {
            const id = action[1];
            const itemKind = action[2];
            writer.writeVarU32(Number(id) >>> 0);
            writer.writeVarU32(normalizeKindId(itemKind));
            return;
        }
        case Types.Messages.DROP: {
            const mobId = action[1];
            const itemId = action[2];
            const itemKind = action[3];
            const haters = action[4];
            writer.writeVarU32(Number(mobId) >>> 0);
            writer.writeVarU32(Number(itemId) >>> 0);
            writer.writeVarU32(normalizeKindId(itemKind));
            if (!Array.isArray(haters)) {
                throw new Error('invalid haters');
            }
            writer.writeVarU32(haters.length);
            for (let i = 0; i < haters.length; i += 1) {
                writer.writeVarU32(Number(haters[i]) >>> 0);
            }
            return;
        }
        case Types.Messages.KILL: {
            const kind = action[1];
            writer.writeVarU32(normalizeKindId(kind));
            return;
        }
        case Types.Messages.LIST: {
            const count = action.length - 1;
            writer.writeVarU32(count);
            for (let i = 1; i < action.length; i += 1) {
                writer.writeVarU32(Number(action[i]) >>> 0);
            }
            return;
        }
        case Types.Messages.ACHIEVEMENTS: {
            const unlocked = action[1];
            if (!Array.isArray(unlocked)) {
                throw new Error('invalid unlocked ids');
            }
            writer.writeVarU32(unlocked.length);
            for (let i = 0; i < unlocked.length; i += 1) {
                writer.writeVarU32(Number(unlocked[i]) >>> 0);
            }
            for (let i = 2; i <= 6; i += 1) {
                writer.writeVarU32(Number(action[i]) >>> 0);
            }
            return;
        }
        case Types.Messages.OUTCOME:
        case Types.Messages.REJECT: {
            const seq = action[1];
            const a = action[2];
            const b = action[3];
            writer.writeVarU32(Number(seq) >>> 0);
            if (opcode === Types.Messages.OUTCOME) {
                writer.writeVarU32(encodeWireOutcomeTypeId(a));
                if (typeof b !== 'string') {
                    throw new Error('invalid outcome payload');
                }
                writer.writeString(b);
                return;
            }
            writer.writeVarU32(encodeWireIntentTypeId(a));
            if (typeof b !== 'string') {
                throw new Error('invalid reject reason');
            }
            writer.writeString(b);
            return;
        }
        case Types.Messages.CORRECTION: {
            const seq = action[1];
            const a = action[2];
            const b = action[3];
            const c = action[4];
            writer.writeVarU32(Number(seq) >>> 0);
            if (typeof a === 'number' && typeof b === 'number' && typeof c === 'string') {
                writer.writeU8(0);
                writer.writePos20(Number(a), Number(b));
                writer.writeString(c);
                return;
            }
            if (typeof a === 'string' && typeof b === 'string') {
                writer.writeU8(1);
                writer.writeString(a);
                writer.writeString(b);
                return;
            }
            throw new Error('invalid CORRECTION payload');
        }
        case Types.Messages.MOVE_SYNC: {
            const ackSeq = action[1];
            const x = action[2];
            const y = action[3];
            const tick = action[4];
            const flags = action[5];
            const mapId = action[6];
            writer.writeVarU32(Number(ackSeq) >>> 0);
            writer.writePosVarU32(Number(x), Number(y));
            writer.writeVarU32(Number(tick) >>> 0);
            writer.writeU8(Number(flags) >>> 0);
            if (typeof mapId !== 'string') {
                throw new Error('invalid move_sync mapId');
            }
            writer.writeString(mapId);
            return;
        }
        case Types.Messages.ENTITY_STATE_BATCH: {
            const tick = action[1];
            const count = action[2];
            writer.writeVarU32(Number(tick) >>> 0);
            writer.writeVarU32(Number(count) >>> 0);
            const base = 3;
            const expectedLen = base + Number(count) * 4;
            if (action.length !== expectedLen) {
                throw new Error('invalid ENTITY_STATE_BATCH payload');
            }
            for (let i = 0; i < Number(count); i += 1) {
                const offset = base + i * 4;
                writer.writeVarU32(Number(action[offset]) >>> 0); // id (wire)
                writer.writePosVarU32(Number(action[offset + 1]), Number(action[offset + 2])); // x,y
                writer.writeU8(Number(action[offset + 3]) >>> 0); // flags
            }
            return;
        }
        case Types.Messages.CHUNK_SNAPSHOT: {
            const chunkX = action[1];
            const chunkY = action[2];
            const version = action[3];
            const payloadBytes = action[4];
            writer.writeVarU32(Number(chunkX) >>> 0);
            writer.writeVarU32(Number(chunkY) >>> 0);
            writer.writeVarU32(Number(version) >>> 0);
            const bytes = toByteArray(payloadBytes);
            writer.writeVarU32(bytes.length);
            writer.writeBytes(bytes);
            return;
        }
        case Types.Messages.CHUNK_SNAPSHOT_PART: {
            const chunkX = action[1];
            const chunkY = action[2];
            const version = action[3];
            const partIndex = action[4];
            const partCount = action[5];
            const payloadBytes = action[6];
            writer.writeVarU32(Number(chunkX) >>> 0);
            writer.writeVarU32(Number(chunkY) >>> 0);
            writer.writeVarU32(Number(version) >>> 0);
            writer.writeVarU32(Number(partIndex) >>> 0);
            writer.writeVarU32(Number(partCount) >>> 0);
            const bytes = toByteArray(payloadBytes);
            writer.writeVarU32(bytes.length);
            writer.writeBytes(bytes);
            return;
        }
        case Types.Messages.CHUNK_DELTA: {
            const chunkX = action[1];
            const chunkY = action[2];
            const fromVersion = action[3];
            const toVersion = action[4];
            const payloadBytes = action[5];
            writer.writeVarU32(Number(chunkX) >>> 0);
            writer.writeVarU32(Number(chunkY) >>> 0);
            writer.writeVarU32(Number(fromVersion) >>> 0);
            writer.writeVarU32(Number(toVersion) >>> 0);
            const bytes = toByteArray(payloadBytes);
            writer.writeVarU32(bytes.length);
            writer.writeBytes(bytes);
            return;
        }
        default:
            throw new Error(`unknown s2c opcode: ${opcode}`);
    }
}

function encodeBatch(actions: WireAction[], direction: Direction): Uint8Array {
    const writer = new ByteWriter();
    writer.writeU8(direction);
    writer.writeVarU32(actions.length);

    if (direction === DIR_CLIENT_TO_SERVER) {
        for (let i = 0; i < actions.length; i += 1) {
            encodeClientToServerAction(writer, actions[i] as WireAction);
        }
    } else {
        for (let i = 0; i < actions.length; i += 1) {
            encodeServerToClientAction(writer, actions[i] as WireAction);
        }
    }

    return writer.toUint8Array();
}

function decodeClientToServerAction(reader: ByteReader): unknown[] {
    const opcode = reader.readU8();
    return decodeClientToServerActionFromOpcode(opcode, reader);
}

function decodeClientToServerActionFromOpcode(opcode: number, reader: ByteReader): unknown[] {
    switch (opcode) {
        case Types.Messages.HELLO: {
            const variant = reader.readU8();
            const name = reader.readString();
            const armor = reader.readVarU32();
            const weapon = reader.readVarU32();
            if (variant === 0) {
                return [opcode, name, armor, weapon];
            }
            if (variant === 1) {
                const protocolRevision = reader.readVarU32();
                const capabilitiesJson = reader.readString();
                return [opcode, name, armor, weapon, protocolRevision, capabilitiesJson];
            }
            throw new Error('invalid HELLO variant');
        }
        case Types.Messages.LOOTMOVE: {
            const pos = reader.readPos20();
            const targetId = reader.readVarU32();
            return [opcode, pos.x, pos.y, targetId];
        }
        case Types.Messages.AGGRO:
        case Types.Messages.LOOT:
        case Types.Messages.OPEN:
        case Types.Messages.CHECK:
        case Types.Messages.ACHIEVEMENT:
            return [opcode, reader.readVarU32()];
        case Types.Messages.CHAT:
            return [opcode, reader.readString()];
        case Types.Messages.WHO: {
            const count = reader.readVarU32();
            if (count < 1) {
                throw new Error('invalid WHO count');
            }
            const out: unknown[] = [opcode];
            for (let i = 0; i < count; i += 1) {
                out.push(reader.readVarU32());
            }
            return out;
        }
        case Types.Messages.ZONE:
        case Types.Messages.CHUNK_UNSUBSCRIBE:
            return [opcode];
        case Types.Messages.INTENT: {
            const seq = reader.readVarU32();
            const intentTypeId = decodeWireIntentTypeId(reader.readVarU32());
            const payloadLen = reader.readVarU32();
            const payload = reader.readBytes(payloadLen);
            return [opcode, seq, intentTypeId, payload];
        }
        case Types.Messages.CHUNK_SUBSCRIBE: {
            const chunkX = decodeSignedChunkCoord(reader.readVarU32());
            const chunkY = decodeSignedChunkCoord(reader.readVarU32());
            const radius = reader.readVarU32();
            return [opcode, chunkX, chunkY, radius];
        }
        default:
            throw new Error(`unknown c2s opcode: ${opcode}`);
    }
}

function decodeServerToClientAction(reader: ByteReader): unknown[] {
    const opcode = reader.readU8();
    return decodeServerToClientActionFromOpcode(opcode, reader);
}

function decodeServerToClientActionFromOpcode(opcode: number, reader: ByteReader): unknown[] {
    switch (opcode) {
        case Types.Messages.WELCOME: {
            const variant = reader.readU8();
            const id = reader.readVarU32();
            const name = reader.readString();
            const pos = reader.readPos20();
            const hp = reader.readVarU32();
            if (variant === 0) {
                return [opcode, id, name, pos.x, pos.y, hp];
            }
            if (variant === 1) {
                const protocolRevision = reader.readVarU32();
                const capabilitiesJson = reader.readString();
                return [opcode, id, name, pos.x, pos.y, hp, protocolRevision, capabilitiesJson];
            }
            throw new Error('invalid WELCOME variant');
        }
        case Types.Messages.SPAWN: {
            const id = reader.readVarU32();
            const kind = reader.readVarU32();
            const pos = reader.readPos20();
            const flags = reader.readU8();
            const out: unknown[] = [opcode, id, kind, pos.x, pos.y];

            if ((flags & SPAWN_FLAG_HAS_NAME) !== 0) {
                out.push(reader.readString());
            }
            if ((flags & SPAWN_FLAG_HAS_ORIENTATION) !== 0) {
                out.push(reader.readVarU32());
            }
            if ((flags & SPAWN_FLAG_HAS_EQUIPMENT) !== 0) {
                out.push(reader.readVarU32());
                out.push(reader.readVarU32());
            }
            if ((flags & SPAWN_FLAG_HAS_TARGET) !== 0) {
                out.push(reader.readVarU32());
            }
            if ((flags & SPAWN_FLAG_HAS_MAP_ID) !== 0) {
                out.push(reader.readString());
            }

            return out;
        }
        case Types.Messages.DESPAWN:
        case Types.Messages.DESTROY:
        case Types.Messages.HP:
        case Types.Messages.BLINK:
        case Types.Messages.ACK:
            return [opcode, reader.readVarU32()];
        case Types.Messages.MOVE: {
            const id = reader.readVarU32();
            const pos = reader.readPos20();
            return [opcode, id, pos.x, pos.y];
        }
        case Types.Messages.TELEPORT: {
            const id = reader.readVarU32();
            const pos = reader.readPos20();
            const mapId = reader.readString();
            return [opcode, id, pos.x, pos.y, mapId];
        }
        case Types.Messages.LOOTMOVE:
        case Types.Messages.ATTACK:
        case Types.Messages.DAMAGE:
        case Types.Messages.POPULATION:
            return [opcode, reader.readVarU32(), reader.readVarU32()];
        case Types.Messages.HEALTH: {
            const points = reader.readVarU32();
            const isRegenFlag = reader.readU8();
            return isRegenFlag === 1 ? [opcode, points, 1] : [opcode, points];
        }
        case Types.Messages.CHAT: {
            const id = reader.readVarU32();
            const msg = reader.readString();
            return [opcode, id, msg];
        }
        case Types.Messages.EQUIP: {
            const id = reader.readVarU32();
            const itemKind = reader.readVarU32();
            return [opcode, id, itemKind];
        }
        case Types.Messages.DROP: {
            const mobId = reader.readVarU32();
            const itemId = reader.readVarU32();
            const itemKind = reader.readVarU32();
            const count = reader.readVarU32();
            const haters: number[] = [];
            for (let i = 0; i < count; i += 1) {
                haters.push(reader.readVarU32());
            }
            return [opcode, mobId, itemId, itemKind, haters];
        }
        case Types.Messages.KILL:
            return [opcode, reader.readVarU32()];
        case Types.Messages.LIST: {
            const count = reader.readVarU32();
            const out: unknown[] = [opcode];
            for (let i = 0; i < count; i += 1) {
                out.push(reader.readVarU32());
            }
            return out;
        }
        case Types.Messages.ACHIEVEMENTS: {
            const unlockedCount = reader.readVarU32();
            const unlocked: number[] = [];
            for (let i = 0; i < unlockedCount; i += 1) {
                unlocked.push(reader.readVarU32());
            }
            const rat = reader.readVarU32();
            const skeleton = reader.readVarU32();
            const kills = reader.readVarU32();
            const dmg = reader.readVarU32();
            const revives = reader.readVarU32();
            return [opcode, unlocked, rat, skeleton, kills, dmg, revives];
        }
        case Types.Messages.OUTCOME:
        case Types.Messages.REJECT: {
            const seq = reader.readVarU32();
            if (opcode === Types.Messages.OUTCOME) {
                const outcomeTypeId = decodeWireOutcomeTypeId(reader.readVarU32());
                const payload = reader.readString();
                return [opcode, seq, outcomeTypeId, payload];
            }
            const intentTypeId = decodeWireIntentTypeId(reader.readVarU32());
            const reason = reader.readString();
            return [opcode, seq, intentTypeId, reason];
        }
        case Types.Messages.CORRECTION: {
            const seq = reader.readVarU32();
            const variant = reader.readU8();
            if (variant === 0) {
                const pos = reader.readPos20();
                const mapId = reader.readString();
                return [opcode, seq, pos.x, pos.y, mapId];
            }
            if (variant === 1) {
                return [opcode, seq, reader.readString(), reader.readString()];
            }
            throw new Error('invalid CORRECTION variant');
        }
        case Types.Messages.MOVE_SYNC: {
            const ackSeq = reader.readVarU32();
            const pos = reader.readPosVarU32();
            const tick = reader.readVarU32();
            const flags = reader.readU8();
            const mapId = reader.readString();
            return [opcode, ackSeq, pos.x, pos.y, tick, flags, mapId];
        }
        case Types.Messages.ENTITY_STATE_BATCH: {
            const tick = reader.readVarU32();
            const count = reader.readVarU32();
            const out: unknown[] = [opcode, tick, count];
            for (let i = 0; i < count; i += 1) {
                const id = reader.readVarU32();
                const pos = reader.readPosVarU32();
                const flags = reader.readU8();
                out.push(id, pos.x, pos.y, flags);
            }
            return out;
        }
        case Types.Messages.CHUNK_SNAPSHOT: {
            const chunkX = decodeSignedChunkCoord(reader.readVarU32());
            const chunkY = decodeSignedChunkCoord(reader.readVarU32());
            const version = reader.readVarU32();
            const payloadLen = reader.readVarU32();
            const payload = reader.readBytes(payloadLen);
            return [opcode, chunkX, chunkY, version, payload];
        }
        case Types.Messages.CHUNK_SNAPSHOT_PART: {
            const chunkX = decodeSignedChunkCoord(reader.readVarU32());
            const chunkY = decodeSignedChunkCoord(reader.readVarU32());
            const version = reader.readVarU32();
            const partIndex = reader.readVarU32();
            const partCount = reader.readVarU32();
            const payloadLen = reader.readVarU32();
            const payload = reader.readBytes(payloadLen);
            return [opcode, chunkX, chunkY, version, partIndex, partCount, payload];
        }
        case Types.Messages.CHUNK_DELTA: {
            const chunkX = decodeSignedChunkCoord(reader.readVarU32());
            const chunkY = decodeSignedChunkCoord(reader.readVarU32());
            const fromVersion = reader.readVarU32();
            const toVersion = reader.readVarU32();
            const payloadLen = reader.readVarU32();
            const payload = reader.readBytes(payloadLen);
            return [opcode, chunkX, chunkY, fromVersion, toVersion, payload];
        }
        default:
            throw new Error(`unknown s2c opcode: ${opcode}`);
    }
}

function skipClientToServerActionFromOpcode(opcode: number, reader: ByteReader): void {
    switch (opcode) {
        case Types.Messages.HELLO: {
            const variant = reader.readU8();
            void reader.readString();
            void reader.readVarU32();
            void reader.readVarU32();
            if (variant === 1) {
                void reader.readVarU32();
                void reader.readString();
            }
            return;
        }
        case Types.Messages.LOOTMOVE: {
            void reader.readPos20();
            void reader.readVarU32();
            return;
        }
        case Types.Messages.AGGRO:
        case Types.Messages.LOOT:
        case Types.Messages.OPEN:
        case Types.Messages.CHECK:
        case Types.Messages.ACHIEVEMENT: {
            void reader.readVarU32();
            return;
        }
        case Types.Messages.CHAT: {
            void reader.readString();
            return;
        }
        case Types.Messages.WHO: {
            const count = reader.readVarU32();
            for (let i = 0; i < count; i += 1) {
                void reader.readVarU32();
            }
            return;
        }
        case Types.Messages.ZONE:
        case Types.Messages.CHUNK_UNSUBSCRIBE:
            return;
        case Types.Messages.INTENT: {
            void reader.readVarU32(); // seq
            void reader.readVarU32(); // intent type id
            const payloadLen = reader.readVarU32();
            void reader.readBytes(payloadLen);
            return;
        }
        case Types.Messages.CHUNK_SUBSCRIBE: {
            void reader.readVarU32();
            void reader.readVarU32();
            void reader.readVarU32();
            return;
        }
        default:
            throw new Error(`unknown c2s opcode: ${opcode}`);
    }
}

function skipServerToClientActionFromOpcode(opcode: number, reader: ByteReader): void {
    switch (opcode) {
        case Types.Messages.WELCOME: {
            const variant = reader.readU8();
            void reader.readVarU32();
            void reader.readString();
            void reader.readPos20();
            void reader.readVarU32();
            if (variant === 1) {
                void reader.readVarU32();
                void reader.readString();
            }
            return;
        }
        case Types.Messages.SPAWN: {
            void reader.readVarU32();
            void reader.readVarU32();
            void reader.readPos20();
            const flags = reader.readU8();
            if ((flags & SPAWN_FLAG_HAS_NAME) !== 0) {
                void reader.readString();
            }
            if ((flags & SPAWN_FLAG_HAS_ORIENTATION) !== 0) {
                void reader.readVarU32();
            }
            if ((flags & SPAWN_FLAG_HAS_EQUIPMENT) !== 0) {
                void reader.readVarU32();
                void reader.readVarU32();
            }
            if ((flags & SPAWN_FLAG_HAS_TARGET) !== 0) {
                void reader.readVarU32();
            }
            if ((flags & SPAWN_FLAG_HAS_MAP_ID) !== 0) {
                void reader.readString();
            }
            return;
        }
        case Types.Messages.DESPAWN:
        case Types.Messages.DESTROY:
        case Types.Messages.HP:
        case Types.Messages.BLINK:
        case Types.Messages.ACK:
            void reader.readVarU32();
            return;
        case Types.Messages.MOVE:
            void reader.readVarU32();
            void reader.readPos20();
            return;
        case Types.Messages.TELEPORT:
            void reader.readVarU32();
            void reader.readPos20();
            void reader.readString();
            return;
        case Types.Messages.LOOTMOVE:
        case Types.Messages.ATTACK:
        case Types.Messages.DAMAGE:
        case Types.Messages.POPULATION:
            void reader.readVarU32();
            void reader.readVarU32();
            return;
        case Types.Messages.HEALTH:
            void reader.readVarU32();
            void reader.readU8();
            return;
        case Types.Messages.CHAT:
            void reader.readVarU32();
            void reader.readString();
            return;
        case Types.Messages.EQUIP:
            void reader.readVarU32();
            void reader.readVarU32();
            return;
        case Types.Messages.DROP: {
            void reader.readVarU32();
            void reader.readVarU32();
            void reader.readVarU32();
            const count = reader.readVarU32();
            for (let i = 0; i < count; i += 1) {
                void reader.readVarU32();
            }
            return;
        }
        case Types.Messages.KILL:
            void reader.readVarU32();
            return;
        case Types.Messages.LIST: {
            const count = reader.readVarU32();
            for (let i = 0; i < count; i += 1) {
                void reader.readVarU32();
            }
            return;
        }
        case Types.Messages.ACHIEVEMENTS: {
            const unlockedCount = reader.readVarU32();
            for (let i = 0; i < unlockedCount; i += 1) {
                void reader.readVarU32();
            }
            void reader.readVarU32();
            void reader.readVarU32();
            void reader.readVarU32();
            void reader.readVarU32();
            void reader.readVarU32();
            return;
        }
        case Types.Messages.OUTCOME:
        case Types.Messages.REJECT:
            void reader.readVarU32();
            void reader.readVarU32();
            void reader.readString();
            return;
        case Types.Messages.CORRECTION: {
            void reader.readVarU32();
            const variant = reader.readU8();
            if (variant === 0) {
                void reader.readPos20();
                void reader.readString();
                return;
            }
            if (variant === 1) {
                void reader.readString();
                void reader.readString();
                return;
            }
            throw new Error('invalid CORRECTION variant');
        }
        case Types.Messages.MOVE_SYNC:
            void reader.readVarU32();
            void reader.readPosVarU32();
            void reader.readVarU32();
            void reader.readU8();
            void reader.readString();
            return;
        case Types.Messages.ENTITY_STATE_BATCH: {
            void reader.readVarU32(); // tick
            const count = reader.readVarU32();
            for (let i = 0; i < count; i += 1) {
                void reader.readVarU32();
                void reader.readPosVarU32();
                void reader.readU8();
            }
            return;
        }
        case Types.Messages.CHUNK_SNAPSHOT: {
            void reader.readVarU32();
            void reader.readVarU32();
            void reader.readVarU32();
            const payloadLen = reader.readVarU32();
            void reader.readBytes(payloadLen);
            return;
        }
        case Types.Messages.CHUNK_SNAPSHOT_PART: {
            void reader.readVarU32();
            void reader.readVarU32();
            void reader.readVarU32();
            void reader.readVarU32();
            void reader.readVarU32();
            const payloadLen = reader.readVarU32();
            void reader.readBytes(payloadLen);
            return;
        }
        case Types.Messages.CHUNK_DELTA: {
            void reader.readVarU32();
            void reader.readVarU32();
            void reader.readVarU32();
            void reader.readVarU32();
            const payloadLen = reader.readVarU32();
            void reader.readBytes(payloadLen);
            return;
        }
        default:
            throw new Error(`unknown s2c opcode: ${opcode}`);
    }
}

function decodeBatchWithDirection(payloadBody: Uint8Array): { direction: Direction; actions: unknown[][] } {
    const reader = new ByteReader(payloadBody);
    const directionByte = reader.readU8();
    if (directionByte !== DIR_CLIENT_TO_SERVER && directionByte !== DIR_SERVER_TO_CLIENT) {
        throw new Error('invalid direction');
    }
    const direction: Direction = directionByte;

    const count = reader.readVarU32();
    const out: unknown[][] = [];

    if (direction === DIR_CLIENT_TO_SERVER) {
        for (let i = 0; i < count; i += 1) {
            out.push(decodeClientToServerAction(reader));
        }
    } else {
        for (let i = 0; i < count; i += 1) {
            out.push(decodeServerToClientAction(reader));
        }
    }

    if (reader.remaining() !== 0) {
        throw new Error('trailing payload bytes');
    }

    return { direction, actions: out };
}

export function encodeClientToServerBinaryActionBatchPayload(batch: WireBatchLike): Uint8Array {
    const actions = normalizeRoot(batch);
    return wrapFrame(encodeBatch(actions, DIR_CLIENT_TO_SERVER));
}

export function encodeServerToClientBinaryActionBatchPayload(batch: WireBatchLike): Uint8Array {
    const actions = normalizeRoot(batch);
    return wrapFrame(encodeBatch(actions, DIR_SERVER_TO_CLIENT));
}

export function encodeBinaryActionBatchPayload(batch: WireBatchLike): Uint8Array {
    const actions = normalizeRoot(batch);

    // Generic encode is used mainly by tests/tools; pick direction by opcode membership and overlap heuristics.
    // Runtime code should call the direction-specific encoders.
    let c2sOk = true;
    let s2cOk = true;
    for (let i = 0; i < actions.length; i += 1) {
        const action = actions[i];
        if (!action) {
            continue;
        }
        const opcode = action[0];
        if (!C2S_OPCODES.has(opcode)) {
            c2sOk = false;
        }
        if (!S2C_OPCODES.has(opcode)) {
            s2cOk = false;
        }

        // Disambiguate shared opcodes by tuple length.
        if (opcode === Types.Messages.CHAT) {
            if (action.length === 2) {
                s2cOk = false;
            } else if (action.length === 3) {
                c2sOk = false;
            }
        }
        if (opcode === Types.Messages.ATTACK) {
            if (action.length === 2) {
                s2cOk = false;
            } else if (action.length === 3) {
                c2sOk = false;
            }
        }
        if (opcode === Types.Messages.LOOTMOVE) {
            if (action.length === 4) {
                s2cOk = false;
            } else if (action.length === 3) {
                c2sOk = false;
            }
        }
    }

    if (c2sOk && !s2cOk) {
        return wrapFrame(encodeBatch(actions, DIR_CLIENT_TO_SERVER));
    }
    if (s2cOk && !c2sOk) {
        return wrapFrame(encodeBatch(actions, DIR_SERVER_TO_CLIENT));
    }

    // Prefer c2s in ambiguous cases.
    try {
        return wrapFrame(encodeBatch(actions, DIR_CLIENT_TO_SERVER));
    } catch (_) {
        return wrapFrame(encodeBatch(actions, DIR_SERVER_TO_CLIENT));
    }
}

export function decodeClientToServerBinaryActionBatchPayload(payload: ArrayBuffer | Uint8Array): unknown[] {
    const decoded = decodeBatchWithDirection(unwrapFrame(payload));
    if (decoded.direction !== DIR_CLIENT_TO_SERVER) {
        throw new Error('unexpected direction');
    }
    return decoded.actions;
}

export function decodeServerToClientBinaryActionBatchPayload(payload: ArrayBuffer | Uint8Array): unknown[] {
    const decoded = decodeBatchWithDirection(unwrapFrame(payload));
    if (decoded.direction !== DIR_SERVER_TO_CLIENT) {
        throw new Error('unexpected direction');
    }
    return decoded.actions;
}

export type BinaryActionBatchDispatchHooks = Readonly<{
    onClientAction?: (action: unknown[]) => void;
    onServerAction?: (action: unknown[]) => void;
    // Hot path: avoid allocating a giant action array for `ENTITY_STATE_BATCH`.
    onEntityStateBatchHeader?: (tick: number, count: number) => void;
    onEntityStateBatchEntry?: (wireId: number, x: number, y: number, flags: number) => void;
    onEntityStateBatchFooter?: () => void;
}>;

export function dispatchBinaryActionBatchPayload(payload: ArrayBuffer | Uint8Array, hooks: BinaryActionBatchDispatchHooks): void {
    const reader = new ByteReader(unwrapFrame(payload));
    const directionByte = reader.readU8();
    if (directionByte !== DIR_CLIENT_TO_SERVER && directionByte !== DIR_SERVER_TO_CLIENT) {
        throw new Error('invalid direction');
    }
    const direction: Direction = directionByte;
    const count = reader.readVarU32();

    if (direction === DIR_CLIENT_TO_SERVER) {
        for (let i = 0; i < count; i += 1) {
            const opcode = reader.readU8();
            if (hooks.onClientAction) {
                hooks.onClientAction(decodeClientToServerActionFromOpcode(opcode, reader));
            } else {
                skipClientToServerActionFromOpcode(opcode, reader);
            }
        }
    } else {
        for (let i = 0; i < count; i += 1) {
            const opcode = reader.readU8();
            if (opcode === Types.Messages.ENTITY_STATE_BATCH && hooks.onEntityStateBatchEntry) {
                const tick = reader.readVarU32();
                const entryCount = reader.readVarU32();
                hooks.onEntityStateBatchHeader?.(tick, entryCount);
                for (let j = 0; j < entryCount; j += 1) {
                    const id = reader.readVarU32();
                    const pos = reader.readPosVarU32();
                    const flags = reader.readU8();
                    hooks.onEntityStateBatchEntry(id, pos.x, pos.y, flags);
                }
                hooks.onEntityStateBatchFooter?.();
                continue;
            }

            if (hooks.onServerAction) {
                hooks.onServerAction(decodeServerToClientActionFromOpcode(opcode, reader));
            } else {
                skipServerToClientActionFromOpcode(opcode, reader);
            }
        }
    }

    if (reader.remaining() !== 0) {
        throw new Error('trailing payload bytes');
    }
}

export function decodeBinaryActionBatchPayload(payload: ArrayBuffer | Uint8Array): unknown {
    const decoded = decodeBatchWithDirection(unwrapFrame(payload));
    if (decoded.actions.length === 1) {
        return decoded.actions[0] ?? [];
    }
    return decoded.actions;
}
