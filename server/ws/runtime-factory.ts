import { WS_EVENT_NAMES } from '../server-event-names';
import type { ProtocolParsedAction } from '../../shared/protocol/types';
import type {
    HttpUpgradeRequestLike,
    JsonValue,
    WebSocketRuntimeClasses,
    WebSocketRuntimeConnection,
    WebSocketRuntimeFactoryDeps,
    WsConnectionLike,
    WsErrorLike,
} from './runtime-types';
import { getHealthzResponseBody, getVersionResponseBody } from '../runtime-health-response';
import { TypedEventEmitter } from '../../shared/typed-event-emitter';
import { Evented } from '../../shared/evented';
import { AUTH_SESSION_COOKIE_KEY } from '../../shared/auth/cookie-keys';
import { ConnectionIdGenerator } from './connection-id';
import { verifySignedAuthSessionToken } from '../auth-session';
import { parseCookieValue } from '../http-utils';

type WebSocketRuntimeServerEvents = {
    connect: [connection: WebSocketRuntimeConnection];
    error: [error: WsErrorLike];
};

export function createWebSocketRuntimeClasses({
    log,
    Utils: _Utils,
    Protocol,
    CLOSE_CODES,
    WebSocket,
    createHttpServer,
    parseUrlPathname,
    logConnectionEvent,
}: WebSocketRuntimeFactoryDeps): WebSocketRuntimeClasses {
    type RuntimeConnection = Connection;

    function resolveRemoteAddress(request: HttpUpgradeRequestLike | null | undefined): string {
        const socket = request?.socket;
        if (!socket) {
            return 'unavailable';
        }
        return typeof socket.remoteAddress === 'string' ? socket.remoteAddress : 'unavailable';
    }

    function resolveAccountNameKeyFromRequest(request: HttpUpgradeRequestLike | null | undefined): string | null {
        const cookieHeader = request?.headers?.cookie;
        const sessionToken = parseCookieValue(cookieHeader, AUTH_SESSION_COOKIE_KEY);
        if (sessionToken === null) {
            return null;
        }
        return verifySignedAuthSessionToken({ token: sessionToken });
    }

    function formatCloseReason(error: WsErrorLike): string {
        if (error === null || error === undefined) {
            return '';
        }
        if (typeof error === 'string') {
            return error;
        }
        if (typeof error === 'number' || typeof error === 'boolean' || typeof error === 'bigint') {
            return String(error);
        }
        if (error instanceof Error) {
            return error.message ? `${error.name}: ${error.message}` : error.name;
        }
        try {
            const json = JSON.stringify(error);
            return typeof json === 'string' ? json : 'unknown_error';
        } catch (_) {
            return 'unknown_error';
        }
    }

    class Server extends Evented<WebSocketRuntimeServerEvents> {
        port: number;
        _connections: Record<string, RuntimeConnection>;
        _connectionIds: ConnectionIdGenerator;
        statusProvider?: () => string;
        _httpServer?: ReturnType<typeof createHttpServer>;
        _wss?: InstanceType<typeof WebSocket.WebSocketServer>;

        constructor(port: number) {
            super();
            this.port = port;
            this._connections = {};
            this._connectionIds = new ConnectionIdGenerator();
        }

        broadcast(_message: JsonValue): void {
            throw new Error('Not implemented');
        }

        forEachConnection(callback: (connection: RuntimeConnection, connectionId: string) => void): void {
            Object.keys(this._connections).forEach((connectionId) => {
                const connection = this._connections[connectionId];
                if (connection) {
                    callback(connection, connectionId);
                }
            });
        }

        addConnection(connection: RuntimeConnection): void {
            this._connections[connection.id] = connection;
        }

        removeConnection(id: string): void {
            delete this._connections[id];
        }

        getConnection(id: string): RuntimeConnection | undefined {
            return this._connections[id];
        }
    }

    class Connection {
        _connection: WsConnectionLike;
        _server: { removeConnection(id: string): void };
        id: string;
        remoteAddress: string;
        accountNameKey?: string;
        events: TypedEventEmitter<{ close: []; listen: [action: ProtocolParsedAction] }>;

        constructor(
            id: string,
            connection: WsConnectionLike,
            server: { removeConnection(id: string): void },
            remoteAddress: string
        ) {
            this._connection = connection;
            this._server = server;
            this.id = id;
            this.remoteAddress = remoteAddress;
            this.events = new TypedEventEmitter();
        }

        onClose(callback: () => void): void {
            this.events.on('close', callback);
        }

        listen(callback: (action: ProtocolParsedAction) => void): void {
            this.events.on('listen', callback);
        }

        broadcast(_message: JsonValue): void {
            throw new Error('Not implemented');
        }

        send(_message: JsonValue): void {
            throw new Error('Not implemented');
        }

        sendUTF8(_data: string): void {
            throw new Error('Not implemented');
        }

        close(logError: WsErrorLike, closeCode?: number) {
            const reason = formatCloseReason(logError);
            const sanitizedReason = reason.length > 120 ? reason.slice(0, 117) + '...' : reason;
            const code = typeof closeCode === 'number' && Number.isInteger(closeCode) ? closeCode : CLOSE_CODES.NORMAL;
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

        closeInvalidPayload(logError: WsErrorLike) {
            this.close(logError, CLOSE_CODES.INVALID_PAYLOAD);
        }

        closeUnsupportedData(logError: WsErrorLike) {
            this.close(logError, CLOSE_CODES.UNSUPPORTED_DATA);
        }
    }

    class wsWebSocketConnection extends Connection {
        constructor(
            id: string,
            connection: WsConnectionLike,
            server: { removeConnection(id: string): void },
            remoteAddress: string
        ) {
            super(id, connection, server, remoteAddress);

            this._connection.on('message', (data, isBinary) => {
                if (isBinary) {
                    this.closeUnsupportedData('Binary websocket frames are not supported.');
                    return;
                }

                if (typeof data !== 'string' && !Buffer.isBuffer(data)) {
                    this.closeUnsupportedData('Unsupported websocket frame payload type.');
                    return;
                }
                const text = typeof data === 'string' ? data : data.toString('utf8');

                const actions = Protocol.parseProtocolActionBatch(text);
                if (actions.length !== 1) {
                    this.closeInvalidPayload('Invalid message: expected a single protocol action Array.');
                    return;
                }

                const action = actions[0];
                if (!action) {
                    this.closeInvalidPayload('Invalid message: expected a single protocol action Array.');
                    return;
                }

                this.events.emit('listen', action);
            });

            this._connection.on('close', () => {
                logConnectionEvent('info', WS_EVENT_NAMES.CONNECTION_CLOSED, this);
                this.events.emit('close');
                this._server.removeConnection(this.id);
            });

            this._connection.on('error', (err) => {
                const errorText = formatCloseReason(err);
                log.error('WebSocket connection error: ' + errorText);
                logConnectionEvent('error', WS_EVENT_NAMES.CONNECTION_ERROR, this, {
                    error: errorText,
                });
            });
        }

        override send(message: JsonValue): void {
            this.sendUTF8(JSON.stringify(message));
        }

        override sendUTF8(data: string): void {
            this._connection.send(data);
        }
    }

    class MultiVersionWebsocketServer extends Server {
        constructor(port: number) {
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
                path: '/ws',
                maxPayload: 64 * 1024,
                perMessageDeflate: false,
            });

            this._wss.on('error', (err) => {
                const resolvedErr = err ?? new Error('websocket_server_error');
                const errorText = formatCloseReason(resolvedErr);
                log.error('WebSocket server error: ' + errorText);
                log.event('error', WS_EVENT_NAMES.SERVER_ERROR, { error: errorText });
                this.emit('error', resolvedErr);
            });

            this._wss.on('connection', (connection, req) => {
                const remoteAddress = resolveRemoteAddress(req);
                const wsConnection = new wsWebSocketConnection(
                    this._createId(),
                    connection,
                    this,
                    remoteAddress
                );
                const accountNameKey = resolveAccountNameKeyFromRequest(req);
                if (accountNameKey) {
                    wsConnection.accountNameKey = accountNameKey;
                }

                this.emit('connect', wsConnection);
                this.addConnection(wsConnection);
                logConnectionEvent('info', WS_EVENT_NAMES.CONNECTION_OPEN, wsConnection);
            });
        }

        _createId(): string {
            return this._connectionIds.nextId();
        }

        override broadcast(message: JsonValue): void {
            this.forEachConnection((connection) => {
                connection.send(message);
            });
        }

        onRequestStatus(statusProvider: () => string): void {
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
