import Log from './log-esm';
import Utils from './utils-esm';
import Protocol from '../../shared/js/protocol-contract-esm';
import CLOSE_CODES from '../../shared/js/ws-close-codes-esm';
import { createWebSocketRuntimeClasses } from './ws-runtime-class-factory';
import { WS_EVENT_NAMES } from './server-event-names';

const BunRuntime = globalThis['Bun'];
const log = Log.getLogger();
const useBison = false;

function parseRequestPathname(requestUrl) {
    try {
        return new URL(requestUrl, 'http://localhost').pathname;
    } catch (_) {
        return '/';
    }
}

function appendFields(baseFields, extraFields) {
    if (!extraFields) {
        return baseFields;
    }
    for (const key in extraFields) {
        if (Object.prototype.hasOwnProperty.call(extraFields, key)) {
            baseFields[key] = extraFields[key];
        }
    }
    return baseFields;
}

function logConnectionEvent(level, eventName, connection, extraFields) {
    log.event(
        level,
        eventName,
        appendFields(
            {
                connectionId: connection.id,
                remoteAddress: connection.remoteAddress,
            },
            extraFields
        )
    );
}

const runtimeClasses = createWebSocketRuntimeClasses({
    log,
    Utils,
    Protocol,
    CLOSE_CODES,
    WebSocket: {
        WebSocketServer: class UnsupportedWebSocketServer {
            on() {}
        },
    },
    createHttpServer: (requestHandler) => ({
        listen() {
            void requestHandler;
        },
    }),
    parseUrlPathname: parseRequestPathname,
    logConnectionEvent,
    useBison,
});

const wsWebSocketConnection = runtimeClasses.wsWebSocketConnection;

class BunSocketAdapter {
    #socket: { send(data: unknown): void; close(code?: number, reason?: string): void };
    #handlers: Record<string, (...args: unknown[]) => void>;

    constructor(socket: { send(data: unknown): void; close(code?: number, reason?: string): void }) {
        this.#socket = socket;
        this.#handlers = {};
    }

    on(event: string, handler: (...args: unknown[]) => void) {
        this.#handlers[event] = handler;
    }

    emit(event, ...args) {
        if (this.#handlers[event]) {
            this.#handlers[event](...args);
        }
    }

    send(data: unknown) {
        this.#socket.send(data);
    }

    close(code?: number, reason?: string) {
        this.#socket.close(code, reason);
    }
}

class MultiVersionWebsocketServer {
    port: number;
    _connections: Record<string, { id: string; send(message: unknown): void }>;
    _counter: number;
    _socketAdapters: WeakMap<object, BunSocketAdapter>;
    _server: unknown;
    connection_callback?: (connection: InstanceType<typeof wsWebSocketConnection>) => void;
    error_callback?: (error: unknown) => void;
    status_callback?: () => string;

    constructor(port: number) {
        this.port = port;
        this._connections = {};
        this._counter = 0;
        this._socketAdapters = new WeakMap();

        this._server = BunRuntime.serve({
            port,
            fetch: (request, server) => {
                const requestPath = parseRequestPathname(request.url);
                if (requestPath === '/status' && this.status_callback) {
                    return new Response(this.status_callback(), { status: 200 });
                }
                if ((server as { upgrade: (request: Request, options?: unknown) => boolean }).upgrade(request, {
                    data: { remoteAddress: this.#resolveRemoteAddress(server, request) },
                })) {
                    return undefined;
                }
                return new Response('Not Found', { status: 404 });
            },
            websocket: {
                open: (socket: { data?: { remoteAddress?: unknown }; send(data: unknown): void; close(code?: number, reason?: string): void }) => {
                    const adapter = new BunSocketAdapter(socket);
                    this._socketAdapters.set(socket as unknown as object, adapter);
                    const remoteAddress = socket.data?.remoteAddress
                        ? String(socket.data.remoteAddress)
                        : 'unknown';
                    const connection = new wsWebSocketConnection(this.#createId(), adapter, this, remoteAddress);
                    this.addConnection(connection);
                    if (this.connection_callback) {
                        this.connection_callback(connection);
                    }
                    logConnectionEvent('info', WS_EVENT_NAMES.CONNECTION_OPEN, connection, undefined);
                },
                message: (socket: object, message: unknown) => {
                    const adapter = this._socketAdapters.get(socket);
                    if (!adapter) {
                        return;
                    }
                    adapter.emit('message', message, typeof message !== 'string');
                },
                close: (socket: object) => {
                    const adapter = this._socketAdapters.get(socket);
                    if (!adapter) {
                        return;
                    }
                    adapter.emit('close');
                    this._socketAdapters.delete(socket);
                },
            },
        });

        log.info('Server is listening on port ' + port);
        log.event('info', WS_EVENT_NAMES.SERVER_LISTEN, { port });
    }

    #resolveRemoteAddress(server: unknown, request: Request): string {
        try {
            if (
                typeof (server as { requestIP?: (request: Request) => { address?: unknown } }).requestIP === 'function'
            ) {
                const ip = (server as { requestIP: (request: Request) => { address?: unknown } }).requestIP(request);
                if (typeof ip?.address === 'string') {
                    return ip.address;
                }
            }
        } catch (_) {
            // ignore
        }
        return 'unknown';
    }

    #createId() {
        return '5' + Utils.random(99) + '' + this._counter++;
    }

    onConnect(callback: (connection: InstanceType<typeof wsWebSocketConnection>) => void) {
        this.connection_callback = callback;
    }

    onError(callback: (error: unknown) => void) {
        this.error_callback = callback;
    }

    onRequestStatus(status_callback: () => string) {
        this.status_callback = status_callback;
    }

    forEachConnection(callback: (connection: { id: string; send(message: unknown): void }, connectionId: string) => void) {
        Object.keys(this._connections).forEach((connectionId) => {
            callback(this._connections[connectionId], connectionId);
        });
    }

    addConnection(connection: { id: string; send(message: unknown): void }) {
        this._connections[connection.id] = connection;
    }

    removeConnection(id: string) {
        delete this._connections[id];
    }

    broadcast(message: unknown) {
        this.forEachConnection((connection) => {
            connection.send(message);
        });
    }
}

const WS = {
    CLOSE_CODES,
    MultiVersionWebsocketServer,
    wsWebSocketConnection,
    createWebSocketRuntimeClasses,
};

export { CLOSE_CODES, MultiVersionWebsocketServer, wsWebSocketConnection, createWebSocketRuntimeClasses };
export default WS;
