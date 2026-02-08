import type {
    CreateWebSocketRuntimeClasses,
    WebSocketRuntimeCloseCodes,
    WebSocketRuntimeClasses,
} from './ws-runtime-class-factory-types.js';

export const WS_RUNTIME_DEPENDENCY_BOUNDARIES = [
    'url',
    'http',
    './log',
    './utils',
    '../../shared/js/protocol-contract.js',
    '../../shared/js/ws-close-codes',
    'ws',
    './ws-runtime-class-factory.cjs',
] as const;

export type WsRuntimeDependencyBoundary = (typeof WS_RUNTIME_DEPENDENCY_BOUNDARIES)[number];

export const WS_MODULE_EXPORT_KEYS = [
    'CLOSE_CODES',
    'createWebSocketRuntimeClasses',
    'MultiVersionWebsocketServer',
    'wsWebSocketConnection',
] as const;

export type WsModuleExportKey = (typeof WS_MODULE_EXPORT_KEYS)[number];

export interface WsModuleContract {
    CLOSE_CODES: WebSocketRuntimeCloseCodes;
    createWebSocketRuntimeClasses: CreateWebSocketRuntimeClasses;
    MultiVersionWebsocketServer: WebSocketRuntimeClasses['MultiVersionWebsocketServer'];
    wsWebSocketConnection: WebSocketRuntimeClasses['wsWebSocketConnection'];
}

export interface WsModuleShadowSourceContract {
    dependencyBoundaries: readonly WsRuntimeDependencyBoundary[];
    exportKeys: readonly WsModuleExportKey[];
}

export const WS_MODULE_SHADOW_SOURCE_CONTRACT: WsModuleShadowSourceContract = {
    dependencyBoundaries: WS_RUNTIME_DEPENDENCY_BOUNDARIES,
    exportKeys: WS_MODULE_EXPORT_KEYS,
};
