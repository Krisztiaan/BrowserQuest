const NoopAdapter = require('./metrics-adapters/noop') as {
    createNoopMetricsAdapter(meta: Record<string, unknown>): unknown;
};

const MemcacheAdapter = require('./metrics-adapters/memcache') as {
    createMemcacheMetricsAdapter(
        config: MetricsConfig,
        options: {
            onReady: () => void;
            onUnavailable: (reason: string, details?: Record<string, unknown>) => void;
        }
    ): unknown;
};

const Log = require('./log') as {
    getLogger(): { error(...args: unknown[]): void };
};

const log = Log.getLogger();

interface MetricsConfig {
    metrics_enabled?: boolean;
    memcached_host?: unknown;
    memcached_port?: unknown;
    server_name?: unknown;
    game_servers?: unknown;
}

interface RuntimeAdapters {
    createNoopMetricsAdapter(meta: Record<string, unknown>): unknown;
    createMemcacheMetricsAdapter(
        config: MetricsConfig,
        options: {
            onReady: () => void;
            onUnavailable: (reason: string, details?: Record<string, unknown>) => void;
        }
    ): unknown;
}

interface RuntimeOptions {
    adapters?: RuntimeAdapters;
}

type EmitServerEvent = (level: string, eventName: string, fields: Record<string, unknown>) => void;

function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

function isValidPort(value: unknown): boolean {
    const port = Number.parseInt(String(value), 10);
    return Number.isFinite(port) && port > 0;
}

function hasValidGameServers(value: unknown): boolean {
    return (
        Array.isArray(value) &&
        value.length > 0 &&
        value.every(function (server) {
            return (
                typeof server === 'object' && server !== null && isNonEmptyString((server as { name?: unknown }).name)
            );
        })
    );
}

function getInvalidFields(config: MetricsConfig): string[] {
    const invalidFields: string[] = [];
    if (!isNonEmptyString(config.memcached_host)) {
        invalidFields.push('memcached_host');
    }
    if (!isValidPort(config.memcached_port)) {
        invalidFields.push('memcached_port');
    }
    if (!isNonEmptyString(config.server_name)) {
        invalidFields.push('server_name');
    }
    if (!hasValidGameServers(config.game_servers)) {
        invalidFields.push('game_servers');
    }
    return invalidFields;
}

function createMetrics(
    config: MetricsConfig,
    emitServerEvent?: EmitServerEvent | unknown,
    options?: RuntimeOptions
): unknown {
    const runtimeOptions = options || {};
    const adapters = runtimeOptions.adapters || {
        createNoopMetricsAdapter: NoopAdapter.createNoopMetricsAdapter,
        createMemcacheMetricsAdapter: MemcacheAdapter.createMemcacheMetricsAdapter,
    };
    const emitEvent: EmitServerEvent =
        typeof emitServerEvent === 'function' ? (emitServerEvent as EmitServerEvent) : function () {};
    const emitUnavailableEvent = function (reason: string, fields?: Record<string, unknown>) {
        const payload: Record<string, unknown> = { reason: reason };
        if (fields && typeof fields === 'object' && !Array.isArray(fields)) {
            Object.keys(fields).forEach(function (key) {
                payload[key] = fields[key];
            });
        }
        emitEvent('error', 'server.metrics.unavailable', payload);
    };

    if (!config.metrics_enabled) {
        return adapters.createNoopMetricsAdapter({ reason: 'disabled' });
    }

    const invalidFields = getInvalidFields(config);
    if (invalidFields.length > 0) {
        log.error('Metrics disabled: invalid configuration (' + invalidFields.join(', ') + ')');
        emitUnavailableEvent('invalid_config', {
            invalidFields: invalidFields,
        });
        return adapters.createNoopMetricsAdapter({
            reason: 'invalid_config',
            invalidFields: invalidFields,
        });
    }

    try {
        return adapters.createMemcacheMetricsAdapter(config, {
            onReady: function () {
                emitEvent('info', 'server.metrics.ready', {
                    memcachedHost: config.memcached_host,
                    memcachedPort: config.memcached_port,
                    serverName: config.server_name,
                });
            },
            onUnavailable: function (reason, details) {
                emitUnavailableEvent(reason, details);
            },
        });
    } catch (err: unknown) {
        const errorMessage =
            typeof err === 'object' && err !== null && 'message' in err
                ? String((err as { message?: unknown }).message)
                : String(err);
        log.error('Metrics disabled: ' + errorMessage);
        emitUnavailableEvent('init_failed', {
            error: String(errorMessage),
        });
        return adapters.createNoopMetricsAdapter({
            reason: 'init_failed',
            error: String(errorMessage),
        });
    }
}

module.exports = {
    createMetrics: createMetrics,
};
