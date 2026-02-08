export interface WebSocketRuntimeLogger {
    info(message: string): void;
    error(message: string): void;
    event(level: string, event: string, fields: Record<string, unknown>): void;
}

export interface WebSocketRuntimeUtils {
    random(max: number): number;
}

export interface WebSocketRuntimeProtocol {
    parseProtocolActionBatch(payload: string): unknown[];
}

export interface WebSocketRuntimeCloseCodes {
    NORMAL: number;
    UNSUPPORTED_DATA: number;
    INVALID_PAYLOAD: number;
}

export interface HttpResponseLike {
    writeHead(code: number): void;
    write(text: string): void;
    end(): void;
}

export interface HttpServerLike {
    listen(port: number, callback: () => void): void;
}

export type CreateHttpServer = (
    handler: (request: { url?: string }, response: HttpResponseLike) => void
) => HttpServerLike;

export type ParseUrlPathname = (requestUrl: string | undefined) => string | null | undefined;

export interface WebSocketServerLike {
    on(event: string, handler: (...args: unknown[]) => void): void;
}

export interface WebSocketModuleLike {
    WebSocketServer: new (options: object) => WebSocketServerLike;
}

export interface WebSocketRuntimeConnectionRef {
    id: string;
    remoteAddress: string;
}

export type LogConnectionEvent = (
    level: string,
    eventName: string,
    connection: WebSocketRuntimeConnectionRef,
    extraFields?: Record<string, unknown>
) => void;

export interface WebSocketRuntimeFactoryDeps {
    log: WebSocketRuntimeLogger;
    Utils: WebSocketRuntimeUtils;
    Protocol: WebSocketRuntimeProtocol;
    CLOSE_CODES: WebSocketRuntimeCloseCodes;
    WebSocket: WebSocketModuleLike;
    createHttpServer: CreateHttpServer;
    parseUrlPathname: ParseUrlPathname;
    logConnectionEvent: LogConnectionEvent;
    useBison?: boolean;
}

export interface WebSocketRuntimeClasses {
    MultiVersionWebsocketServer: new (port: number) => unknown;
    wsWebSocketConnection: new (
        id: string,
        connection: unknown,
        server: unknown,
        remoteAddress: string
    ) => unknown;
}

export type CreateWebSocketRuntimeClasses = (deps: WebSocketRuntimeFactoryDeps) => WebSocketRuntimeClasses;
