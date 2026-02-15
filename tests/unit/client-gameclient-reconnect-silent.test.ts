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
    onopen: ((e: unknown) => void) | null = null;
    onmessage: ((e: { data: unknown }) => void) | null = null;
    onerror: ((e: unknown) => void) | null = null;
    onclose: (() => void) | null = null;

    constructor(url: string) {
        this.url = url;
        MockWebSocket.instances.push(this);
    }

    send(_data: string): void {}

    close(): void {
        this.readyState = MockWebSocket.CLOSED;
        this.onclose?.();
    }
}

test('GameClient.reconnectSilently does not emit disconnected for the intentional close', () => {
    const prevWs = globalThis.WebSocket;
    const prevDoc = (globalThis as unknown as { document?: unknown }).document;

    (globalThis as unknown as { WebSocket: unknown }).WebSocket = MockWebSocket as unknown;
    (globalThis as unknown as { document: unknown }).document = {
        getElementById() {
            return null;
        },
    };

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
        (client.connection as unknown as MockWebSocket).close();
        expect(disconnected).toBe(1);
    } finally {
        (globalThis as unknown as { WebSocket: unknown }).WebSocket = prevWs as unknown;
        if (prevDoc === undefined) {
            delete (globalThis as unknown as { document?: unknown }).document;
        } else {
            (globalThis as unknown as { document: unknown }).document = prevDoc;
        }
    }
});
