import Log from '../log';
import Utils from '../utils';
import Protocol from '../../shared/protocol/contract';
import CLOSE_CODES from '../../shared/ws-close-codes';
import { Evented } from '../../shared/evented';
import path from 'node:path';
import { createWebSocketRuntimeClasses } from './runtime-factory';
import { getHealthzResponseBody, getVersionResponseBody } from '../runtime-health-response';
import { WS_EVENT_NAMES } from '../server-event-names';
import { AUTH_SESSION_COOKIE_KEY } from '../../shared/auth/cookie-keys';
import { ConnectionIdGenerator } from './connection-id';
import { verifySignedAuthSessionToken } from '../auth-session';

const BunRuntime = globalThis['Bun'];
const log = Log.getLogger();

function parseRequestPathname(requestUrl: string | undefined): string {
    try {
        return new URL(requestUrl ?? '/', 'http://localhost').pathname;
    } catch (_) {
        return '/';
    }
}

function parseCookieValue(cookieHeader: string | null | undefined, key: string): string | null {
    if (typeof cookieHeader !== 'string' || cookieHeader.length === 0) {
        return null;
    }
    const entries = cookieHeader.split(';');
    for (const rawEntry of entries) {
        const separatorIndex = rawEntry.indexOf('=');
        if (separatorIndex <= 0) {
            continue;
        }
        const entryKey = rawEntry.slice(0, separatorIndex).trim();
        if (entryKey !== key) {
            continue;
        }
        const rawValue = rawEntry.slice(separatorIndex + 1).trim();
        if (!rawValue) {
            return null;
        }
        try {
            const decoded = decodeURIComponent(rawValue).trim();
            return decoded.length > 0 ? decoded : null;
        } catch (_) {
            return null;
        }
    }
    return null;
}

function resolveStaticRoot(raw: string | undefined): string | null {
    if (typeof raw !== 'string') {
        return null;
    }
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
        return null;
    }
    return path.resolve(trimmed);
}

function resolveStaticFilePath(staticRoot: string, requestPath: string): string | null {
    const normalizedRequestPath = requestPath === '/' ? '/index.html' : requestPath;
    let decodedPath = normalizedRequestPath;
    try {
        decodedPath = decodeURIComponent(normalizedRequestPath);
    } catch (_) {
        return null;
    }
    if (!decodedPath.startsWith('/')) {
        return null;
    }

    const relativePath = decodedPath.slice(1);
    const candidatePath = path.resolve(staticRoot, relativePath);
    if (candidatePath !== staticRoot && !candidatePath.startsWith(staticRoot + path.sep)) {
        return null;
    }
    return candidatePath;
}

async function createStaticFileResponse(staticRoot: string | null, requestPath: string): Promise<Response | null> {
    if (!staticRoot) {
        return null;
    }

    const candidatePath = resolveStaticFilePath(staticRoot, requestPath);
    if (!candidatePath) {
        return null;
    }

    const file = Bun.file(candidatePath);
    if (await file.exists()) {
        return new Response(file);
    }

    if (path.extname(candidatePath).length > 0) {
        return null;
    }

    const indexCandidate = Bun.file(path.join(candidatePath, 'index.html'));
    if (await indexCandidate.exists()) {
        return new Response(indexCandidate);
    }
    return null;
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
    _connectionIds: ConnectionIdGenerator;
    _socketAdapters: WeakMap<object, BunSocketAdapter>;
    _server: unknown;
    private staticRoot: string | null;
    private statusProvider?: () => string;
    private profilePreviewProvider?: (request: Request) => Response;
    private passkeyAuthProvider?: (request: Request) => Response | Promise<Response>;

    constructor(port: number) {
        super();
        this.port = port;
        this._connections = {};
        this._connectionIds = new ConnectionIdGenerator();
        this._socketAdapters = new WeakMap();
        this.staticRoot = resolveStaticRoot(process.env.BQ_STATIC_ROOT);

        this._server = BunRuntime.serve({
            port,
            fetch: async (request, server) => {
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
                    (requestPath === '/profile/preview.svg' || requestPath === '/profile/preview.json')
                    && this.profilePreviewProvider
                ) {
                    return this.profilePreviewProvider(request);
                }
                if (
                    (requestPath === '/auth/passkey/register'
                        || requestPath === '/auth/passkey/login'
                        || requestPath === '/auth/passkey/logout')
                    && this.passkeyAuthProvider
                ) {
                    return this.passkeyAuthProvider(request);
                }
                if (requestPath === '/ws') {
                    const sessionToken = parseCookieValue(request.headers.get('cookie'), AUTH_SESSION_COOKIE_KEY);
                    const accountNameKey = verifySignedAuthSessionToken({ token: sessionToken });
                    if (
                        (server as { upgrade: (request: Request, options?: unknown) => boolean }).upgrade(request, {
                            data: {
                                remoteAddress: this.#resolveRemoteAddress(server, request),
                                accountNameKey,
                            },
                        })
                    ) {
                        return undefined;
                    }
                }

                const staticResponse = await createStaticFileResponse(this.staticRoot, requestPath);
                if (staticResponse) {
                    return staticResponse;
                }
                return new Response('Not Found', { status: 404 });
            },
            websocket: {
                maxPayloadLength: 64 * 1024,
                open: (socket: {
                    data?: { remoteAddress?: unknown; accountNameKey?: unknown };
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
                    const accountNameKey = socket.data?.accountNameKey;
                    if (typeof accountNameKey === 'string' && accountNameKey.trim().length > 0) {
                        (connection as InstanceType<typeof wsWebSocketConnection> & { accountNameKey?: string }).accountNameKey =
                            accountNameKey.trim().toLowerCase();
                    }
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
        return this._connectionIds.nextId();
    }

    onRequestStatus(statusProvider: () => string) {
        this.statusProvider = statusProvider;
    }

    onRequestProfilePreview(profilePreviewProvider: (request: Request) => Response) {
        this.profilePreviewProvider = profilePreviewProvider;
    }

    onRequestPasskeyAuth(passkeyAuthProvider: (request: Request) => Response | Promise<Response>) {
        this.passkeyAuthProvider = passkeyAuthProvider;
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
