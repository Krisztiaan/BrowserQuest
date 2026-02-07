import { expect, test } from 'bun:test';
import CloseCodesEsm, { INVALID_PAYLOAD, NORMAL, UNSUPPORTED_DATA } from '../../shared/js/ws-close-codes-esm.mjs';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const CloseCodesCjs = require('../../shared/js/ws-close-codes');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WS = require('../../server/js/ws');

test('ws close code contract keeps shared CJS/ESM parity', () => {
    expect(NORMAL).toBe(CloseCodesCjs.NORMAL);
    expect(UNSUPPORTED_DATA).toBe(CloseCodesCjs.UNSUPPORTED_DATA);
    expect(INVALID_PAYLOAD).toBe(CloseCodesCjs.INVALID_PAYLOAD);
    expect(CloseCodesEsm).toBe(CloseCodesCjs);
});

test('server websocket transport exposes shared close code contract', () => {
    expect(WS.CLOSE_CODES).toBe(CloseCodesCjs);
    expect(WS.CLOSE_CODES.INVALID_PAYLOAD).toBe(1007);
    expect(WS.CLOSE_CODES.UNSUPPORTED_DATA).toBe(1003);
});
