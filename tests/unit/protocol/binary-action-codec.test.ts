import { expect, test } from 'bun:test';
import Types from '../../../shared/gametypes-browser';
import { decodeBinaryActionBatchPayload, encodeBinaryActionBatchPayload } from '../../../shared/protocol/binary-action-codec';
import { encodeMoveInputIntentPayload, encodeMoveToIntentPayload } from '../../../shared/protocol/intents';

function normalizeBinaryValues(value: unknown): unknown {
    if (value instanceof Uint8Array) {
        return Array.from(value);
    }
    if (Array.isArray(value)) {
        return value.map((entry) => normalizeBinaryValues(entry));
    }
    return value;
}

test('custom-efficient runtime action codec round-trips mixed payload batches', () => {
    const batch: unknown[] = [
        [Types.Messages.INTENT, 1, 'move.step', [155, 114]],
        [Types.Messages.INTENT, 2, 'move.to', encodeMoveToIntentPayload({ x: 155, y: 114, stopAdjacentToTarget: false }) ?? []],
        [Types.Messages.INTENT, 3, 'move.input', encodeMoveInputIntentPayload({ keysMask: 0 }) ?? []],
        [Types.Messages.CHAT, 'chat payload'],
        [Types.Messages.WHO, 42, 99, 123],
        [Types.Messages.ZONE],
    ];

    const encoded = encodeBinaryActionBatchPayload(batch);
    const decoded = decodeBinaryActionBatchPayload(encoded);

    expect(normalizeBinaryValues(decoded)).toEqual(normalizeBinaryValues(batch));
});

test('custom-efficient runtime action codec round-trips server action batches', () => {
    const batch: unknown[] = [
        [Types.Messages.POPULATION, 12, 33],
        [Types.Messages.HP, 120],
        [Types.Messages.REJECT, 9, 'move.step', 'Invalid move.step (non-adjacent).'],
        [Types.Messages.MOVE_SYNC, 9, 155, 114, 1234, 1],
    ];

    const encoded = encodeBinaryActionBatchPayload(batch);
    const decoded = decodeBinaryActionBatchPayload(encoded);

    expect(normalizeBinaryValues(decoded)).toEqual(normalizeBinaryValues(batch));
});

test('custom-efficient runtime action codec round-trips single action arrays', () => {
    const action = [Types.Messages.ZONE];
    const encoded = encodeBinaryActionBatchPayload(action);
    const decoded = decodeBinaryActionBatchPayload(encoded);

    expect(normalizeBinaryValues(decoded)).toEqual(normalizeBinaryValues(action));
});

test('custom-efficient runtime action codec rejects malformed payload tokens', () => {
    const encoded = encodeBinaryActionBatchPayload([[Types.Messages.ZONE]]);
    const corrupted = encoded.slice();
    // Frame header is 8 bytes, first payload token follows.
    corrupted[8] = 0xff;

    expect(() => decodeBinaryActionBatchPayload(corrupted)).toThrow();
});
