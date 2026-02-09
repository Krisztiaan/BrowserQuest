export const SERVER_EVENT_NAMES = {
    START: 'server.start',
    CONNECT_REJECTED: 'server.connect.rejected',
    ERROR: 'server.error',
    CONFIG_INVALID: 'server.config.invalid',
    FATAL_UNCAUGHT_EXCEPTION: 'server.fatal.uncaught_exception',
    FATAL_UNHANDLED_REJECTION: 'server.fatal.unhandled_rejection',
    FATAL_UNKNOWN: 'server.fatal.unknown',
    METRICS_UNAVAILABLE: 'server.metrics.unavailable',
    METRICS_READY: 'server.metrics.ready',
    ESM_WS_RUNTIME_MODE: 'server.esm.ws_runtime_mode',
    ESM_WS_BRIDGE_PROBE: 'server.esm.ws_bridge_probe',
} as const;

export const WS_EVENT_NAMES = {
    CONNECTION_CLOSE_REQUEST: 'ws.connection.close_request',
    CONNECTION_CLOSED: 'ws.connection.closed',
    CONNECTION_ERROR: 'ws.connection.error',
    CONNECTION_OPEN: 'ws.connection.open',
    SERVER_LISTEN: 'ws.server.listen',
    SERVER_ERROR: 'ws.server.error',
} as const;

export const WORLD_EVENT_NAMES = {
    PLAYER_JOIN: 'world.player.join',
    PLAYER_LEAVE: 'world.player.leave',
} as const;

export type ServerEventName = (typeof SERVER_EVENT_NAMES)[keyof typeof SERVER_EVENT_NAMES];
export type WsEventName = (typeof WS_EVENT_NAMES)[keyof typeof WS_EVENT_NAMES];
export type WorldEventName = (typeof WORLD_EVENT_NAMES)[keyof typeof WORLD_EVENT_NAMES];
export type RuntimeEventName = ServerEventName | WsEventName | WorldEventName;
