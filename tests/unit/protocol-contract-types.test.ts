import { expect, test } from 'bun:test';
import ProtocolEsm from '../../shared/js/protocol-contract-esm';
import {
    PROTOCOL_CONTRACT_FUNCTION_KEYS,
    PROTOCOL_CONTRACT_KEYS,
    PROTOCOL_CONTRACT_NUMERIC_KEYS,
} from '../../shared/js/protocol-contract-types';
import ProtocolContract from '../../shared/js/protocol-contract';

test('protocol TS key inventory aligns with runtime CJS/ESM protocol contract exports', () => {
    for (const key of PROTOCOL_CONTRACT_NUMERIC_KEYS) {
        expect(typeof ProtocolContract[key]).toBe('number');
        expect(ProtocolEsm[key]).toBe(ProtocolContract[key]);
    }

    for (const key of PROTOCOL_CONTRACT_FUNCTION_KEYS) {
        expect(typeof ProtocolContract[key]).toBe('function');
        expect(typeof ProtocolEsm[key]).toBe('function');
    }

    expect(ProtocolEsm.parseProtocolActionBatch('[4,10,20]')).toEqual(
        ProtocolContract.parseProtocolActionBatch('[4,10,20]')
    );
    expect(ProtocolEsm.parseProtocolActionBatch('[[4,10,20],[11,"hi"]]')).toEqual(
        ProtocolContract.parseProtocolActionBatch('[[4,10,20],[11,"hi"]]')
    );

    expect(PROTOCOL_CONTRACT_KEYS).toEqual([...PROTOCOL_CONTRACT_NUMERIC_KEYS, ...PROTOCOL_CONTRACT_FUNCTION_KEYS]);
});
