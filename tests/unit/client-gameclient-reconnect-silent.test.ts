import { expect, test } from 'bun:test';
import { ClientWorldKernel } from '../../client/ecs/world-kernel';
import GameClient from '../../client/gameclient';

class MockWebSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;

    static instances: MockWebSocket[] = [];

    readonly url: string;
    readyState = MockWebSocket.OPEN;
    onopen: ((e: Event) => void) | null = null;
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    onclose: (() => void) | null = null;

    constructor(url: string) {
        this.url = url;
        MockWebSocket.instances.push(this);
    }

    send(_data: string | ArrayBufferLike | ArrayBufferView | Blob): void {}

    close(): void {
        this.readyState = MockWebSocket.CLOSED;
        this.onclose?.();
    }
}

test('GameClient.reconnectSilently does not emit disconnected for the intentional close', () => {
    const prevWs = globalThis.WebSocket;
    const prevDoc = 'document' in globalThis ? globalThis.document : undefined;

    Object.defineProperty(globalThis, 'WebSocket', {
        configurable: true,
        writable: true,
        value: MockWebSocket as typeof WebSocket,
    });
    Object.defineProperty(globalThis, 'document', {
        configurable: true,
        writable: true,
        value: {
            getElementById() {
                return null;
            },
        } as Document,
    });

    try {
        const kernel = new ClientWorldKernel();
        const client = new GameClient('ws://example/ws', kernel);

        let disconnected = 0;
        client.on('disconnected', () => {
            disconnected += 1;
        });

        client.connect(false);
        expect(MockWebSocket.instances.length).toBe(1);

        client.nextIntentSeq = 42;
        kernel.enqueueClientPendingMoveSeqAck(10);
        kernel.enqueueClientPendingMoveSeqAck(11);

        client.reconnectSilently();
        expect(MockWebSocket.instances.length).toBe(2);
        expect(disconnected).toBe(0);
        expect(client.nextIntentSeq).toBe(1);
        expect(kernel.clientPendingMoveSeqAcks.length).toBe(0);

        // A real close should still emit disconnected.
        if (client.connection instanceof MockWebSocket) {
            client.connection.close();
        }
        expect(disconnected).toBe(1);
    } finally {
        Object.defineProperty(globalThis, 'WebSocket', {
            configurable: true,
            writable: true,
            value: prevWs,
        });
        if (prevDoc === undefined) {
            try {
                // Keep teardown resilient in environments where deleting document is disallowed.
                delete (globalThis as { document?: Document }).document;
            } catch {
                Object.defineProperty(globalThis, 'document', {
                    configurable: true,
                    writable: true,
                    value: undefined,
                });
            }
        } else {
            Object.defineProperty(globalThis, 'document', {
                configurable: true,
                writable: true,
                value: prevDoc,
            });
        }
    }
});
