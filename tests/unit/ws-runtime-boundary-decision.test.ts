import { expect, test } from 'bun:test';
import WSEsm, { createWebSocketRuntimeClasses as createWebSocketRuntimeClassesEsm } from '../../server/js/ws-esm.mjs';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const WSCjs = require('../../server/js/ws');

test('ws runtime boundary decision: CJS and ESM websocket seams remain contract-compatible', () => {
    expect(typeof createWebSocketRuntimeClassesEsm).toBe('function');
    expect(WSEsm.createWebSocketRuntimeClasses).toBe(createWebSocketRuntimeClassesEsm);

    expect(typeof WSCjs.createWebSocketRuntimeClasses).toBe('function');
    expect(typeof WSCjs.wsWebSocketConnection).toBe('function');
    expect(typeof WSCjs.MultiVersionWebsocketServer).toBe('function');

    expect(WSEsm.CLOSE_CODES).toEqual(WSCjs.CLOSE_CODES);
    expect(typeof WSEsm.wsWebSocketConnection).toBe('function');
    expect(typeof WSEsm.MultiVersionWebsocketServer).toBe('function');
});
