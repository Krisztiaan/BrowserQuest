import { expect, test } from 'bun:test';
import {
    PROTOCOL_CONTRACT_FUNCTION_KEYS,
    PROTOCOL_CONTRACT_KEYS,
    PROTOCOL_CONTRACT_NUMERIC_KEYS,
} from '../../shared/js/protocol-contract-types';
import ProtocolContract from '../../shared/js/protocol-contract';

test('protocol TS key inventory aligns with canonical runtime protocol contract exports', () => {
    for (const key of PROTOCOL_CONTRACT_NUMERIC_KEYS) {
        expect(typeof ProtocolContract[key]).toBe('number');
    }

    for (const key of PROTOCOL_CONTRACT_FUNCTION_KEYS) {
        expect(typeof ProtocolContract[key]).toBe('function');
    }

    expect(ProtocolContract.parseProtocolActionBatch('[4,10,20]')).toEqual([[4, 10, 20]]);
    expect(ProtocolContract.parseProtocolActionBatch('[[4,10,20],[11,"hi"]]')).toEqual([
        [4, 10, 20],
        [11, 'hi'],
    ]);

    expect(PROTOCOL_CONTRACT_KEYS).toEqual([...PROTOCOL_CONTRACT_NUMERIC_KEYS, ...PROTOCOL_CONTRACT_FUNCTION_KEYS]);
});
