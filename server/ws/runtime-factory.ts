import { WS_EVENT_NAMES } from '../server-event-names';
import type { ProtocolParsedAction } from '../../shared/protocol/types';
import type {
    WebSocketRuntimeClasses,
    WebSocketRuntimeConnection,
    WebSocketRuntimeFactoryDeps,
} from './runtime-types';
import { getHealthzResponseBody, getVersionResponseBody } from '../runtime-health-response';
import { TypedEventEmitter } from '../../shared/typed-event-emitter';
import { Evented } from '../../shared/evented';
import { AUTH_SESSION_COOKIE_KEY } from '../../shared/auth/cookie-keys';
import { ConnectionIdGenerator } from './connection-id';
import { verifySignedAuthSessionToken } from '../auth-session';

type WebSocketRuntimeServerEvents = {
    connect: [connection: WebSocketRuntimeConnection];
    error: [error: unknown];
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

    type WsConnectionLike = {
        on(event: 'message', handler: (data: unknown, isBinary: boolean) => void): void;
        on(event: 'close', handler: () => void): void;
        on(event: 'error', handler: (error: unknown) => void): void;
        send(data: string): void;
        close(code?: number, reason?: string): void;
    };

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

    function resolveAccountNameKeyFromRequest(request: unknown): string | null {
        if (!request || typeof request !== 'object' || !('headers' in request)) {
            return null;
        }
        const headers = request.headers;
        if (!headers || typeof headers !== 'object') {
            return null;
        }
        const cookieHeader = 'cookie' in headers ? headers.cookie : undefined;
        if (typeof cookieHeader !== 'string' || cookieHeader.length === 0) {
            return null;
        }

        const entries = cookieHeader.split(';');
        for (const entry of entries) {
            const separatorIndex = entry.indexOf('=');
            if (separatorIndex <= 0) {
                continue;
            }
            const key = entry.slice(0, separatorIndex).trim();
            if (key !== AUTH_SESSION_COOKIE_KEY) {
                continue;
            }
            const rawValue = entry.slice(separatorIndex + 1).trim();
            if (!rawValue) {
                return null;
            }
            try {
                const decoded = decodeURIComponent(rawValue).trim();
                return verifySignedAuthSessionToken({ token: decoded });
            } catch (_) {
                return null;
            }
        }
        return null;
    }

    function formatCloseReason(error: unknown): string {
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

        broadcast(_message: unknown): void {
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
        events: TypedEventEmitter<{ close: []; listen: [action: ProtocolParsedAction] }>;

        constructor(
            id: string,
            connection: unknown,
            server: { removeConnection(id: string): void },
            remoteAddress: string
        ) {
            this._connection = connection as WsConnectionLike;
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

        broadcast(_message: unknown): void {
            throw new Error('Not implemented');
        }

        send(_message: unknown): void {
            throw new Error('Not implemented');
        }

        sendUTF8(_data: string): void {
            throw new Error('Not implemented');
        }

        close(logError: unknown, closeCode?: number) {
            const reason = formatCloseReason(logError);
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
        constructor(
            id: string,
            connection: unknown,
            server: { removeConnection(id: string): void },
            remoteAddress: string
        ) {
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
                log.error('WebSocket connection error: ' + err);
                logConnectionEvent('error', WS_EVENT_NAMES.CONNECTION_ERROR, this, {
                    error: String(err),
                });
            });
        }

        override send(message: unknown): void {
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

            this._wss.on('error', (err: unknown) => {
                log.error('WebSocket server error: ' + err);
                log.event('error', WS_EVENT_NAMES.SERVER_ERROR, { error: String(err) });
                this.emit('error', err);
            });

            this._wss.on('connection', (connection: unknown, req: unknown) => {
                const remoteAddress = resolveRemoteAddress(req);
                const wsConnection = new wsWebSocketConnection(
                    this._createId(),
                    connection as WsConnectionLike,
                    this,
                    remoteAddress
                );
                const accountNameKey = resolveAccountNameKeyFromRequest(req);
                if (accountNameKey) {
                    (wsConnection as wsWebSocketConnection & { accountNameKey?: string }).accountNameKey =
                        accountNameKey;
                }

                this.emit('connect', wsConnection);
                this.addConnection(wsConnection);
                logConnectionEvent('info', WS_EVENT_NAMES.CONNECTION_OPEN, wsConnection);
            });
        }

        _createId(): string {
            return this._connectionIds.nextId();
        }

        override broadcast(message: unknown): void {
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
