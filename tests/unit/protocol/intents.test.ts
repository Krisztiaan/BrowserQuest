import { expect, test } from 'bun:test';
import {
    decodeClaimCreateIntentPayload,
    decodeClaimDeleteIntentPayload,
    decodeClaimUpdateIntentPayload,
    decodeDoorTeleportIntentPayload,
    decodeMoveInputIntentPayload,
    decodeMoveStepIntentPayload,
    decodeMoveToIntentPayload,
    decodeTileEditIntentPayload,
    encodeClaimCreateIntentPayload,
    encodeClaimDeleteIntentPayload,
    encodeClaimUpdateIntentPayload,
    encodeDoorTeleportIntentPayload,
    encodeMoveInputIntentPayload,
    encodeMoveStepIntentPayload,
    encodeMoveToIntentPayload,
    encodeTileEditIntentPayload,
    INTENT_CLAIM_CREATE,
    INTENT_CLAIM_DELETE,
    INTENT_CLAIM_UPDATE,
    INTENT_DOOR_TELEPORT,
    INTENT_MOVE_INPUT,
    INTENT_MOVE_STEP,
    INTENT_MOVE_TO,
    INTENT_TILE_EDIT,
    MOVE_INPUT_KEY_A,
    MOVE_INPUT_KEY_D,
    MOVE_INPUT_KEY_S,
    MOVE_INPUT_KEY_W,
    OUTCOME_DOOR_TELEPORT,
} from '../../../shared/protocol/intents';

test('intent id constants remain stable', () => {
    expect(INTENT_MOVE_STEP).toBe('move.step');
    expect(INTENT_MOVE_TO).toBe('move.to');
    expect(INTENT_MOVE_INPUT).toBe('move.input');
    expect(INTENT_DOOR_TELEPORT).toBe('door.teleport');
    expect(INTENT_TILE_EDIT).toBe('tile.edit');
    expect(INTENT_CLAIM_CREATE).toBe('claim.create');
    expect(INTENT_CLAIM_UPDATE).toBe('claim.update');
    expect(INTENT_CLAIM_DELETE).toBe('claim.delete');
    expect(OUTCOME_DOOR_TELEPORT).toBe('teleport.door');
});

test('move/door intent codecs round-trip valid payloads', () => {
    const moveBytes = encodeMoveStepIntentPayload({ x: 12, y: 7 });
    expect(moveBytes).toEqual([12, 0, 0, 0, 7, 0, 0, 0]);
    expect(decodeMoveStepIntentPayload(moveBytes ?? [])).toEqual({ x: 12, y: 7 });

    const moveToBytes = encodeMoveToIntentPayload({ x: 12, y: 7, stopAdjacentToTarget: false });
    expect(moveToBytes).toEqual([12, 0, 0, 0, 7, 0, 0, 0, 0]);
    expect(decodeMoveToIntentPayload(moveToBytes ?? [])).toEqual({ x: 12, y: 7, stopAdjacentToTarget: false });

    const moveToStopAdjBytes = encodeMoveToIntentPayload({ x: 12, y: 7, stopAdjacentToTarget: true });
    expect(moveToStopAdjBytes).toEqual([12, 0, 0, 0, 7, 0, 0, 0, 1]);
    expect(decodeMoveToIntentPayload(moveToStopAdjBytes ?? [])).toEqual({ x: 12, y: 7, stopAdjacentToTarget: true });

    const doorBytes = encodeDoorTeleportIntentPayload({ x: 44, y: 55 });
    expect(doorBytes).toEqual([44, 0, 0, 0, 55, 0, 0, 0]);
    expect(decodeDoorTeleportIntentPayload(doorBytes ?? [])).toEqual({ x: 44, y: 55 });
});

test('move.input codec accepts only WASD bits and round-trips', () => {
    const mask = MOVE_INPUT_KEY_W | MOVE_INPUT_KEY_A | MOVE_INPUT_KEY_S | MOVE_INPUT_KEY_D;
    const bytes = encodeMoveInputIntentPayload({ keysMask: mask });
    expect(bytes).toEqual([mask]);
    expect(decodeMoveInputIntentPayload(bytes ?? [])).toEqual({ keysMask: mask });

    expect(encodeMoveInputIntentPayload({ keysMask: 0xff })).toBeNull();
    expect(decodeMoveInputIntentPayload([0xff])).toBeNull();
});

test('tile edit codec validates bounds and nullable values', () => {
    expect(encodeTileEditIntentPayload({ x: 2, y: 3, value: 99 })).toEqual([2, 0, 0, 0, 3, 0, 0, 0, 1, 99, 0, 0, 0]);
    expect(encodeTileEditIntentPayload({ x: 2, y: 3, value: null })).toEqual([2, 0, 0, 0, 3, 0, 0, 0, 0]);
    expect(encodeTileEditIntentPayload({ x: 2.5, y: 3, value: 99 })).toBeNull();
    expect(encodeTileEditIntentPayload({ x: 2, y: 3, value: -1 })).toBeNull();

    expect(decodeTileEditIntentPayload([2, 0, 0, 0, 3, 0, 0, 0, 1, 99, 0, 0, 0])).toEqual({ x: 2, y: 3, value: 99 });
    expect(decodeTileEditIntentPayload([2, 0, 0, 0, 3, 0, 0, 0, 0])).toEqual({ x: 2, y: 3, value: null });
    expect(decodeTileEditIntentPayload([2, 0, 0, 0, 3, 0, 0, 0, 1, 255, 255, 255, 255])).toBeNull();
});

test('claim intent codecs round-trip valid payloads', () => {
    const createBytes = encodeClaimCreateIntentPayload({
        x1: 1,
        y1: 2,
        x2: 3,
        y2: 4,
        editors: ['alice', 'bob'],
    });
    expect(createBytes).not.toBeNull();
    expect(decodeClaimCreateIntentPayload(createBytes ?? [])).toEqual({
        x1: 1,
        y1: 2,
        x2: 3,
        y2: 4,
        editors: ['alice', 'bob'],
    });

    const updateBytes = encodeClaimUpdateIntentPayload({
        id: 10,
        x1: 1,
        y1: 2,
        x2: 3,
        y2: 4,
        editors: ['alice'],
    });
    expect(updateBytes).not.toBeNull();
    expect(decodeClaimUpdateIntentPayload(updateBytes ?? [])).toEqual({
        id: 10,
        x1: 1,
        y1: 2,
        x2: 3,
        y2: 4,
        editors: ['alice'],
    });

    const deleteBytes = encodeClaimDeleteIntentPayload({ id: 11 });
    expect(deleteBytes).toEqual([11, 0, 0, 0]);
    expect(decodeClaimDeleteIntentPayload(deleteBytes ?? [])).toEqual({ id: 11 });
});

test('claim intent decoders reject invalid payloads', () => {
    expect(decodeClaimCreateIntentPayload([1, 0, 0, 0])).toBeNull();
    expect(decodeClaimUpdateIntentPayload([0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0])).toBeNull();
    expect(decodeClaimDeleteIntentPayload([0, 0, 0, 0])).toBeNull();
});

test('move.to decoder rejects invalid flag bits', () => {
    expect(decodeMoveToIntentPayload([12, 0, 0, 0, 7, 0, 0, 0, 2])).toBeNull();
});
