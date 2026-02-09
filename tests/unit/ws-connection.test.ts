// @ts-nocheck
import { afterEach, beforeEach, expect, test } from 'bun:test';
import WS from '../../server/js/ws-runtime-esm';
const originalConsoleInfo = console.info;

type Handler = (...args: unknown[]) => void;

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
    const sent: string[] = [];

    return {
        on(event: string, handler: Handler) {
            handlers[event] = handler;
        },
        emit(event: string, ...args: unknown[]) {
            if (handlers[event]) {
                handlers[event](...args);
            }
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

test('ws connection closes with invalid payload code on malformed json', () => {
    const socket = createSocketMock();
    const server = { removeConnection() {} };
    const conn = new WS.wsWebSocketConnection('id-2', socket, server, '127.0.0.1');
    let listened = false;

    conn.listen(() => {
        listened = true;
    });

    socket.emit('message', '{', false);

    expect(listened).toBe(false);
    expect(socket.getClosed()?.code).toBe(WS.CLOSE_CODES.INVALID_PAYLOAD);
});

test('ws connection closes with invalid payload code on non-array json', () => {
    const socket = createSocketMock();
    const server = { removeConnection() {} };
    const conn = new WS.wsWebSocketConnection('id-3', socket, server, '127.0.0.1');
    let listened = false;

    conn.listen(() => {
        listened = true;
    });

    socket.emit('message', '{"action":"chat"}', false);

    expect(listened).toBe(false);
    expect(socket.getClosed()?.code).toBe(WS.CLOSE_CODES.INVALID_PAYLOAD);
});

test('ws connection forwards valid array payload to listener', () => {
    const socket = createSocketMock();
    const server = { removeConnection() {} };
    const conn = new WS.wsWebSocketConnection('id-4', socket, server, '127.0.0.1');
    let received: unknown = null;

    conn.listen((payload: unknown) => {
        received = payload;
    });

    socket.emit('message', '[1,2,3]', false);

    expect(received).toEqual([1, 2, 3]);
    expect(socket.getClosed()).toBeNull();
});

test('ws connection rejects batched action arrays', () => {
    const socket = createSocketMock();
    const server = { removeConnection() {} };
    const conn = new WS.wsWebSocketConnection('id-5', socket, server, '127.0.0.1');
    let listened = false;

    conn.listen(() => {
        listened = true;
    });

    socket.emit('message', '[[1,2],[3,4]]', false);

    expect(listened).toBe(false);
    expect(socket.getClosed()?.code).toBe(WS.CLOSE_CODES.INVALID_PAYLOAD);
});

test('ws connection closes with unsupported-data code on binary payload', () => {
    const socket = createSocketMock();
    const server = { removeConnection() {} };
    const conn = new WS.wsWebSocketConnection('id-6', socket, server, '127.0.0.1');
    let listened = false;

    conn.listen(() => {
        listened = true;
    });

    socket.emit('message', Buffer.from([1, 2, 3]), true);

    expect(listened).toBe(false);
    expect(socket.getClosed()?.code).toBe(WS.CLOSE_CODES.UNSUPPORTED_DATA);
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

test('ws connection send serializes protocol payload as json', () => {
    const socket = createSocketMock();
    const server = { removeConnection() {} };
    const conn = new WS.wsWebSocketConnection('id-send-json', socket, server, '127.0.0.1');

    conn.send([1, 2, 3]);

    expect(socket.getSent()).toEqual(['[1,2,3]']);
});
