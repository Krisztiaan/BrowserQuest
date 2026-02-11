import { expect, test } from 'bun:test';
import { createProbeEventEmitter, createStructuredEventEmitter } from '../../../../server/startup/events';

test('structured-event emitter writes non-error events to info channel with stable payload shape', () => {
    const infoLogs: string[] = [];
    const errorLogs: string[] = [];

    const emitStructuredEvent = createStructuredEventEmitter({
        emitInfo: (message) => infoLogs.push(message),
        emitError: (message) => errorLogs.push(message),
        nowIso: () => '2026-01-01T00:00:00.000Z',
    });

    emitStructuredEvent('info', 'server.startup', { mode: 'runtime', port: 8000 });

    expect(errorLogs).toEqual([]);
    expect(infoLogs).toHaveLength(1);
    expect(JSON.parse(infoLogs[0])).toEqual({
        ts: '2026-01-01T00:00:00.000Z',
        level: 'info',
        event: 'server.startup',
        mode: 'runtime',
        port: 8000,
    });
});

test('structured-event emitter writes error events to error channel', () => {
    const infoLogs: string[] = [];
    const errorLogs: string[] = [];

    const emitStructuredEvent = createStructuredEventEmitter({
        emitInfo: (message) => infoLogs.push(message),
        emitError: (message) => errorLogs.push(message),
        nowIso: () => '2026-01-01T00:00:00.000Z',
    });

    emitStructuredEvent('error', 'server.config_invalid', { reason: 'invalid_port' });

    expect(infoLogs).toEqual([]);
    expect(errorLogs).toHaveLength(1);
    expect(JSON.parse(errorLogs[0])).toEqual({
        ts: '2026-01-01T00:00:00.000Z',
        level: 'error',
        event: 'server.config_invalid',
        reason: 'invalid_port',
    });
});

test('probe-event emitter forwards through structured emitter with probe event name', () => {
    const emitted: Array<{ level: string; event: string; fields: Record<string, unknown> }> = [];
    const emitProbeEvent = createProbeEventEmitter({
        emitStructuredEvent: (level, event, fields = {}) => {
            emitted.push({ level, event, fields });
        },
    });

    emitProbeEvent('info', { mode: 'enabled' });

    expect(emitted).toEqual([
        {
            level: 'info',
            event: 'server.runtime.ws_bridge_probe',
            fields: { mode: 'enabled' },
        },
    ]);
});
