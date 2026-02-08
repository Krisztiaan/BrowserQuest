import { expect, test } from 'bun:test';
import type {
    ClientProtocolAction,
    ClientProtocolBatch,
    EntityFactoryContract,
    GameClientProtocolBoundary,
} from '../../client/js-esm/client-boundary-types';
import { isProtocolAction, normalizeProtocolActionBatch } from '../../client/js-esm/protocol-payload';

test('client protocol payload helper normalizes protocol action batches', () => {
    const singleAction: ClientProtocolAction = [1, 'hello', true, null, 42];
    const batchAction: unknown = [[1, 'hello'], [2, 99], ['oops']];
    const expectedBatch: ClientProtocolBatch = [
        [1, 'hello'],
        [2, 99],
    ];

    expect(isProtocolAction(singleAction)).toBe(true);
    expect(isProtocolAction(['not-opcode'])).toBe(false);
    expect(normalizeProtocolActionBatch(singleAction)).toEqual([singleAction]);
    expect(normalizeProtocolActionBatch(batchAction)).toEqual(expectedBatch);
    expect(normalizeProtocolActionBatch({ nope: true })).toEqual([]);
});

test('client boundary TypeScript contracts accept seam-compliant shapes', () => {
    const protocolAction: ClientProtocolAction = [3, 'payload'];
    const protocolBatch: ClientProtocolBatch = [protocolAction];

    const boundary: GameClientProtocolBoundary = {
        receiveAction(data) {
            expect(Array.isArray(data)).toBe(true);
        },
        receiveActionBatch(actions) {
            expect(actions.length).toBeGreaterThanOrEqual(0);
        },
        sendMessage(payload) {
            expect(payload[0]).toBeTypeOf('number');
        },
    };

    const entityFactory: EntityFactoryContract = {
        builders: [],
        createEntity() {
            return { id: 'entity' };
        },
    };

    boundary.receiveAction(protocolAction);
    boundary.receiveActionBatch(protocolBatch);
    boundary.sendMessage(protocolAction);
    expect(entityFactory.createEntity(1, 'abc')).toEqual({ id: 'entity' });
});
