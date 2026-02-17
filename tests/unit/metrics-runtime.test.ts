import { afterEach, beforeEach, expect, test } from 'bun:test';
import Log from '../../server/log';
import MetricsRuntime from '../../server/metrics-runtime';
import type { RuntimeEventFields } from '../../server/runtime-types';

const originalConsoleError = console.error;
const originalLogLevel = Log.getLogger().level;

type NoopMetricsAdapter = {
    isEnabled: false;
    meta: RuntimeEventFields;
};

type BaseConfig = {
    metrics_enabled: boolean;
    memcached_host?: string;
    memcached_port?: number;
    server_name?: string;
    game_servers?: Array<{ name: string }>;
};

function isRecord(value: object | null | undefined): value is RuntimeEventFields {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertNoopMetricsAdapter(
    value: Readonly<{ isEnabled?: boolean; meta?: RuntimeEventFields }> | null | undefined
): asserts value is NoopMetricsAdapter {
    if (!isRecord(value) || value.isEnabled !== false || !isRecord(value.meta)) {
        throw new Error('Expected noop metrics adapter shape');
    }
}

function createValidConfig(): BaseConfig {
    return {
        metrics_enabled: true,
        memcached_host: '127.0.0.1',
        memcached_port: 11211,
        server_name: 'local',
        game_servers: [{ name: 'local' }],
    };
}

afterEach(() => {
    console.error = originalConsoleError;
    Log.setLevel(originalLogLevel);
});

beforeEach(() => {
    console.error = () => {};
});

test('metrics runtime returns no-op adapter when metrics are disabled', () => {
    const emitted: Array<{ level: string; event: string; fields: RuntimeEventFields }> = [];
    let memcacheCalls = 0;

    const result = MetricsRuntime.createMetrics(
        { metrics_enabled: false },
        (level: string, event: string, fields: RuntimeEventFields) => {
            emitted.push({ level, event, fields });
        },
        {
            adapters: {
                createNoopMetricsAdapter: (meta: RuntimeEventFields) => ({ isEnabled: false, meta }),
                createMemcacheMetricsAdapter: () => {
                    memcacheCalls += 1;
                    return { isEnabled: true };
                },
            },
        }
    );

    assertNoopMetricsAdapter(result);
    expect(result.isEnabled).toBe(false);
    expect(result.meta.reason).toBe('disabled');
    expect(memcacheCalls).toBe(0);
    expect(emitted.length).toBe(0);
});

test('metrics runtime emits invalid-config fallback and uses no-op adapter', () => {
    const emitted: Array<{ level: string; event: string; fields: RuntimeEventFields }> = [];
    let memcacheCalls = 0;

    const result = MetricsRuntime.createMetrics(
        { metrics_enabled: true },
        (level: string, event: string, fields: RuntimeEventFields) => {
            emitted.push({ level, event, fields });
        },
        {
            adapters: {
                createNoopMetricsAdapter: (meta: RuntimeEventFields) => ({ isEnabled: false, meta }),
                createMemcacheMetricsAdapter: () => {
                    memcacheCalls += 1;
                    return { isEnabled: true };
                },
            },
        }
    );

    assertNoopMetricsAdapter(result);
    expect(result.isEnabled).toBe(false);
    expect(result.meta.reason).toBe('invalid_config');
    expect(Array.isArray(result.meta.invalidFields)).toBe(true);
    expect(memcacheCalls).toBe(0);
    expect(emitted.length).toBe(1);
    expect(emitted[0].level).toBe('error');
    expect(emitted[0].event).toBe('server.metrics.unavailable');
    expect(emitted[0].fields.reason).toBe('invalid_config');
});

test('metrics runtime emits init-failed fallback when memcache adapter throws', () => {
    const emitted: Array<{ level: string; event: string; fields: RuntimeEventFields }> = [];

    const result = MetricsRuntime.createMetrics(
        createValidConfig(),
        (level: string, event: string, fields: RuntimeEventFields) => {
            emitted.push({ level, event, fields });
        },
        {
            adapters: {
                createNoopMetricsAdapter: (meta: RuntimeEventFields) => ({ isEnabled: false, meta }),
                createMemcacheMetricsAdapter: () => {
                    throw new Error('adapter unavailable');
                },
            },
        }
    );

    assertNoopMetricsAdapter(result);
    expect(result.isEnabled).toBe(false);
    expect(result.meta.reason).toBe('init_failed');
    expect(typeof result.meta.error).toBe('string');
    expect(result.meta.error).toContain('adapter unavailable');
    expect(emitted.length).toBe(1);
    expect(emitted[0].fields.reason).toBe('init_failed');
});

test('metrics runtime returns memcache adapter when configuration is valid', () => {
    const expectedAdapter = { isEnabled: true, isReady: false, adapter: 'memcache' };
    const emitted: Array<{ level: string; event: string; fields: RuntimeEventFields }> = [];

    const result = MetricsRuntime.createMetrics(
        createValidConfig(),
        (level: string, event: string, fields: RuntimeEventFields) => {
            emitted.push({ level, event, fields });
        },
        {
            adapters: {
                createNoopMetricsAdapter: (meta: RuntimeEventFields) => ({ isEnabled: false, meta }),
                createMemcacheMetricsAdapter: () => expectedAdapter,
            },
        }
    );

    expect(result).toBe(expectedAdapter);
    expect(emitted.length).toBe(0);
});

test('metrics runtime wires structured metrics-ready signal via memcache adapter hook', () => {
    const emitted: Array<{ level: string; event: string; fields: RuntimeEventFields }> = [];
    let onReadyHook: (() => void) | null = null;

    MetricsRuntime.createMetrics(
        createValidConfig(),
        (level: string, event: string, fields: RuntimeEventFields) => {
            emitted.push({ level, event, fields });
        },
        {
            adapters: {
                createNoopMetricsAdapter: (meta: RuntimeEventFields) => ({ isEnabled: false, meta }),
                createMemcacheMetricsAdapter: (_config: BaseConfig, options: { onReady?: () => void } | undefined) => {
                    onReadyHook = options?.onReady ?? null;
                    return { isEnabled: true };
                },
            },
        }
    );

    expect(typeof onReadyHook).toBe('function');
    onReadyHook?.();

    expect(emitted.length).toBe(1);
    expect(emitted[0].event).toBe('server.metrics.ready');
    expect(emitted[0].fields.serverName).toBe('local');
    expect(emitted[0].fields.memcachedHost).toBe('127.0.0.1');
});

test('metrics runtime forwards adapter unavailability signals with stable reason codes', () => {
    const emitted: Array<{ level: string; event: string; fields: RuntimeEventFields }> = [];
    let onUnavailableHook: ((reason: string, details?: RuntimeEventFields) => void) | null = null;

    MetricsRuntime.createMetrics(
        createValidConfig(),
        (level: string, event: string, fields: RuntimeEventFields) => {
            emitted.push({ level, event, fields });
        },
        {
            adapters: {
                createNoopMetricsAdapter: (meta: RuntimeEventFields) => ({ isEnabled: false, meta }),
                createMemcacheMetricsAdapter: (
                    _config: BaseConfig,
                    options: { onUnavailable?: (reason: string, details?: RuntimeEventFields) => void } | undefined
                ) => {
                    onUnavailableHook = options?.onUnavailable ?? null;
                    return { isEnabled: true };
                },
            },
        }
    );

    expect(typeof onUnavailableHook).toBe('function');
    onUnavailableHook?.('connect_failed', { error: 'connect timeout' });

    expect(emitted.length).toBe(1);
    expect(emitted[0].event).toBe('server.metrics.unavailable');
    expect(emitted[0].fields.reason).toBe('connect_failed');
    expect(emitted[0].fields.error).toBe('connect timeout');
});
