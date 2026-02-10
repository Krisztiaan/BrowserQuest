import type { ProtocolParsedAction } from '../../shared/js/protocol-contract-types';
import type { RuntimeEventName } from './server-event-names';

export interface WebSocketRuntimeLogger {
    info(message: string): void;
    error(message: string): void;
    event(level: string, event: RuntimeEventName, fields: Record<string, unknown>): void;
}

export interface WebSocketRuntimeUtils {
    random(max: number): number;
}

export interface WebSocketRuntimeProtocol {
    parseProtocolActionBatch(payload: string): ProtocolParsedAction[];
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
    eventName: RuntimeEventName,
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
}

export interface WebSocketRuntimeConnection {
    id: string;
    remoteAddress: string;
    onClose(callback: () => void): void;
    listen(callback: (action: ProtocolParsedAction) => void): void;
    send(message: unknown): void;
    sendUTF8(data: string): void;
    close(logError: string, closeCode?: number): void;
    closeInvalidPayload(logError: string): void;
    closeUnsupportedData(logError: string): void;
}

export interface WebSocketRuntimeServer {
    onConnect(callback: (connection: WebSocketRuntimeConnection) => void): void;
    onError(callback: (...args: unknown[]) => void): void;
    onRequestStatus(callback: () => string): void;
    broadcast(message: unknown): void;
}

export interface WebSocketRuntimeClasses {
    MultiVersionWebsocketServer: new (port: number) => WebSocketRuntimeServer;
    wsWebSocketConnection: new (
        id: string,
        connection: unknown,
        server: { removeConnection(id: string): void },
        remoteAddress: string
    ) => WebSocketRuntimeConnection;
}

export type CreateWebSocketRuntimeClasses = (deps: WebSocketRuntimeFactoryDeps) => WebSocketRuntimeClasses;
