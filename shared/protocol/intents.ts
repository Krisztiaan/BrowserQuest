import { gridPos, type GridPos } from '../domain/positions';

type JsonScalar = string | number | boolean | null;
type JsonLike = JsonScalar | JsonLike[] | { [key: string]: JsonLike };
type JsonRecord = { [key: string]: JsonLike };

export const INTENT_MOVE_STEP = 'move.step' as const;
export const INTENT_DOOR_TELEPORT = 'door.teleport' as const;
export const INTENT_TILE_EDIT = 'tile.edit' as const;
export const INTENT_CLAIM_CREATE = 'claim.create' as const;
export const INTENT_CLAIM_UPDATE = 'claim.update' as const;
export const INTENT_CLAIM_DELETE = 'claim.delete' as const;

export const OUTCOME_DOOR_TELEPORT = 'teleport.door' as const;

export type CoreIntentTypeId =
    | typeof INTENT_MOVE_STEP
    | typeof INTENT_DOOR_TELEPORT
    | typeof INTENT_TILE_EDIT
    | typeof INTENT_CLAIM_CREATE
    | typeof INTENT_CLAIM_UPDATE
    | typeof INTENT_CLAIM_DELETE;

export type MoveStepIntentPayload = GridPos;
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

function isRecord(value: JsonLike | object | null | undefined): value is JsonRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseSafeInteger(value: JsonLike | undefined): number | null {
    if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
        return null;
    }
    return value;
}

function safeParseJson(payload: string): JsonLike | null {
    try {
        return JSON.parse(payload) as JsonLike;
    } catch (_) {
        return null;
    }
}

function parseGridPosPayload(payloadJson: string): GridPos | null {
    const parsed = safeParseJson(payloadJson);
    if (!isRecord(parsed)) {
        return null;
    }

    const x = parseSafeInteger(parsed.x);
    const y = parseSafeInteger(parsed.y);
    if (x === null || y === null) {
        return null;
    }
    return gridPos(x, y);
}

function encodeGridPosPayload(payload: Readonly<{ x: number; y: number }>): string | null {
    if (!Number.isSafeInteger(payload.x) || !Number.isSafeInteger(payload.y)) {
        return null;
    }
    return JSON.stringify({ x: payload.x, y: payload.y });
}

function parseEditorsPayload(record: JsonRecord): string[] | undefined | null {
    const rawEditors = record.editors;
    if (rawEditors === undefined) {
        return undefined;
    }
    if (!Array.isArray(rawEditors)) {
        return null;
    }

    const editors: string[] = [];
    for (let i = 0; i < rawEditors.length; i += 1) {
        const value = rawEditors[i];
        if (typeof value !== 'string') {
            return null;
        }
        editors.push(value);
    }
    return editors;
}

export function encodeMoveStepIntentPayload(payload: MoveStepIntentPayload): string | null {
    return encodeGridPosPayload(payload);
}

export function decodeMoveStepIntentPayload(payloadJson: string): MoveStepIntentPayload | null {
    return parseGridPosPayload(payloadJson);
}

export function encodeDoorTeleportIntentPayload(payload: DoorTeleportIntentPayload): string | null {
    return encodeGridPosPayload(payload);
}

export function decodeDoorTeleportIntentPayload(payloadJson: string): DoorTeleportIntentPayload | null {
    return parseGridPosPayload(payloadJson);
}

export function encodeTileEditIntentPayload(payload: TileEditIntentPayload): string | null {
    if (!Number.isSafeInteger(payload.x) || !Number.isSafeInteger(payload.y)) {
        return null;
    }
    const value = payload.value;
    if (value !== null && (!Number.isSafeInteger(value) || value < 0)) {
        return null;
    }
    return JSON.stringify({ x: payload.x, y: payload.y, value });
}

export function decodeTileEditIntentPayload(payloadJson: string): TileEditIntentPayload | null {
    const parsed = safeParseJson(payloadJson);
    if (!isRecord(parsed)) {
        return null;
    }

    const x = parseSafeInteger(parsed.x);
    const y = parseSafeInteger(parsed.y);
    const value = parsed.value;
    if (x === null || y === null) {
        return null;
    }
    if (value === null) {
        return { x, y, value: null };
    }
    const parsedValue = parseSafeInteger(value);
    if (parsedValue === null || parsedValue < 0) {
        return null;
    }
    return { x, y, value: parsedValue };
}

export function encodeClaimCreateIntentPayload(payload: ClaimCreateIntentPayload): string | null {
    if (![payload.x1, payload.y1, payload.x2, payload.y2].every((value) => Number.isSafeInteger(value))) {
        return null;
    }
    if (!Array.isArray(payload.editors) || !payload.editors.every((value) => typeof value === 'string')) {
        return null;
    }
    return JSON.stringify({
        x1: payload.x1,
        y1: payload.y1,
        x2: payload.x2,
        y2: payload.y2,
        editors: [...payload.editors],
    });
}

export function decodeClaimCreateIntentPayload(payloadJson: string): ClaimCreateIntentPayload | null {
    const parsed = safeParseJson(payloadJson);
    if (!isRecord(parsed)) {
        return null;
    }

    const x1 = parseSafeInteger(parsed.x1);
    const y1 = parseSafeInteger(parsed.y1);
    const x2 = parseSafeInteger(parsed.x2);
    const y2 = parseSafeInteger(parsed.y2);
    if (x1 === null || y1 === null || x2 === null || y2 === null) {
        return null;
    }

    const editors = parseEditorsPayload(parsed);
    if (editors === null) {
        return null;
    }
    return { x1, y1, x2, y2, editors: editors ?? [] };
}

export function encodeClaimUpdateIntentPayload(payload: ClaimUpdateIntentPayload): string | null {
    if (!Number.isSafeInteger(payload.id) || payload.id <= 0) {
        return null;
    }
    if (![payload.x1, payload.y1, payload.x2, payload.y2].every((value) => Number.isSafeInteger(value))) {
        return null;
    }
    if (payload.editors !== undefined && (!Array.isArray(payload.editors) || !payload.editors.every((value) => typeof value === 'string'))) {
        return null;
    }
    return JSON.stringify({
        id: payload.id,
        x1: payload.x1,
        y1: payload.y1,
        x2: payload.x2,
        y2: payload.y2,
        ...(payload.editors !== undefined ? { editors: [...payload.editors] } : {}),
    });
}

export function decodeClaimUpdateIntentPayload(payloadJson: string): ClaimUpdateIntentPayload | null {
    const parsed = safeParseJson(payloadJson);
    if (!isRecord(parsed)) {
        return null;
    }

    const id = parseSafeInteger(parsed.id);
    const x1 = parseSafeInteger(parsed.x1);
    const y1 = parseSafeInteger(parsed.y1);
    const x2 = parseSafeInteger(parsed.x2);
    const y2 = parseSafeInteger(parsed.y2);
    if (id === null || id <= 0 || x1 === null || y1 === null || x2 === null || y2 === null) {
        return null;
    }

    const editors = parseEditorsPayload(parsed);
    if (editors === null) {
        return null;
    }
    return { id, x1, y1, x2, y2, ...(editors !== undefined ? { editors } : {}) };
}

export function encodeClaimDeleteIntentPayload(payload: ClaimDeleteIntentPayload): string | null {
    if (!Number.isSafeInteger(payload.id) || payload.id <= 0) {
        return null;
    }
    return JSON.stringify({ id: payload.id });
}

export function decodeClaimDeleteIntentPayload(payloadJson: string): ClaimDeleteIntentPayload | null {
    const parsed = safeParseJson(payloadJson);
    if (!isRecord(parsed)) {
        return null;
    }
    const id = parseSafeInteger(parsed.id);
    if (id === null || id <= 0) {
        return null;
    }
    return { id };
}
