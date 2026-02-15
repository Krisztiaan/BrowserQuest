import { expect, test } from 'bun:test';
import ProtocolContract, {
    MSG_CHAT,
    MSG_HELLO,
    MSG_MOVE,
    parseProtocolActionBatch,
} from '../../../shared/protocol/contract';

test('shared protocol contract exports stable canonical constants', () => {
    expect(MSG_HELLO).toBe(ProtocolContract.MSG_HELLO);
    expect(MSG_MOVE).toBe(ProtocolContract.MSG_MOVE);
    expect(MSG_CHAT).toBe(ProtocolContract.MSG_CHAT);
    expect(ProtocolContract.MSG_ZONE).toBeDefined();
    expect(ProtocolContract.ENTITY_CLOTH_ARMOR).toBeDefined();
});

test('shared protocol contract parser normalizes single and batched actions', () => {
    expect(parseProtocolActionBatch('[4,10,20]')).toEqual([[4, 10, 20]]);
    expect(parseProtocolActionBatch('[[4,10,20],[11,"hi"]]')).toEqual([
        [4, 10, 20],
        [11, 'hi'],
    ]);
    expect(parseProtocolActionBatch('[[4,10,20],{"bad":true}]')).toEqual([]);
    expect(parseProtocolActionBatch('{"action":"move"}')).toEqual([]);
    expect(parseProtocolActionBatch('{"bad":')).toEqual([]);
});
