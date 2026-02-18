import { afterEach, beforeEach, expect, test } from 'bun:test';
import WS from '../../../server/ws/runtime';
import type { ProtocolParsedAction } from '../../../shared/protocol/types';
import Types from '../../../shared/gametypes-browser';
import {
    decodeServerToClientProtocolActionBatchBinary,
    encodeClientToServerProtocolActionBatchBinary,
    encodeClientToServerProtocolActionBinary,
} from '../../../shared/protocol/registry';
import { ENTITY_CLOTH_ARMOR, ENTITY_SWORD_1, MSG_HELLO } from '../../support/protocol/contract';
const originalConsoleInfo = console.info;

type SocketArg = string | number | boolean | null | undefined | object;
type Handler = (...args: SocketArg[]) => void;

beforeEach(() => {
    console.info = () => {
        // silence ws close logs in unit tests
    };
});

afterEach(() => {
    console.info = originalConsoleInfo;
});

function createSocketMock() {
    const handlers: Record<string, Handler> = {};
    let closed: { code: number; reason: string } | null = null;
    const sent: unknown[] = [];

    return {
        on(event: string, handler: Handler) {
            handlers[event] = handler;
        },
        emit(event: string, ...args: SocketArg[]) {
            if (handlers[event]) {
                handlers[event](...args);
            }
        },
        close(code: number, reason: string) {
            closed = { code, reason };
        },
        send(data: unknown) {
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

test('ws connection close uses provided code and trims reason length', () => {
    const socket = createSocketMock();
    const server = { removeConnection() {} };
    const conn = new WS.wsWebSocketConnection('id-1', socket, server, '127.0.0.1');
    const longReason = 'x'.repeat(300);

    conn.close(longReason, WS.CLOSE_CODES.INVALID_PAYLOAD);

    const closed = socket.getClosed();
    expect(closed).not.toBeNull();
    expect(closed?.code).toBe(WS.CLOSE_CODES.INVALID_PAYLOAD);
    expect(closed?.reason.length).toBeLessThanOrEqual(120);
});

test('ws connection close defaults to normal code when close code is invalid', () => {
    const socket = createSocketMock();
    const server = { removeConnection() {} };
    const conn = new WS.wsWebSocketConnection('id-close-default', socket, server, '127.0.0.1');

    conn.close('normal closure');

    expect(socket.getClosed()?.code).toBe(WS.CLOSE_CODES.NORMAL);
});

test('ws connection closes with unsupported-data code on text frames (even if they look like json)', () => {
    const socket = createSocketMock();
    const server = { removeConnection() {} };
    const conn = new WS.wsWebSocketConnection('id-2', socket, server, '127.0.0.1');
    let listened = false;

    conn.listen(() => {
        listened = true;
    });

    socket.emit('message', '{', false);

    expect(listened).toBe(false);
    expect(socket.getClosed()?.code).toBe(WS.CLOSE_CODES.UNSUPPORTED_DATA);
});

test('ws connection closes with unsupported-data code on text frames (even if they are valid json)', () => {
    const socket = createSocketMock();
    const server = { removeConnection() {} };
    const conn = new WS.wsWebSocketConnection('id-3', socket, server, '127.0.0.1');
    let listened = false;

    conn.listen(() => {
        listened = true;
    });

    socket.emit('message', '{"action":"chat"}', false);

    expect(listened).toBe(false);
    expect(socket.getClosed()?.code).toBe(WS.CLOSE_CODES.UNSUPPORTED_DATA);
});

test('ws connection forwards a single valid binary protocol action to listener', () => {
    const socket = createSocketMock();
    const server = { removeConnection() {} };
    const conn = new WS.wsWebSocketConnection('id-4', socket, server, '127.0.0.1');
    let received: ProtocolParsedAction | null = null;

    conn.listen((payload: ProtocolParsedAction) => {
        received = payload;
    });

    const hello = [MSG_HELLO, 'player', ENTITY_CLOTH_ARMOR, ENTITY_SWORD_1] as const;
    const payload = encodeClientToServerProtocolActionBinary(hello as any);
    socket.emit('message', payload, true);

    expect(received).toEqual(hello);
    expect(socket.getClosed()).toBeNull();
});

test('ws connection rejects binary payloads that decode to more than one action', () => {
    const socket = createSocketMock();
    const server = { removeConnection() {} };
    const conn = new WS.wsWebSocketConnection('id-5', socket, server, '127.0.0.1');
    let listened = false;

    conn.listen(() => {
        listened = true;
    });

    const hello = [MSG_HELLO, 'player', ENTITY_CLOTH_ARMOR, ENTITY_SWORD_1] as const;
    const batch = encodeClientToServerProtocolActionBatchBinary([hello as any, hello as any]);
    socket.emit('message', batch, true);

    expect(listened).toBe(false);
    expect(socket.getClosed()?.code).toBe(WS.CLOSE_CODES.INVALID_PAYLOAD);
});

test('ws connection closes with invalid payload code on malformed binary payload', () => {
    const socket = createSocketMock();
    const server = { removeConnection() {} };
    const conn = new WS.wsWebSocketConnection('id-6', socket, server, '127.0.0.1');
    let listened = false;

    conn.listen(() => {
        listened = true;
    });

    socket.emit('message', Buffer.from([1, 2, 3]), true);

    expect(listened).toBe(false);
    expect(socket.getClosed()?.code).toBe(WS.CLOSE_CODES.INVALID_PAYLOAD);
});

test('ws connection close event removes connection and triggers close callback', () => {
    const socket = createSocketMock();
    let removedId: string | null = null;
    const server = {
        removeConnection(id: string) {
            removedId = id;
        },
    };
    const conn = new WS.wsWebSocketConnection('id-close-lifecycle', socket, server, '127.0.0.1');
    let closed = false;

    conn.onClose(() => {
        closed = true;
    });

    socket.emit('close');

    expect(closed).toBe(true);
    expect(removedId).toBe('id-close-lifecycle');
});

test('ws connection send serializes protocol payload as binary', () => {
    const socket = createSocketMock();
    const server = { removeConnection() {} };
    const conn = new WS.wsWebSocketConnection('id-send-json', socket, server, '127.0.0.1');

    conn.send([Types.Messages.ACK, 123]);

    const sent = socket.getSent();
    expect(sent.length).toBe(1);
    const payload = sent[0];
    expect(payload).toBeInstanceOf(Uint8Array);
    const decoded = decodeServerToClientProtocolActionBatchBinary(payload as Uint8Array);
    expect(decoded).toEqual([[Types.Messages.ACK, 123]]);
});
