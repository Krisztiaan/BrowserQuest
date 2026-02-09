// @ts-nocheck
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
    #socket;
    #handlers;

    constructor(socket) {
        this.#socket = socket;
        this.#handlers = {};
    }

    on(event, handler) {
        this.#handlers[event] = handler;
    }

    emit(event, ...args) {
        if (this.#handlers[event]) {
            this.#handlers[event](...args);
        }
    }

    send(data) {
        this.#socket.send(data);
    }

    close(code, reason) {
        this.#socket.close(code, reason);
    }
}

class MultiVersionWebsocketServer {
    constructor(port) {
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
                if (server.upgrade(request, { data: { remoteAddress: this.#resolveRemoteAddress(server, request) } })) {
                    return undefined;
                }
                return new Response('Not Found', { status: 404 });
            },
            websocket: {
                open: (socket) => {
                    const adapter = new BunSocketAdapter(socket);
                    this._socketAdapters.set(socket, adapter);
                    const remoteAddress = socket?.data?.remoteAddress
                        ? String(socket.data.remoteAddress)
                        : 'unknown';
                    const connection = new wsWebSocketConnection(this.#createId(), adapter, this, remoteAddress);
                    this.addConnection(connection);
                    if (this.connection_callback) {
                        this.connection_callback(connection);
                    }
                    logConnectionEvent('info', WS_EVENT_NAMES.CONNECTION_OPEN, connection, undefined);
                },
                message: (socket, message) => {
                    const adapter = this._socketAdapters.get(socket);
                    if (!adapter) {
                        return;
                    }
                    adapter.emit('message', message, typeof message !== 'string');
                },
                close: (socket) => {
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

    #resolveRemoteAddress(server, request) {
        try {
            if (typeof server?.requestIP === 'function') {
                const ip = server.requestIP(request);
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

    onConnect(callback) {
        this.connection_callback = callback;
    }

    onError(callback) {
        this.error_callback = callback;
    }

    onRequestStatus(status_callback) {
        this.status_callback = status_callback;
    }

    forEachConnection(callback) {
        Object.keys(this._connections).forEach((connectionId) => {
            callback(this._connections[connectionId], connectionId);
        });
    }

    addConnection(connection) {
        this._connections[connection.id] = connection;
    }

    removeConnection(id) {
        delete this._connections[id];
    }

    broadcast(message) {
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
