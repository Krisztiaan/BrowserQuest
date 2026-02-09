import { expect, test } from 'bun:test';
import {
    DISPATCHER_CONNECT_STATUS,
    HANDSHAKE_CONTROL,
    isDispatcherConnectStatus,
    isHandshakeControl,
} from '../../shared/js/connection-status';

test('shared handshake control constants and guards are stable', () => {
    expect(HANDSHAKE_CONTROL.GO).toBe('go');
    expect(HANDSHAKE_CONTROL.TIMEOUT).toBe('timeout');
    expect(isHandshakeControl('go')).toBe(true);
    expect(isHandshakeControl('timeout')).toBe(true);
    expect(isHandshakeControl('nope')).toBe(false);
});

test('shared dispatcher status constants and guards are stable', () => {
    expect(DISPATCHER_CONNECT_STATUS.OK).toBe('OK');
    expect(DISPATCHER_CONNECT_STATUS.FULL).toBe('FULL');
    expect(isDispatcherConnectStatus('OK')).toBe(true);
    expect(isDispatcherConnectStatus('FULL')).toBe(true);
    expect(isDispatcherConnectStatus('ERROR')).toBe(false);
});
