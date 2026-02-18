import { expect, test } from 'bun:test';
import { decodeBinaryActionBatchPayload, encodeBinaryActionBatchPayload } from '../../../shared/protocol/binary-action-codec';

test('custom binary action codec round-trips mixed payload batches', () => {
    const batch: unknown[] = [
        [29, 1, 'move.step', [155, 114]],
        [12, 500000000, 'chat payload', null, true, false, 1.5, -33, 64],
        [15, 42, [1, 2, 3], ['nested', [null, true, -1]]],
    ];

    const encoded = encodeBinaryActionBatchPayload(batch);
    const decoded = decodeBinaryActionBatchPayload(encoded);

    expect(decoded).toEqual(batch);
});

test('custom binary action codec round-trips single action arrays', () => {
    const action = [23, 100];
    const encoded = encodeBinaryActionBatchPayload(action);
    const decoded = decodeBinaryActionBatchPayload(encoded);

    expect(decoded).toEqual(action);
});

test('custom binary action codec rejects malformed payload tokens', () => {
    const encoded = encodeBinaryActionBatchPayload([[21]]);
    const corrupted = encoded.slice();
    // Frame header is 8 bytes, first payload token follows.
    corrupted[8] = 0xff;

    expect(() => decodeBinaryActionBatchPayload(corrupted)).toThrow();
});
