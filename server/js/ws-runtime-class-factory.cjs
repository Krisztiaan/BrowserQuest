// AUTO-GENERATED from server/js/ws-runtime-class-factory.cts via `bun run build:ws-runtime-factory`.
// Do not edit server/js/ws-runtime-class-factory.cjs directly.

"use strict";
/**
 * @param {import('./ws-runtime-class-factory-types').WebSocketRuntimeFactoryDeps} deps
 * @returns {import('./ws-runtime-class-factory-types').WebSocketRuntimeClasses}
 */
function createWebSocketRuntimeClasses({ log, Utils, Protocol, CLOSE_CODES, WebSocket, createHttpServer, parseUrlPathname, logConnectionEvent, useBison = false, }) {
    /**
     * @param {unknown} request
     * @returns {string}
     */
    function resolveRemoteAddress(request) {
        if (!request || typeof request !== 'object' || !('socket' in request)) {
            return 'unknown';
        }
        const socket = request.socket;
        if (!socket || typeof socket !== 'object' || !('remoteAddress' in socket)) {
            return 'unknown';
        }
        return typeof socket.remoteAddress === 'string' ? socket.remoteAddress : 'unknown';
    }
    class Server {
        port;
        _connections;
        _counter;
        connection_callback;
        error_callback;
        status_callback;
        _httpServer;
        _wss;
        constructor(port) {
            this.port = port;
            this._connections = {};
            this._counter = 0;
        }
        onConnect(callback) {
            this.connection_callback = callback;
        }
        onError(callback) {
            this.error_callback = callback;
        }
        broadcast(message) {
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
        remoteAddress;
        close_callback;
        listen_callback;
        constructor(id, connection, server, remoteAddress) {
            this._connection = connection;
            this._server = server;
            this.id = id;
            this.remoteAddress = remoteAddress;
        }
        onClose(callback) {
            this.close_callback = callback;
        }
        listen(callback) {
            this.listen_callback = callback;
        }
        broadcast(message) {
            throw new Error('Not implemented');
        }
        send(message) {
            throw new Error('Not implemented');
        }
        sendUTF8(data) {
            throw new Error('Not implemented');
        }
        close(logError, closeCode) {
            const reason = String(logError || '');
            const sanitizedReason = reason.length > 120 ? reason.slice(0, 117) + '...' : reason;
            const code = Number.isInteger(closeCode) ? closeCode : CLOSE_CODES.NORMAL;
            log.info('Closing connection to ' + this.remoteAddress + '. Error: ' + reason);
            logConnectionEvent('info', 'ws.connection.close_request', this, {
                code,
                reason,
            });
            try {
                this._connection.close(code, sanitizedReason);
            }
            catch (_) {
                // ignore
            }
        }
        closeInvalidPayload(logError) {
            this.close(logError, CLOSE_CODES.INVALID_PAYLOAD);
        }
        closeUnsupportedData(logError) {
            this.close(logError, CLOSE_CODES.UNSUPPORTED_DATA);
        }
    }
    class wsWebSocketConnection extends Connection {
        constructor(id, connection, server, remoteAddress) {
            super(id, connection, server, remoteAddress);
            this._connection.on('message', (data, isBinary) => {
                if (!this.listen_callback) {
                    return;
                }
                if (isBinary) {
                    this.closeUnsupportedData('Binary websocket frames are not supported.');
                    return;
                }
                const text = typeof data === 'string'
                    ? data
                    : Buffer.isBuffer(data)
                        ? data.toString('utf8')
                        : String(data);
                if (useBison) {
                    this.closeUnsupportedData('BISON is not supported in modern mode.');
                    return;
                }
                const actions = Protocol.parseProtocolActionBatch(text);
                if (actions.length !== 1) {
                    this.closeInvalidPayload('Invalid message: expected a single protocol action Array.');
                    return;
                }
                this.listen_callback(actions[0]);
            });
            this._connection.on('close', () => {
                logConnectionEvent('info', 'ws.connection.closed', this);
                if (this.close_callback) {
                    this.close_callback();
                }
                this._server.removeConnection(this.id);
            });
            this._connection.on('error', (err) => {
                log.error('WebSocket connection error: ' + err);
                logConnectionEvent('error', 'ws.connection.error', this, {
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
                if (requestPath === '/status' && this.status_callback) {
                    response.writeHead(200);
                    response.write(this.status_callback());
                    response.end();
                    return;
                }
                response.writeHead(404);
                response.end();
            });
            this._httpServer.listen(port, () => {
                log.info('Server is listening on port ' + port);
                log.event('info', 'ws.server.listen', { port });
            });
            this._wss = new WebSocket.WebSocketServer({
                server: this._httpServer,
                maxPayload: 64 * 1024,
                perMessageDeflate: false,
            });
            this._wss.on('error', (err) => {
                log.error('WebSocket server error: ' + err);
                log.event('error', 'ws.server.error', { error: String(err) });
            });
            this._wss.on('connection', (connection, req) => {
                const remoteAddress = resolveRemoteAddress(req);
                const wsConnection = new wsWebSocketConnection(this._createId(), connection, this, remoteAddress);
                if (this.connection_callback) {
                    this.connection_callback(wsConnection);
                }
                this.addConnection(wsConnection);
                logConnectionEvent('info', 'ws.connection.open', wsConnection);
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
        onRequestStatus(status_callback) {
            this.status_callback = status_callback;
        }
    }
    return {
        MultiVersionWebsocketServer,
        wsWebSocketConnection,
    };
}
module.exports = {
    createWebSocketRuntimeClasses,
};
