import { afterEach, beforeEach, expect, test } from 'bun:test';
import WS from '../../../server/ws/runtime';

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
        send() {
            // no-op
        },
        getClosed() {
            return closed;
        },
    };
}

test('ws runtime connection close uses provided code and trims reason length', () => {
    const socket = createSocketMock();
    const server = { removeConnection() {} };
    const conn = new WS.wsWebSocketConnection('id-runtime-1', socket, server, '127.0.0.1');
    const longReason = 'x'.repeat(300);

    conn.close(longReason, WS.CLOSE_CODES.INVALID_PAYLOAD);

    const closed = socket.getClosed();
    expect(closed).not.toBeNull();
    expect(closed?.code).toBe(WS.CLOSE_CODES.INVALID_PAYLOAD);
    expect(closed?.reason.length).toBeLessThanOrEqual(120);
});

test('ws runtime connection closes with invalid payload code on malformed json', () => {
    const socket = createSocketMock();
    const server = { removeConnection() {} };
    const conn = new WS.wsWebSocketConnection('id-runtime-2', socket, server, '127.0.0.1');
    let listened = false;

    conn.listen(() => {
        listened = true;
    });

    socket.emit('message', '{', false);

    expect(listened).toBe(false);
    expect(socket.getClosed()?.code).toBe(WS.CLOSE_CODES.INVALID_PAYLOAD);
});

test('ws runtime connection closes with unsupported-data code on binary payload', () => {
    const socket = createSocketMock();
    const server = { removeConnection() {} };
    const conn = new WS.wsWebSocketConnection('id-runtime-3', socket, server, '127.0.0.1');
    let listened = false;

    conn.listen(() => {
        listened = true;
    });

    socket.emit('message', Buffer.from([1, 2, 3]), true);

    expect(listened).toBe(false);
    expect(socket.getClosed()?.code).toBe(WS.CLOSE_CODES.UNSUPPORTED_DATA);
});
