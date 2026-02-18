import { expect, test } from 'bun:test';
import { createWebSocketRuntimeClasses } from '../../../server/ws/runtime-factory';
import type { ProtocolParsedAction } from '../../../shared/protocol/types';
import Types from '../../../shared/gametypes-browser';
import {
    decodeServerToClientProtocolActionBatchBinary,
    encodeProtocolActionBinary,
} from '../../../shared/protocol/registry';

type SocketArg = string | number | boolean | null | undefined | object | Uint8Array | ArrayBuffer;
type Handler = (...args: SocketArg[]) => void;

function createSocketMock() {
    const handlers: Record<string, Handler> = {};
    let closed: { code: number; reason: string } | null = null;
    const sent: Array<string | Uint8Array | ArrayBuffer> = [];

    return {
        on(event: string, handler: Handler) {
            handlers[event] = handler;
        },
        emit(event: string, ...args: SocketArg[]) {
            handlers[event]?.(...args);
        },
        close(code: number, reason: string) {
            closed = { code, reason };
        },
        send(data: string | Uint8Array | ArrayBuffer) {
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

function createFactoryDeps() {
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
            parseProtocolActionBatch: (_payload: string): ProtocolParsedAction[] => [],
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

test('ws runtime class factory rejects text gameplay frames', () => {
    const deps = createFactoryDeps();
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
    expect(socket.getClosed()?.code).toBe(deps.CLOSE_CODES.UNSUPPORTED_DATA);
});

test('ws runtime class factory emits connection class that forwards valid protocol actions', () => {
    const deps = createFactoryDeps();
    const { wsWebSocketConnection } = createWebSocketRuntimeClasses(deps);

    const socket = createSocketMock();
    const server = { removeConnection() {} };
    const conn = new wsWebSocketConnection('id-factory-2', socket, server, '127.0.0.1');
    let received: ProtocolParsedAction | null = null;

    conn.listen((action: ProtocolParsedAction) => {
        received = action;
    });
    socket.emit('message', encodeProtocolActionBinary([Types.Messages.ZONE]), true);
    conn.send([Types.Messages.HP, 55]);

    expect(received).toEqual([Types.Messages.ZONE]);
    expect(socket.getClosed()).toBeNull();
    const sent = socket.getSent();
    expect(sent.length).toBe(1);
    const decoded = decodeServerToClientProtocolActionBatchBinary(sent[0] as Uint8Array | ArrayBuffer);
    expect(decoded).toEqual([[Types.Messages.HP, 55]]);
});
