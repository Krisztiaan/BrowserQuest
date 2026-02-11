import { WS_EVENT_NAMES } from './server-event-names';
import type {
    WebSocketRuntimeClasses,
    WebSocketRuntimeConnection,
    WebSocketRuntimeFactoryDeps,
} from './ws-runtime-class-factory-types';
import { getHealthzResponseBody, getVersionResponseBody } from './runtime-health-response';
import { TypedEventEmitter } from '../../shared/js/typed-event-emitter';
import { Evented } from '../../shared/js/evented';

type WebSocketRuntimeServerEvents = {
    connect: [connection: WebSocketRuntimeConnection];
    error: [error: unknown];
};

export function createWebSocketRuntimeClasses({
    log,
    Utils,
    Protocol,
    CLOSE_CODES,
    WebSocket,
    createHttpServer,
    parseUrlPathname,
    logConnectionEvent,
}: WebSocketRuntimeFactoryDeps): WebSocketRuntimeClasses {
    function resolveRemoteAddress(request: unknown): string {
        if (!request || typeof request !== 'object' || !('socket' in request)) {
            return 'unknown';
        }
        const socket = request.socket;
        if (!socket || typeof socket !== 'object' || !('remoteAddress' in socket)) {
            return 'unknown';
        }
        return typeof socket.remoteAddress === 'string' ? socket.remoteAddress : 'unknown';
    }

    class Server extends Evented<WebSocketRuntimeServerEvents> {
        port;
        _connections;
        _counter;
        statusProvider;
        _httpServer;
        _wss;

        constructor(port) {
            super();
            this.port = port;
            this._connections = {};
            this._counter = 0;
        }

        broadcast(_message) {
            throw new Error('Not implemented');
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

        getConnection(id) {
            return this._connections[id];
        }
    }

    class Connection {
        _connection;
        _server;
        id;
        remoteAddress: string;
        events;

        constructor(id, connection, server, remoteAddress) {
            this._connection = connection;
            this._server = server;
            this.id = id;
            this.remoteAddress = remoteAddress;
            this.events = new TypedEventEmitter();
        }

        onClose(callback) {
            this.events.on('close', callback);
        }

        listen(callback) {
            this.events.on('listen', callback);
        }

        broadcast(_message) {
            throw new Error('Not implemented');
        }

        send(_message) {
            throw new Error('Not implemented');
        }

        sendUTF8(_data) {
            throw new Error('Not implemented');
        }

        close(logError: unknown, closeCode?: number) {
            const reason = String(logError || '');
            const sanitizedReason = reason.length > 120 ? reason.slice(0, 117) + '...' : reason;
            const code = Number.isInteger(closeCode) ? closeCode : CLOSE_CODES.NORMAL;
            log.info('Closing connection to ' + this.remoteAddress + '. Error: ' + reason);
            logConnectionEvent('info', WS_EVENT_NAMES.CONNECTION_CLOSE_REQUEST, this, {
                code,
                reason,
            });

            try {
                this._connection.close(code, sanitizedReason);
            } catch (_) {
                // ignore
            }
        }

        closeInvalidPayload(logError: unknown) {
            this.close(logError, CLOSE_CODES.INVALID_PAYLOAD);
        }

        closeUnsupportedData(logError: unknown) {
            this.close(logError, CLOSE_CODES.UNSUPPORTED_DATA);
        }
    }

    class wsWebSocketConnection extends Connection {
        constructor(id, connection, server, remoteAddress) {
            super(id, connection, server, remoteAddress);

            this._connection.on('message', (data, isBinary) => {
                if (isBinary) {
                    this.closeUnsupportedData('Binary websocket frames are not supported.');
                    return;
                }

                const text =
                    typeof data === 'string' ? data : Buffer.isBuffer(data) ? data.toString('utf8') : String(data);

                const actions = Protocol.parseProtocolActionBatch(text);
                if (actions.length !== 1) {
                    this.closeInvalidPayload('Invalid message: expected a single protocol action Array.');
                    return;
                }

                this.events.emit('listen', actions[0]);
            });

            this._connection.on('close', () => {
                logConnectionEvent('info', WS_EVENT_NAMES.CONNECTION_CLOSED, this);
                this.events.emit('close');
                this._server.removeConnection(this.id);
            });

            this._connection.on('error', (err) => {
                log.error('WebSocket connection error: ' + err);
                logConnectionEvent('error', WS_EVENT_NAMES.CONNECTION_ERROR, this, {
                    error: String(err),
                });
            });
        }

        send(message) {
            this.sendUTF8(JSON.stringify(message));
        }

        sendUTF8(data) {
            this._connection.send(data);
        }
    }

    class MultiVersionWebsocketServer extends Server {
        constructor(port) {
            super(port);

            this._httpServer = createHttpServer((request, response) => {
                const requestPath = parseUrlPathname(request.url);

                if (requestPath === '/healthz') {
                    response.writeHead(200);
                    response.write(getHealthzResponseBody());
                    response.end();
                    return;
                }

                if (requestPath === '/version') {
                    response.writeHead(200);
                    response.write(getVersionResponseBody());
                    response.end();
                    return;
                }

                if (requestPath === '/status' && this.statusProvider) {
                    response.writeHead(200);
                    response.write(this.statusProvider());
                    response.end();
                    return;
                }

                response.writeHead(404);
                response.end();
            });

            this._httpServer.listen(port, () => {
                log.info('Server is listening on port ' + port);
                log.event('info', WS_EVENT_NAMES.SERVER_LISTEN, { port });
            });

            this._wss = new WebSocket.WebSocketServer({
                server: this._httpServer,
                maxPayload: 64 * 1024,
                perMessageDeflate: false,
            });

            this._wss.on('error', (err) => {
                log.error('WebSocket server error: ' + err);
                log.event('error', WS_EVENT_NAMES.SERVER_ERROR, { error: String(err) });
                this.emit('error', err);
            });

            this._wss.on('connection', (connection, req) => {
                const remoteAddress = resolveRemoteAddress(req);
                const wsConnection = new wsWebSocketConnection(this._createId(), connection, this, remoteAddress);

                this.emit('connect', wsConnection);
                this.addConnection(wsConnection);
                logConnectionEvent('info', WS_EVENT_NAMES.CONNECTION_OPEN, wsConnection);
            });
        }

        _createId() {
            return '5' + Utils.random(99) + '' + this._counter++;
        }

        broadcast(message) {
            this.forEachConnection((connection) => {
                connection.send(message);
            });
        }

        onRequestStatus(statusProvider) {
            this.statusProvider = statusProvider;
        }
    }

    return {
        MultiVersionWebsocketServer,
        wsWebSocketConnection,
    };
}

export default {
    createWebSocketRuntimeClasses,
};
