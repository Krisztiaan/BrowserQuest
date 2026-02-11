import Log from './log';
import Utils from './utils';
import Protocol from '../shared/protocol-contract';
import CLOSE_CODES from '../shared/ws-close-codes';
import { Evented } from '../shared/evented';
import { createWebSocketRuntimeClasses } from './ws-runtime-class-factory';
import { getHealthzResponseBody, getVersionResponseBody } from './runtime-health-response';
import { WS_EVENT_NAMES } from './server-event-names';

const BunRuntime = globalThis['Bun'];
const log = Log.getLogger();

function parseRequestPathname(requestUrl: string | undefined): string {
    try {
        return new URL(requestUrl ?? '/', 'http://localhost').pathname;
    } catch (_) {
        return '/';
    }
}

function appendFields(baseFields: Record<string, unknown>, extraFields?: Record<string, unknown>) {
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

function logConnectionEvent(
    level: string,
    eventName: string,
    connection: { id: string; remoteAddress: string },
    extraFields?: Record<string, unknown>
) {
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
        listen(_port, _onListen) {
            void requestHandler;
            void _port;
            void _onListen;
        },
    }),
    parseUrlPathname: parseRequestPathname,
    logConnectionEvent,
});

const wsWebSocketConnection = runtimeClasses.wsWebSocketConnection;

type BunWebSocketServerEvents = {
    connect: [connection: InstanceType<typeof wsWebSocketConnection>];
    error: [error: unknown];
};

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

    emit(event: string, ...args: unknown[]) {
        this.#handlers[event]?.(...args);
    }

    send(data: unknown) {
        this.#socket.send(data);
    }

    close(code?: number, reason?: string) {
        this.#socket.close(code, reason);
    }
}

class MultiVersionWebsocketServer extends Evented<BunWebSocketServerEvents> {
    port: number;
    _connections: Record<string, { id: string; send(message: unknown): void }>;
    _counter: number;
    _socketAdapters: WeakMap<object, BunSocketAdapter>;
    _server: unknown;
    private statusProvider?: () => string;

    constructor(port: number) {
        super();
        this.port = port;
        this._connections = {};
        this._counter = 0;
        this._socketAdapters = new WeakMap();

        this._server = BunRuntime.serve({
            port,
            fetch: (request, server) => {
                const requestPath = parseRequestPathname(request.url);
                if (requestPath === '/healthz') {
                    return new Response(getHealthzResponseBody(), { status: 200 });
                }
                if (requestPath === '/version') {
                    return new Response(getVersionResponseBody(), { status: 200 });
                }
                if (requestPath === '/status' && this.statusProvider) {
                    return new Response(this.statusProvider(), { status: 200 });
                }
                if (
                    (server as { upgrade: (request: Request, options?: unknown) => boolean }).upgrade(request, {
                        data: { remoteAddress: this.#resolveRemoteAddress(server, request) },
                    })
                ) {
                    return undefined;
                }
                return new Response('Not Found', { status: 404 });
            },
            websocket: {
                open: (socket: {
                    data?: { remoteAddress?: unknown };
                    send(data: unknown): void;
                    close(code?: number, reason?: string): void;
                }) => {
                    const adapter = new BunSocketAdapter(socket);
                    this._socketAdapters.set(socket as unknown as object, adapter);
                    const remote = socket.data?.remoteAddress;
                    const remoteAddress =
                        typeof remote === 'string' ||
                        typeof remote === 'number' ||
                        typeof remote === 'boolean' ||
                        typeof remote === 'bigint'
                            ? String(remote)
                            : 'unknown';
                    const connection = new wsWebSocketConnection(this.#createId(), adapter, this, remoteAddress);
                    this.addConnection(connection);
                    this.emit('connect', connection);
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
                if (typeof ip.address === 'string') {
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

    onRequestStatus(statusProvider: () => string) {
        this.statusProvider = statusProvider;
    }

    forEachConnection(
        callback: (connection: { id: string; send(message: unknown): void }, connectionId: string) => void
    ) {
        Object.keys(this._connections).forEach((connectionId) => {
            const connection = this._connections[connectionId];
            if (connection) {
                callback(connection, connectionId);
            }
        });
    }

    addConnection(connection: { id: string; send(message: unknown): void }) {
        this._connections[connection.id] = connection;
    }

    removeConnection(id: string) {
        delete this._connections[id];
    }

    getConnection(id: string) {
        return this._connections[id];
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
