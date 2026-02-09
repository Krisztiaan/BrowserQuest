import { expect, test } from 'bun:test';
import WSEsm, {
    createWebSocketRuntimeClasses as createWebSocketRuntimeClassesEsm,
} from '../../server/js/ws-runtime-esm';

test('ws runtime boundary decision: ESM websocket seam contract remains stable', () => {
    expect(typeof createWebSocketRuntimeClassesEsm).toBe('function');
    expect(WSEsm.createWebSocketRuntimeClasses).toBe(createWebSocketRuntimeClassesEsm);
    expect(typeof WSEsm.wsWebSocketConnection).toBe('function');
    expect(typeof WSEsm.MultiVersionWebsocketServer).toBe('function');
    expect(WSEsm.CLOSE_CODES.INVALID_PAYLOAD).toBe(1007);
    expect(WSEsm.CLOSE_CODES.UNSUPPORTED_DATA).toBe(1003);
});
