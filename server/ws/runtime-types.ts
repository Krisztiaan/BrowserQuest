import type { ProtocolParsedAction } from '../../shared/protocol/types';
import type { RuntimeEventName } from '../server-event-names';

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type RuntimeEventFields = Record<string, JsonValue>;

export interface WebSocketRuntimeLogger {
    info(message: string): void;
    error(message: string): void;
    event(level: string, event: RuntimeEventName, fields: RuntimeEventFields): void;
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

export interface HttpUpgradeRequestLike {
    socket?: { remoteAddress?: string | null };
    headers?: { cookie?: string };
}

export interface WebSocketServerLike {
    on(event: 'error', handler: (error: WsErrorLike) => void): void;
    on(event: 'connection', handler: (connection: WsConnectionLike, request?: HttpUpgradeRequestLike) => void): void;
    on(event: string, handler: (...args: Array<WsConnectionLike | HttpUpgradeRequestLike | WsErrorLike>) => void): void;
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
    extraFields?: RuntimeEventFields
) => void;

export type WsFrameData = string | Uint8Array | ArrayBuffer | Buffer;
export type WsErrorLike = string | Error | number | boolean | bigint | null | undefined | object;

export interface WsConnectionLike {
    on(
        event: string,
        handler: (...args: Array<WsFrameData | WsErrorLike | boolean>) => void
    ): void;
    send(data: string): void;
    close(code?: number, reason?: string): void;
}

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
    accountNameKey?: string;
    onClose(callback: () => void): void;
    listen(callback: (action: ProtocolParsedAction) => void): void;
    send(message: JsonValue): void;
    sendUTF8(data: string): void;
    close(logError: string, closeCode?: number): void;
    closeInvalidPayload(logError: string): void;
    closeUnsupportedData(logError: string): void;
}

export interface WebSocketRuntimeServer {
    on(eventName: 'connect', callback: (connection: WebSocketRuntimeConnection) => void): void;
    on(eventName: 'error', callback: (...args: Array<string | Error | object | null | undefined>) => void): void;
    onRequestStatus(callback: () => string): void;
    broadcast(message: JsonValue): void;
}

export interface WebSocketRuntimeClasses {
    MultiVersionWebsocketServer: new (port: number) => WebSocketRuntimeServer;
    wsWebSocketConnection: new (
        id: string,
        connection: WsConnectionLike,
        server: { removeConnection(id: string): void },
        remoteAddress: string
    ) => WebSocketRuntimeConnection;
}

export type CreateWebSocketRuntimeClasses = (deps: WebSocketRuntimeFactoryDeps) => WebSocketRuntimeClasses;
