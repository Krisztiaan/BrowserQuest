import { expect, test } from 'bun:test';
import ProtocolEsm, {
    MSG_CHAT,
    MSG_HELLO,
    MSG_MOVE,
    parseProtocolActionBatch as parseProtocolActionBatchEsm,
} from '../../shared/js/protocol-contract-esm.mjs';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ProtocolCjs = require('../../shared/js/protocol-contract');

test('shared protocol contract ESM bridge mirrors CJS exports', () => {
    expect(MSG_HELLO).toBe(ProtocolCjs.MSG_HELLO);
    expect(MSG_MOVE).toBe(ProtocolCjs.MSG_MOVE);
    expect(MSG_CHAT).toBe(ProtocolCjs.MSG_CHAT);
    expect(ProtocolEsm.MSG_ZONE).toBe(ProtocolCjs.MSG_ZONE);
    expect(ProtocolEsm.ENTITY_CLOTH_ARMOR).toBe(ProtocolCjs.ENTITY_CLOTH_ARMOR);
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
