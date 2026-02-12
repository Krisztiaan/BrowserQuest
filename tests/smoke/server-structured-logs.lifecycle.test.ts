import { afterEach, expect, test } from 'bun:test';
import { createStructuredLogHarness } from './server-structured-logs.harness';

const harness = createStructuredLogHarness();

afterEach(async () => {
    await harness.cleanup();
});

test('server emits structured websocket lifecycle events', async () => {
    const { port, events } = await harness.startServerWithEventCapture({ name: 'structured-logs' });
    await harness.openAndCloseWebSocketSession(port);

    await harness.waitForEvent(events, 'ws.server.listen');
    await harness.waitForEvent(events, 'ws.connection.open');
    await harness.waitForEvent(events, 'ws.connection.closed');

    const openEvent = events.find((e) => e.event === 'ws.connection.open');
    const closedEvent = events.find((e) => e.event === 'ws.connection.closed');

    expect(openEvent?.connectionId).toBeDefined();
    expect(openEvent?.remoteAddress).toBeDefined();
    expect(closedEvent?.connectionId).toBeDefined();
    expect(closedEvent?.remoteAddress).toBeDefined();
});

test('server emits structured metrics-unavailable event when metrics backend is unreachable', async () => {
    const { events } = await harness.startServerWithEventCapture({
        name: 'structured-logs-metrics-unavailable',
        captureStderr: true,
        configOverrides: {
            metrics_enabled: true,
            memcached_host: '127.0.0.1',
            memcached_port: 65534,
            server_name: 'local',
            game_servers: [{ name: 'local' }],
        },
    });

    const metricsUnavailable = await harness.waitForEvent(events, 'server.metrics.unavailable');

    expect(metricsUnavailable.reason).toBe('connect_failed');
    expect(typeof metricsUnavailable.error).toBe('string');
});

test('server emits structured metrics-unavailable invalid-config event when metrics config is incomplete', async () => {
    const { events } = await harness.startServerWithEventCapture({
        name: 'structured-logs-metrics-invalid-config',
        captureStderr: true,
        configOverrides: {
            metrics_enabled: true,
        },
    });

    const metricsUnavailable = await harness.waitForEvent(events, 'server.metrics.unavailable');

    expect(metricsUnavailable.reason).toBe('invalid_config');
    expect(Array.isArray(metricsUnavailable.invalidFields)).toBe(true);
});
