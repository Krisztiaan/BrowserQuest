import { expect, test } from 'bun:test';
import WsRuntimeModule, {
    createWebSocketRuntimeClasses as createWebSocketRuntimeClassesRuntime,
} from '../../server/ws-runtime';

test('ws runtime boundary decision: websocket seam contract remains stable', () => {
    expect(typeof createWebSocketRuntimeClassesRuntime).toBe('function');
    expect(WsRuntimeModule.createWebSocketRuntimeClasses).toBe(createWebSocketRuntimeClassesRuntime);
    expect(typeof WsRuntimeModule.wsWebSocketConnection).toBe('function');
    expect(typeof WsRuntimeModule.MultiVersionWebsocketServer).toBe('function');
    expect(WsRuntimeModule.CLOSE_CODES.INVALID_PAYLOAD).toBe(1007);
    expect(WsRuntimeModule.CLOSE_CODES.UNSUPPORTED_DATA).toBe(1003);
});
