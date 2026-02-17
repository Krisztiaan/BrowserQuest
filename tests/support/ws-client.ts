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

    on(event: string, handler: (...args: Array<string | Blob | ArrayBuffer | Uint8Array | Event>) => void) {
        this.#socket.addEventListener(event, (payload) => {
            if (event === 'message') {
                const messagePayload = payload as MessageEvent;
                handler(messagePayload.data);
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
                const messagePayload = payload as MessageEvent;
                handler(messagePayload.data);
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
