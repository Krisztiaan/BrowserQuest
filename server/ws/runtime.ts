import Log from '../log';
import Utils from '../utils';
import CLOSE_CODES from '../../shared/ws-close-codes';
import { Evented } from '../../shared/evented';
import path from 'node:path';
import { createWebSocketRuntimeClasses } from './runtime-factory';
import type { JsonValue, RuntimeEventFields, WsFrameData } from './runtime-types';
import { getHealthzResponseBody, getVersionResponseBody } from '../runtime-health-response';
import { WS_EVENT_NAMES } from '../server-event-names';
import { AUTH_SESSION_COOKIE_KEY } from '../../shared/auth/cookie-keys';
import { ConnectionIdGenerator } from './connection-id';
import { verifySignedAuthSessionToken } from '../auth-session';
import { parseCookieValue, parseRequestPathname } from '../http-utils';
import { normalizeIdentityKeyOrNull } from '../identity';

const BunRuntime = globalThis['Bun'];
const log = Log.getLogger();

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

function appendFields(baseFields: RuntimeEventFields, extraFields?: RuntimeEventFields) {
    if (!extraFields) {
        return baseFields;
    }
    for (const key in extraFields) {
        if (Object.prototype.hasOwnProperty.call(extraFields, key)) {
            const value = extraFields[key];
            if (value !== undefined) {
                baseFields[key] = value;
            }
        }
    }
    return baseFields;
}

function logConnectionEvent(
    level: string,
    eventName: string,
    connection: { id: string; remoteAddress: string },
    extraFields?: RuntimeEventFields
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
    error: [error: Error | string];
};

type BunSocketData = {
    remoteAddress?: string | number | boolean | bigint;
    accountNameKey?: string | null;
};

type BunSocketLike = {
    data?: BunSocketData;
    send(data: string | Uint8Array | ArrayBuffer): void;
    close(code?: number, reason?: string): void;
};

type BunConnectionRef = { id: string; send(message: JsonValue): void };

class BunSocketAdapter {
    #socket: BunSocketLike;
    #handlers: Record<
        string,
        (...args: Array<WsFrameData | boolean | string | Error | number | bigint | object | null | undefined>) => void
    >;

    constructor(socket: BunSocketLike) {
        this.#socket = socket;
        this.#handlers = {};
    }

    on(
        event: string,
        handler: (
            ...args: Array<WsFrameData | boolean | string | Error | number | bigint | object | null | undefined>
        ) => void
    ): void {
        this.#handlers[event] = handler;
    }

    emit(
        event: string,
        ...args: Array<WsFrameData | boolean | string | Error | number | bigint | object | null | undefined>
    ) {
        this.#handlers[event]?.(...args);
    }

    send(data: string | Uint8Array | ArrayBuffer) {
        this.#socket.send(data);
    }

    close(code?: number, reason?: string) {
        this.#socket.close(code, reason);
    }
}

class MultiVersionWebsocketServer extends Evented<BunWebSocketServerEvents> {
    port: number;
    _connections: Record<string, BunConnectionRef>;
    _connectionIds: ConnectionIdGenerator;
    _socketAdapters: WeakMap<object, BunSocketAdapter>;
    _server: ReturnType<typeof BunRuntime.serve>;
    private staticRoot: string | null;
    private statusProvider?: () => string;
    private profilePreviewProvider?: (request: Request) => Response;
    private passkeyAuthProvider?: (request: Request) => Response | Promise<Response>;
    private runtimeMapPackProvider?: (request: Request) => Response | Promise<Response>;

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
                    const isReady = typeof this.statusProvider === 'function';
                    return new Response(getHealthzResponseBody(isReady ? 'ok' : 'starting'), {
                        status: isReady ? 200 : 503,
                    });
                }
                if (requestPath === '/version') {
                    return new Response(getVersionResponseBody(), { status: 200 });
                }
                if (requestPath === '/assets/maps/runtime/map-pack.json' && this.runtimeMapPackProvider) {
                    return this.runtimeMapPackProvider(request);
                }
                if (requestPath === '/status' && this.statusProvider) {
                    return new Response(this.statusProvider(), { status: 200 });
                }
                if (
                    (requestPath === '/profile/preview.svg' || requestPath === '/profile/preview.json') &&
                    this.profilePreviewProvider
                ) {
                    return this.profilePreviewProvider(request);
                }
                if (
                    (requestPath === '/auth/passkey/register/options' ||
                        requestPath === '/auth/passkey/register/verify' ||
                        requestPath === '/auth/passkey/login/options' ||
                        requestPath === '/auth/passkey/login/verify' ||
                        requestPath === '/auth/passkey/logout') &&
                    this.passkeyAuthProvider
                ) {
                    return this.passkeyAuthProvider(request);
                }
                if (requestPath === '/ws') {
                    const sessionToken = parseCookieValue(request.headers.get('cookie'), AUTH_SESSION_COOKIE_KEY);
                    const accountNameKey = verifySignedAuthSessionToken({ token: sessionToken });
                    if (
                        server.upgrade(request, {
                            data: {
                                remoteAddress: this.#resolveRemoteAddress(server, request),
                                accountNameKey: accountNameKey ?? undefined,
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
                open: (socket: BunSocketLike) => {
                    const adapter = new BunSocketAdapter(socket);
                    this._socketAdapters.set(socket, adapter);
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
                    const normalizedAccountNameKey =
                        typeof accountNameKey === 'string' ? normalizeIdentityKeyOrNull(accountNameKey) : null;
                    if (normalizedAccountNameKey !== null) {
                        connection.accountNameKey = normalizedAccountNameKey;
                    }
                    this.addConnection(connection);
                    this.emit('connect', connection);
                    logConnectionEvent('info', WS_EVENT_NAMES.CONNECTION_OPEN, connection, undefined);
                },
                message: (socket: object, message: WsFrameData) => {
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

    #resolveRemoteAddress(
        server: { requestIP?: (request: Request) => { address?: string } | null },
        request: Request
    ): string {
        try {
            if (typeof server.requestIP === 'function') {
                const ip = server.requestIP(request);
                if (ip && typeof ip.address === 'string') {
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

    onRequestRuntimeMapPack(runtimeMapPackProvider: (request: Request) => Response | Promise<Response>) {
        this.runtimeMapPackProvider = runtimeMapPackProvider;
    }

    forEachConnection(callback: (connection: BunConnectionRef, connectionId: string) => void) {
        Object.keys(this._connections).forEach((connectionId) => {
            const connection = this._connections[connectionId];
            if (connection) {
                callback(connection, connectionId);
            }
        });
    }

    addConnection(connection: BunConnectionRef) {
        this._connections[connection.id] = connection;
    }

    removeConnection(id: string) {
        delete this._connections[id];
    }

    getConnection(id: string) {
        return this._connections[id];
    }

    broadcast(message: JsonValue) {
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
