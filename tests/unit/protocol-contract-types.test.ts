import { expect, test } from 'bun:test';
import ProtocolEsm from '../../shared/js/protocol-contract-esm.ts';
import {
    PROTOCOL_CONTRACT_FUNCTION_KEYS,
    PROTOCOL_CONTRACT_KEYS,
    PROTOCOL_CONTRACT_NUMERIC_KEYS,
} from '../../shared/js/protocol-contract-types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ProtocolCjs = require('../../shared/js/protocol-contract');

test('protocol TS key inventory aligns with runtime CJS/ESM protocol contract exports', () => {
    for (const key of PROTOCOL_CONTRACT_NUMERIC_KEYS) {
        expect(typeof ProtocolCjs[key]).toBe('number');
        expect(ProtocolEsm[key]).toBe(ProtocolCjs[key]);
    }

    for (const key of PROTOCOL_CONTRACT_FUNCTION_KEYS) {
        expect(typeof ProtocolCjs[key]).toBe('function');
        expect(typeof ProtocolEsm[key]).toBe('function');
    }

    expect(ProtocolEsm.parseProtocolActionBatch('[4,10,20]')).toEqual(
        ProtocolCjs.parseProtocolActionBatch('[4,10,20]')
    );
    expect(ProtocolEsm.parseProtocolActionBatch('[[4,10,20],[11,"hi"]]')).toEqual(
        ProtocolCjs.parseProtocolActionBatch('[[4,10,20],[11,"hi"]]')
    );

    expect(PROTOCOL_CONTRACT_KEYS).toEqual([...PROTOCOL_CONTRACT_NUMERIC_KEYS, ...PROTOCOL_CONTRACT_FUNCTION_KEYS]);
});
