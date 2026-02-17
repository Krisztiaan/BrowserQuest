class WsClient {
    static CONNECTING = WebSocket.CONNECTING;
    static OPEN = WebSocket.OPEN;
    static CLOSING = WebSocket.CLOSING;
    static CLOSED = WebSocket.CLOSED;

    #socket: WebSocket;

    constructor(url: string) {
        this.#socket = new WebSocket(url);
    }

    get readyState() {
        return this.#socket.readyState;
    }

    send(data: string) {
        this.#socket.send(data);
    }

    close() {
        this.#socket.close();
    }

    static #isSupportedMessageData(value: unknown): value is string | Blob | ArrayBuffer | Uint8Array {
        return (
            typeof value === 'string'
            || value instanceof Blob
            || value instanceof ArrayBuffer
            || value instanceof Uint8Array
        );
    }

    on(event: string, handler: (...args: Array<string | Blob | ArrayBuffer | Uint8Array | Event>) => void) {
        this.#socket.addEventListener(event, (payload: Event) => {
            if (event === 'message') {
                if (payload instanceof MessageEvent && WsClient.#isSupportedMessageData(payload.data)) {
                    handler(payload.data);
                } else {
                    handler(payload);
                }
                return;
            }
            if (event === 'error') {
                handler(payload);
                return;
            }
            handler(payload);
        });
        return this;
    }

    once(event: string, handler: (...args: Array<string | Blob | ArrayBuffer | Uint8Array | Event>) => void) {
        const wrapped = (payload: Event) => {
            this.#socket.removeEventListener(event, wrapped);
            if (event === 'message') {
                if (payload instanceof MessageEvent && WsClient.#isSupportedMessageData(payload.data)) {
                    handler(payload.data);
                } else {
                    handler(payload);
                }
                return;
            }
            if (event === 'error') {
                handler(payload);
                return;
            }
            handler(payload);
        };
        this.#socket.addEventListener(event, wrapped);
        return this;
    }
}

export default WsClient;
