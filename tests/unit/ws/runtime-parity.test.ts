import { afterEach, beforeEach, expect, test } from 'bun:test';
import WsRuntimeModule from '../../../server/ws/runtime';
import { decodeServerToClientProtocolActionBatchBinary } from '../../../shared/protocol/registry';
import Types from '../../../shared/gametypes-browser';

const originalConsoleInfo = console.info;

type SocketArg = string | number | boolean | null | undefined | object | ArrayBuffer | Uint8Array;
type Handler = (...args: SocketArg[]) => void;

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

const runtimes = [{ label: 'runtime', ws: WsRuntimeModule }] as const;

for (const runtime of runtimes) {
    test(`ws runtime parity (${runtime.label}): text gameplay frame closes with UNSUPPORTED_DATA`, () => {
        const socket = createSocketMock();
        const server = { removeConnection() {} };
        const conn = new runtime.ws.wsWebSocketConnection('id-parity-invalid', socket, server, '127.0.0.1');
        let listened = false;

        conn.listen(() => {
            listened = true;
        });
        socket.emit('message', '[1,2,3]', false);

        expect(listened).toBe(false);
        expect(socket.getClosed()?.code).toBe(runtime.ws.CLOSE_CODES.UNSUPPORTED_DATA);
    });

    test(`ws runtime parity (${runtime.label}): malformed binary closes with INVALID_PAYLOAD`, () => {
        const socket = createSocketMock();
        const server = { removeConnection() {} };
        const conn = new runtime.ws.wsWebSocketConnection('id-parity-bad-binary', socket, server, '127.0.0.1');
        let listened = false;

        conn.listen(() => {
            listened = true;
        });
        socket.emit('message', new Uint8Array([0x00, 0x01, 0x02]), true);

        expect(listened).toBe(false);
        expect(socket.getClosed()?.code).toBe(runtime.ws.CLOSE_CODES.INVALID_PAYLOAD);
    });

    test(`ws runtime parity (${runtime.label}): send encodes protocol action arrays to binary`, () => {
        const socket = createSocketMock();
        const server = { removeConnection() {} };
        const conn = new runtime.ws.wsWebSocketConnection('id-parity-send', socket, server, '127.0.0.1');

        conn.send([Types.Messages.HP, 99]);

        const sent = socket.getSent();
        expect(sent.length).toBe(1);
        const payload = sent[0];
        expect(payload instanceof Uint8Array || payload instanceof ArrayBuffer).toBe(true);
        const decoded = decodeServerToClientProtocolActionBatchBinary(payload as Uint8Array | ArrayBuffer);
        expect(decoded).toEqual([[Types.Messages.HP, 99]]);
    });

    test(`ws runtime parity (${runtime.label}): close defaults to NORMAL code`, () => {
        const socket = createSocketMock();
        const server = { removeConnection() {} };
        const conn = new runtime.ws.wsWebSocketConnection('id-parity-close', socket, server, '127.0.0.1');

        conn.close('normal close');

        expect(socket.getClosed()?.code).toBe(runtime.ws.CLOSE_CODES.NORMAL);
    });
}
