import { expect, test } from 'bun:test';
import Types from '../../../shared/gametypes-browser';
import { isServerToClientProtocolAction } from '../../../shared/protocol/schema';
import { decodeServerToClientProtocolActionBatch } from '../../../shared/protocol/registry';

test('protocol validates ACK and CORRECTION message shapes', () => {
    expect(isServerToClientProtocolAction([Types.Messages.ACK, 1])).toBe(true);
    expect(isServerToClientProtocolAction([Types.Messages.ACK, '1'])).toBe(false);

    expect(isServerToClientProtocolAction([Types.Messages.CORRECTION, 1, 10, 11])).toBe(true);
    expect(isServerToClientProtocolAction([Types.Messages.CORRECTION, 2, 'position', '{"x":10,"y":11}'])).toBe(true);
    expect(isServerToClientProtocolAction([Types.Messages.CORRECTION, 3, 10, '11'])).toBe(false);
});

test('batch decode accepts ACK/CORRECTION frames and drops invalid entries', () => {
    expect(decodeServerToClientProtocolActionBatch(JSON.stringify([[Types.Messages.ACK, 1], [Types.Messages.CORRECTION, 1, 2, 3]]))).toEqual([
        [Types.Messages.ACK, 1],
        [Types.Messages.CORRECTION, 1, 2, 3],
    ]);
    expect(decodeServerToClientProtocolActionBatch(JSON.stringify([[Types.Messages.ACK, 'nope']]))).toEqual([]);
});

