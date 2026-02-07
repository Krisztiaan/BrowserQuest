import url from 'node:url';
import http from 'node:http';
import Log from './log-esm.mjs';
import Utils from './utils-esm.mjs';
import Protocol from '../../shared/js/protocol-contract-esm.mjs';
import CLOSE_CODES from '../../shared/js/ws-close-codes-esm.mjs';
import * as WebSocket from 'ws';

const log = Log.getLogger();
const useBison = false;

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

class Server {
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
        } catch (_) {
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

export class MultiVersionWebsocketServer extends Server {
    constructor(port) {
        super(port);

        this._httpServer = http.createServer((request, response) => {
            const requestPath = url.parse(request.url).pathname;
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
            const remoteAddress = req && req.socket ? req.socket.remoteAddress : 'unknown';
            const c = new wsWebSocketConnection(this._createId(), connection, this, remoteAddress);

            if (this.connection_callback) {
                this.connection_callback(c);
            }
            this.addConnection(c);
            logConnectionEvent('info', 'ws.connection.open', c);
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

export class wsWebSocketConnection extends Connection {
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

            const text = typeof data === 'string' ? data : data.toString('utf8');
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

const WS = {
    CLOSE_CODES,
    MultiVersionWebsocketServer,
    wsWebSocketConnection,
};

export { CLOSE_CODES };
export default WS;
