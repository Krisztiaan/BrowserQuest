export const HANDSHAKE_CONTROL = {
    GO: 'go',
    TIMEOUT: 'timeout',
} as const;

export type HandshakeControl = (typeof HANDSHAKE_CONTROL)[keyof typeof HANDSHAKE_CONTROL];

export const DISPATCHER_CONNECT_STATUS = {
    OK: 'OK',
    FULL: 'FULL',
} as const;

export type DispatcherConnectStatus = (typeof DISPATCHER_CONNECT_STATUS)[keyof typeof DISPATCHER_CONNECT_STATUS];

type ConnectionStatusValue = string | number | boolean | null | undefined | object;

export function isHandshakeControl(value: ConnectionStatusValue): value is HandshakeControl {
    return value === HANDSHAKE_CONTROL.GO || value === HANDSHAKE_CONTROL.TIMEOUT;
}

export function isDispatcherConnectStatus(value: ConnectionStatusValue): value is DispatcherConnectStatus {
    return value === DISPATCHER_CONNECT_STATUS.OK || value === DISPATCHER_CONNECT_STATUS.FULL;
}
