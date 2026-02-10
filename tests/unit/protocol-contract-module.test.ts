import { expect, test } from 'bun:test';
import ProtocolEsm, {
    MSG_CHAT,
    MSG_HELLO,
    MSG_MOVE,
    parseProtocolActionBatch as parseProtocolActionBatchEsm,
} from '../../shared/js/protocol-contract-esm';
import ProtocolContract from '../../shared/js/protocol-contract';

test('shared protocol contract ESM bridge mirrors CJS exports', () => {
    expect(MSG_HELLO).toBe(ProtocolContract.MSG_HELLO);
    expect(MSG_MOVE).toBe(ProtocolContract.MSG_MOVE);
    expect(MSG_CHAT).toBe(ProtocolContract.MSG_CHAT);
    expect(ProtocolEsm.MSG_ZONE).toBe(ProtocolContract.MSG_ZONE);
    expect(ProtocolEsm.ENTITY_CLOTH_ARMOR).toBe(ProtocolContract.ENTITY_CLOTH_ARMOR);
});

test('shared protocol contract parser normalizes single and batched actions', () => {
    expect(parseProtocolActionBatchEsm('[4,10,20]')).toEqual([[4, 10, 20]]);
    expect(parseProtocolActionBatchEsm('[[4,10,20],[11,"hi"]]')).toEqual([
        [4, 10, 20],
        [11, 'hi'],
    ]);
    expect(parseProtocolActionBatchEsm('{"action":"move"}')).toEqual([]);
    expect(parseProtocolActionBatchEsm('{"bad":')).toEqual([]);
});
