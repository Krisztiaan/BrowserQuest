export const HANDSHAKE_CONTROL = {
    GO: 'go',
    TIMEOUT: 'timeout',
} as const;

export type HandshakeControl = (typeof HANDSHAKE_CONTROL)[keyof typeof HANDSHAKE_CONTROL];

export const DISPATCHER_CONNECT_STATUS = {
    OK: 'OK',
    FULL: 'FULL',
} as const;

export type DispatcherConnectStatus =
    (typeof DISPATCHER_CONNECT_STATUS)[keyof typeof DISPATCHER_CONNECT_STATUS];

export function isHandshakeControl(value: unknown): value is HandshakeControl {
    return value === HANDSHAKE_CONTROL.GO || value === HANDSHAKE_CONTROL.TIMEOUT;
}

export function isDispatcherConnectStatus(value: unknown): value is DispatcherConnectStatus {
    return value === DISPATCHER_CONNECT_STATUS.OK || value === DISPATCHER_CONNECT_STATUS.FULL;
}
