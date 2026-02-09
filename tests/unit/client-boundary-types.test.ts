import { expect, test } from 'bun:test';
import type {
    ClientInboundProtocolAction,
    ClientOutboundProtocolAction,
    ClientProtocolAction,
    ClientProtocolBatch,
    EntityFactoryContract,
    GameClientProtocolBoundary,
} from '../../client/js-esm/client-boundary-types';
import { isProtocolAction, normalizeProtocolActionBatch } from '../../client/js-esm/protocol-payload';

test('client protocol payload helper normalizes protocol action batches', () => {
    const singleAction: ClientProtocolAction = [1, 7, 'hello', 10, 20, 100];
    const batchAction: unknown = [[3, 42], [22, 99], ['oops']];
    const expectedBatch: ClientProtocolBatch = [
        [3, 42],
        [22, 99],
    ];

    expect(isProtocolAction(singleAction)).toBe(true);
    expect(isProtocolAction(['not-opcode'])).toBe(false);
    expect(normalizeProtocolActionBatch(singleAction)).toEqual([singleAction]);
    expect(normalizeProtocolActionBatch(batchAction)).toEqual(expectedBatch);
    expect(normalizeProtocolActionBatch({ nope: true })).toEqual([]);
});

test('client boundary TypeScript contracts accept seam-compliant shapes', () => {
    const inboundAction: ClientInboundProtocolAction = [3, 42];
    const outboundAction: ClientOutboundProtocolAction = [4, 12, 34];
    const protocolBatch: ClientProtocolBatch = [inboundAction];

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

    boundary.receiveAction(inboundAction);
    boundary.receiveActionBatch(protocolBatch);
    boundary.sendMessage(outboundAction);
    expect(entityFactory.createEntity(1, 'abc')).toEqual({ id: 'entity' });
});
