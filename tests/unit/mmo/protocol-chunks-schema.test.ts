import { expect, test } from 'bun:test';
import Types from '../../../shared/gametypes-browser';
import { checkClientToServerProtocolAction, isServerToClientProtocolAction } from '../../../shared/protocol/schema';
import {
    decodeClientToServerProtocolActionBatch,
    decodeServerToClientProtocolActionBatch,
} from '../../../shared/protocol/registry';

test('protocol schema accepts chunk subscribe/unsubscribe and chunk snapshot/delta envelopes', () => {
    expect(checkClientToServerProtocolAction([Types.Messages.CHUNK_SUBSCRIBE, 1, 2, 3])).toBe(true);
    expect(checkClientToServerProtocolAction([Types.Messages.CHUNK_UNSUBSCRIBE])).toBe(true);

    expect(isServerToClientProtocolAction([Types.Messages.CHUNK_SNAPSHOT, 1, 2, 7, [1, 2, 3]])).toBe(true);
    expect(isServerToClientProtocolAction([Types.Messages.CHUNK_SNAPSHOT_PART, 1, 2, 7, 0, 2, [1, 2, 3]])).toBe(true);
    expect(isServerToClientProtocolAction([Types.Messages.CHUNK_DELTA, 1, 2, 7, 8, [1, 2, 3]])).toBe(true);
});

test('batch decode accepts chunk frames and drops invalid entries', () => {
    expect(
        decodeClientToServerProtocolActionBatch(
            JSON.stringify([[Types.Messages.CHUNK_UNSUBSCRIBE], [Types.Messages.CHUNK_SUBSCRIBE, 1, 2, 3]])
        )
    ).toEqual([[Types.Messages.CHUNK_UNSUBSCRIBE], [Types.Messages.CHUNK_SUBSCRIBE, 1, 2, 3]]);

    expect(
        decodeServerToClientProtocolActionBatch(
            JSON.stringify([
                [Types.Messages.CHUNK_SNAPSHOT, 1, 2, 7, [1]],
                [Types.Messages.CHUNK_SNAPSHOT_PART, 1, 2, 7, 0, 2, [1]],
                [Types.Messages.CHUNK_DELTA, 1, 2, 7, 8, [1]],
            ])
        )
    ).toEqual([
        [Types.Messages.CHUNK_SNAPSHOT, 1, 2, 7, [1]],
        [Types.Messages.CHUNK_SNAPSHOT_PART, 1, 2, 7, 0, 2, [1]],
        [Types.Messages.CHUNK_DELTA, 1, 2, 7, 8, [1]],
    ]);

    expect(decodeClientToServerProtocolActionBatch(JSON.stringify([[Types.Messages.CHUNK_SUBSCRIBE, 1, 2]]))).toEqual(
        []
    );
    expect(decodeServerToClientProtocolActionBatch(JSON.stringify([[Types.Messages.CHUNK_SNAPSHOT, 1, 2, 7]]))).toEqual(
        []
    );
});
