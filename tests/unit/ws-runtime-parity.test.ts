import { afterEach, beforeEach, expect, test } from 'bun:test';
import WSEsm from '../../server/ws-runtime-esm';

const originalConsoleInfo = console.info;

type Handler = (...args: unknown[]) => void;

beforeEach(() => {
    console.info = () => {
        // silence ws close logs in parity tests
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

const runtimes = [{ label: 'esm', ws: WSEsm }] as const;

for (const runtime of runtimes) {
    test(`ws runtime parity (${runtime.label}): malformed JSON closes with INVALID_PAYLOAD`, () => {
        const socket = createSocketMock();
        const server = { removeConnection() {} };
        const conn = new runtime.ws.wsWebSocketConnection('id-parity-invalid', socket, server, '127.0.0.1');
        let listened = false;

        conn.listen(() => {
            listened = true;
        });
        socket.emit('message', '{', false);

        expect(listened).toBe(false);
        expect(socket.getClosed()?.code).toBe(runtime.ws.CLOSE_CODES.INVALID_PAYLOAD);
    });

    test(`ws runtime parity (${runtime.label}): send serializes protocol action arrays`, () => {
        const socket = createSocketMock();
        const server = { removeConnection() {} };
        const conn = new runtime.ws.wsWebSocketConnection('id-parity-send', socket, server, '127.0.0.1');

        conn.send([1, 2, 3]);

        expect(socket.getSent()).toEqual(['[1,2,3]']);
    });

    test(`ws runtime parity (${runtime.label}): close defaults to NORMAL code`, () => {
        const socket = createSocketMock();
        const server = { removeConnection() {} };
        const conn = new runtime.ws.wsWebSocketConnection('id-parity-close', socket, server, '127.0.0.1');

        conn.close('normal close');

        expect(socket.getClosed()?.code).toBe(runtime.ws.CLOSE_CODES.NORMAL);
    });
}
