import { expect, test } from 'bun:test';
import {
    decodeClaimCreateIntentPayload,
    decodeClaimDeleteIntentPayload,
    decodeClaimUpdateIntentPayload,
    decodeDoorTeleportIntentPayload,
    decodeMoveStepIntentPayload,
    decodeTileEditIntentPayload,
    encodeClaimCreateIntentPayload,
    encodeClaimDeleteIntentPayload,
    encodeClaimUpdateIntentPayload,
    encodeDoorTeleportIntentPayload,
    encodeMoveStepIntentPayload,
    encodeTileEditIntentPayload,
    INTENT_CLAIM_CREATE,
    INTENT_CLAIM_DELETE,
    INTENT_CLAIM_UPDATE,
    INTENT_DOOR_TELEPORT,
    INTENT_MOVE_STEP,
    INTENT_TILE_EDIT,
    OUTCOME_DOOR_TELEPORT,
} from '../../../shared/protocol/intents';

test('intent id constants remain stable', () => {
    expect(INTENT_MOVE_STEP).toBe('move.step');
    expect(INTENT_DOOR_TELEPORT).toBe('door.teleport');
    expect(INTENT_TILE_EDIT).toBe('tile.edit');
    expect(INTENT_CLAIM_CREATE).toBe('claim.create');
    expect(INTENT_CLAIM_UPDATE).toBe('claim.update');
    expect(INTENT_CLAIM_DELETE).toBe('claim.delete');
    expect(OUTCOME_DOOR_TELEPORT).toBe('teleport.door');
});

test('move/door intent codecs round-trip valid payloads', () => {
    const moveJson = encodeMoveStepIntentPayload({ x: 12, y: 7 });
    expect(moveJson).toBe('{"x":12,"y":7}');
    expect(decodeMoveStepIntentPayload(moveJson ?? '')).toEqual({ x: 12, y: 7 });

    const doorJson = encodeDoorTeleportIntentPayload({ x: 44, y: 55 });
    expect(doorJson).toBe('{"x":44,"y":55}');
    expect(decodeDoorTeleportIntentPayload(doorJson ?? '')).toEqual({ x: 44, y: 55 });
});

test('tile edit codec validates bounds and nullable values', () => {
    expect(encodeTileEditIntentPayload({ x: 2, y: 3, value: 99 })).toBe('{"x":2,"y":3,"value":99}');
    expect(encodeTileEditIntentPayload({ x: 2, y: 3, value: null })).toBe('{"x":2,"y":3,"value":null}');
    expect(encodeTileEditIntentPayload({ x: 2.5, y: 3, value: 99 })).toBeNull();
    expect(encodeTileEditIntentPayload({ x: 2, y: 3, value: -1 })).toBeNull();

    expect(decodeTileEditIntentPayload('{"x":2,"y":3,"value":99}')).toEqual({ x: 2, y: 3, value: 99 });
    expect(decodeTileEditIntentPayload('{"x":2,"y":3,"value":null}')).toEqual({ x: 2, y: 3, value: null });
    expect(decodeTileEditIntentPayload('{"x":2,"y":3,"value":-1}')).toBeNull();
});

test('claim intent codecs round-trip valid payloads', () => {
    const createJson = encodeClaimCreateIntentPayload({
        x1: 1,
        y1: 2,
        x2: 3,
        y2: 4,
        editors: ['alice', 'bob'],
    });
    expect(createJson).toBe('{"x1":1,"y1":2,"x2":3,"y2":4,"editors":["alice","bob"]}');
    expect(decodeClaimCreateIntentPayload(createJson ?? '')).toEqual({
        x1: 1,
        y1: 2,
        x2: 3,
        y2: 4,
        editors: ['alice', 'bob'],
    });

    const updateJson = encodeClaimUpdateIntentPayload({
        id: 10,
        x1: 1,
        y1: 2,
        x2: 3,
        y2: 4,
        editors: ['alice'],
    });
    expect(updateJson).toBe('{"id":10,"x1":1,"y1":2,"x2":3,"y2":4,"editors":["alice"]}');
    expect(decodeClaimUpdateIntentPayload(updateJson ?? '')).toEqual({
        id: 10,
        x1: 1,
        y1: 2,
        x2: 3,
        y2: 4,
        editors: ['alice'],
    });

    const deleteJson = encodeClaimDeleteIntentPayload({ id: 11 });
    expect(deleteJson).toBe('{"id":11}');
    expect(decodeClaimDeleteIntentPayload(deleteJson ?? '')).toEqual({ id: 11 });
});

test('claim intent decoders reject invalid payloads', () => {
    expect(decodeClaimCreateIntentPayload('{"x1":1,"y1":2,"x2":3,"y2":4,"editors":[1]}')).toBeNull();
    expect(decodeClaimUpdateIntentPayload('{"id":0,"x1":1,"y1":2,"x2":3,"y2":4}')).toBeNull();
    expect(decodeClaimDeleteIntentPayload('{"id":0}')).toBeNull();
});
