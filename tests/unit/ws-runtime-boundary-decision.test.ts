import { expect, test } from 'bun:test';
import WsRuntimeModule, {
    createWebSocketRuntimeClasses as createWebSocketRuntimeClassesEsm,
} from '../../server/ws-runtime';

test('ws runtime boundary decision: ESM websocket seam contract remains stable', () => {
    expect(typeof createWebSocketRuntimeClassesEsm).toBe('function');
    expect(WsRuntimeModule.createWebSocketRuntimeClasses).toBe(createWebSocketRuntimeClassesEsm);
    expect(typeof WsRuntimeModule.wsWebSocketConnection).toBe('function');
    expect(typeof WsRuntimeModule.MultiVersionWebsocketServer).toBe('function');
    expect(WsRuntimeModule.CLOSE_CODES.INVALID_PAYLOAD).toBe(1007);
    expect(WsRuntimeModule.CLOSE_CODES.UNSUPPORTED_DATA).toBe(1003);
});
