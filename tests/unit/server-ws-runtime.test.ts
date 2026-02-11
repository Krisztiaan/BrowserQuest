import { expect, test } from 'bun:test';
import WsRuntimeModule, {
    CLOSE_CODES as CLOSE_CODES_ESM,
    createWebSocketRuntimeClasses as createWebSocketRuntimeClassesEsm,
    MultiVersionWebsocketServer as MultiVersionWebsocketServerESM,
    wsWebSocketConnection as WsWebSocketConnectionESM,
} from '../../server/ws-runtime';

test('ws runtime exports websocket contract', () => {
    expect(typeof WsRuntimeModule).toBe('object');
    expect(WsRuntimeModule.CLOSE_CODES).toBe(CLOSE_CODES_ESM);
    expect(WsRuntimeModule.MultiVersionWebsocketServer).toBe(MultiVersionWebsocketServerESM);
    expect(WsRuntimeModule.wsWebSocketConnection).toBe(WsWebSocketConnectionESM);
    expect(WsRuntimeModule.createWebSocketRuntimeClasses).toBe(createWebSocketRuntimeClassesEsm);
    expect(CLOSE_CODES_ESM.INVALID_PAYLOAD).toBe(1007);
    expect(CLOSE_CODES_ESM.UNSUPPORTED_DATA).toBe(1003);
    expect(typeof createWebSocketRuntimeClassesEsm).toBe('function');
    expect(typeof MultiVersionWebsocketServerESM).toBe('function');
    expect(typeof WsWebSocketConnectionESM).toBe('function');
});
