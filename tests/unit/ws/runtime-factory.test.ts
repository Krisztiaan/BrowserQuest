import { expect, test } from 'bun:test';
import { createWebSocketRuntimeClasses } from '../../../server/ws/runtime-factory';
import type { ProtocolParsedAction } from '../../../shared/protocol/types';

type Handler = (...args: unknown[]) => void;

function createSocketMock() {
    const handlers: Record<string, Handler> = {};
    let closed: { code: number; reason: string } | null = null;
    const sent: string[] = [];

    return {
        on(event: string, handler: Handler) {
            handlers[event] = handler;
        },
        emit(event: string, ...args: unknown[]) {
            handlers[event]?.(...args);
        },
        close(code: number, reason: string) {
            closed = { code, reason };
        },
        send(data: string) {
            sent.push(data);
        },
        getClosed() {
            return closed;
        },
        getSent() {
            return sent.slice();
        },
    };
}

function createFactoryDeps(overrideProtocolParser?: (payload: string) => ProtocolParsedAction[]) {
    return {
        log: {
            info: () => {
                // no-op
            },
            error: () => {
                // no-op
            },
            event: () => {
                // no-op
            },
        },
        Utils: {
            random: () => 7,
        },
        Protocol: {
            parseProtocolActionBatch: overrideProtocolParser || (() => []),
        },
        CLOSE_CODES: {
            NORMAL: 1000,
            UNSUPPORTED_DATA: 1003,
            INVALID_PAYLOAD: 1007,
        },
        WebSocket: {
            WebSocketServer: class {
                on() {
                    // no-op
                }
            },
        },
        createHttpServer: () => ({
            listen: (_port: number, callback: () => void) => callback(),
        }),
        parseUrlPathname: () => '/',
        logConnectionEvent: () => {
            // no-op
        },
    };
}

test('ws runtime class factory emits connection class that enforces single-action payloads', () => {
    const deps = createFactoryDeps(() => []);
    const { wsWebSocketConnection } = createWebSocketRuntimeClasses(deps);

    const socket = createSocketMock();
    const server = { removeConnection() {} };
    const conn = new wsWebSocketConnection('id-factory-1', socket, server, '127.0.0.1');
    let listened = false;

    conn.listen(() => {
        listened = true;
    });
    socket.emit('message', '{"invalid":true}', false);

    expect(listened).toBe(false);
    expect(socket.getClosed()?.code).toBe(deps.CLOSE_CODES.INVALID_PAYLOAD);
});

test('ws runtime class factory emits connection class that forwards valid protocol actions', () => {
    const deps = createFactoryDeps(() => [[1, 2, 3]]);
    const { wsWebSocketConnection } = createWebSocketRuntimeClasses(deps);

    const socket = createSocketMock();
    const server = { removeConnection() {} };
    const conn = new wsWebSocketConnection('id-factory-2', socket, server, '127.0.0.1');
    let received: unknown = null;

    conn.listen((action: unknown) => {
        received = action;
    });
    socket.emit('message', '[1,2,3]', false);
    conn.send([4, 5, 6]);

    expect(received).toEqual([1, 2, 3]);
    expect(socket.getClosed()).toBeNull();
    expect(socket.getSent()).toEqual(['[4,5,6]']);
});
