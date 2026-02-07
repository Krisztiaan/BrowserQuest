import { expect, test } from 'bun:test';
import WSEsm, { createWebSocketRuntimeClasses as createWebSocketRuntimeClassesEsm } from '../../server/js/ws-esm.mjs';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const WSCjs = require('../../server/js/ws');

test('ws runtime boundary decision: ESM exposes class-factory seam while CJS keeps inline runtime assembly', () => {
    expect(typeof createWebSocketRuntimeClassesEsm).toBe('function');
    expect(WSEsm.createWebSocketRuntimeClasses).toBe(createWebSocketRuntimeClassesEsm);

    expect(WSCjs.createWebSocketRuntimeClasses).toBeUndefined();
    expect(typeof WSCjs.wsWebSocketConnection).toBe('function');
    expect(typeof WSCjs.MultiVersionWebsocketServer).toBe('function');
});
