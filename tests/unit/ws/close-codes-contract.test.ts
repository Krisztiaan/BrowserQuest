import { expect, test } from 'bun:test';
import CloseCodesEsm, { INVALID_PAYLOAD, NORMAL, UNSUPPORTED_DATA } from '../../../shared/ws-close-codes';
import WS from '../../../server/ws/runtime';

test('ws close code contract keeps shared/runtime parity', () => {
    expect(NORMAL).toBe(CloseCodesEsm.NORMAL);
    expect(UNSUPPORTED_DATA).toBe(CloseCodesEsm.UNSUPPORTED_DATA);
    expect(INVALID_PAYLOAD).toBe(CloseCodesEsm.INVALID_PAYLOAD);
});

test('server websocket transport exposes shared close code contract', () => {
    expect(WS.CLOSE_CODES).toEqual(CloseCodesEsm);
    expect(WS.CLOSE_CODES.INVALID_PAYLOAD).toBe(1007);
    expect(WS.CLOSE_CODES.UNSUPPORTED_DATA).toBe(1003);
});
