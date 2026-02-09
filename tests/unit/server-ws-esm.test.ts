import { expect, test } from 'bun:test';
import WSEsm, {
    CLOSE_CODES as CLOSE_CODES_ESM,
    createWebSocketRuntimeClasses as createWebSocketRuntimeClassesEsm,
    MultiVersionWebsocketServer as MultiVersionWebsocketServerESM,
    wsWebSocketConnection as WsWebSocketConnectionESM,
} from '../../server/js/ws-runtime-esm.ts';

test('ws runtime esm exports websocket contract', () => {
    expect(typeof WSEsm).toBe('object');
    expect(WSEsm.CLOSE_CODES).toBe(CLOSE_CODES_ESM);
    expect(WSEsm.MultiVersionWebsocketServer).toBe(MultiVersionWebsocketServerESM);
    expect(WSEsm.wsWebSocketConnection).toBe(WsWebSocketConnectionESM);
    expect(WSEsm.createWebSocketRuntimeClasses).toBe(createWebSocketRuntimeClassesEsm);
    expect(CLOSE_CODES_ESM.INVALID_PAYLOAD).toBe(1007);
    expect(CLOSE_CODES_ESM.UNSUPPORTED_DATA).toBe(1003);
    expect(typeof createWebSocketRuntimeClassesEsm).toBe('function');
    expect(typeof MultiVersionWebsocketServerESM).toBe('function');
    expect(typeof WsWebSocketConnectionESM).toBe('function');
});
