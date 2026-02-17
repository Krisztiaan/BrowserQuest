import type { RuntimeEventFields, RuntimeMetrics } from './runtime-types';
import type { RuntimeEventName } from './server-event-names';
import { SERVER_EVENT_NAMES } from './server-event-names';
import Log from './log';
import { createNoopMetricsAdapter } from './metrics-adapters/noop';
import { createMemcacheMetricsAdapter } from './metrics-adapters/memcache';

const log = Log.getLogger();

type MetricsServer = Readonly<{
    name: string;
}>;

type MetricsConfig = Readonly<{
    metrics_enabled?: boolean;
    memcached_host?: string;
    memcached_port?: number | string;
    server_name?: string;
    game_servers?: MetricsServer[];
}>;

type ValidMetricsConfig = Readonly<{
    metrics_enabled: true;
    memcached_host: string;
    memcached_port: number | string;
    server_name: string;
    game_servers: MetricsServer[];
}>;

type NoopMeta = Readonly<{
    reason?: string;
    invalidFields?: string[];
    error?: string;
}>;

type EventFields = RuntimeEventFields;
type RuntimeErrorLike = string | Error | number | boolean | bigint | object | null | undefined;

interface RuntimeAdapters {
    createNoopMetricsAdapter(meta: NoopMeta): RuntimeMetrics;
    createMemcacheMetricsAdapter(
        config: ValidMetricsConfig,
        options: {
            onReady: () => void;
            onUnavailable: (reason: string, details?: EventFields) => void;
        }
    ): RuntimeMetrics;
}

interface RuntimeOptions {
    adapters?: RuntimeAdapters;
}

type EmitServerEvent = (level: string, eventName: RuntimeEventName, fields: EventFields) => void;

function isNonEmptyString(value: string | undefined): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

function isValidPort(value: number | string | undefined): value is number | string {
    const port = Number.parseInt(String(value), 10);
    return Number.isFinite(port) && port > 0;
}

function hasValidGameServers(value: MetricsServer[] | undefined): value is MetricsServer[] {
    return Array.isArray(value) && value.length > 0 && value.every((server) => isNonEmptyString(server.name));
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

function toValidConfig(config: MetricsConfig): ValidMetricsConfig | null {
    if (!isNonEmptyString(config.memcached_host)) {
        return null;
    }
    if (!isValidPort(config.memcached_port)) {
        return null;
    }
    if (!isNonEmptyString(config.server_name)) {
        return null;
    }
    if (!hasValidGameServers(config.game_servers)) {
        return null;
    }
    return {
        metrics_enabled: true,
        memcached_host: config.memcached_host,
        memcached_port: config.memcached_port,
        server_name: config.server_name,
        game_servers: config.game_servers,
    };
}

function resolveErrorMessage(err: RuntimeErrorLike): string {
    const resolveObjectTag = (value: object): string => {
        const ctor = (value as { constructor?: { name?: unknown } }).constructor;
        return typeof ctor?.name === 'string' && ctor.name.length > 0 ? `[object ${ctor.name}]` : '[object Object]';
    };
    if (err instanceof Error && typeof err.message === 'string' && err.message.length > 0) {
        return err.message;
    }
    if (typeof err === 'string') {
        return err;
    }
    if (
        typeof err === 'number'
        || typeof err === 'boolean'
        || typeof err === 'bigint'
        || err === null
        || err === undefined
    ) {
        return String(err);
    }
    try {
        const json = JSON.stringify(err);
        if (typeof json === 'string') {
            return json;
        }
    } catch {
        // fall through
    }
    return resolveObjectTag(err);
}

function createMetrics(
    config: MetricsConfig,
    emitServerEvent?: EmitServerEvent,
    options?: RuntimeOptions
): RuntimeMetrics {
    const runtimeOptions = options ?? {};
    const adapters: RuntimeAdapters = runtimeOptions.adapters ?? {
        createNoopMetricsAdapter,
        createMemcacheMetricsAdapter,
    };
    const emitEvent: EmitServerEvent = typeof emitServerEvent === 'function' ? emitServerEvent : () => {};
    const emitUnavailableEvent = (reason: string, fields?: EventFields): void => {
        const payload: EventFields = { reason };
        if (fields && typeof fields === 'object' && !Array.isArray(fields)) {
            for (const [key, value] of Object.entries(fields)) {
                payload[key] = value;
            }
        }
        emitEvent('error', SERVER_EVENT_NAMES.METRICS_UNAVAILABLE, payload);
    };

    if (!config.metrics_enabled) {
        return adapters.createNoopMetricsAdapter({ reason: 'disabled' });
    }

    const invalidFields = getInvalidFields(config);
    if (invalidFields.length > 0) {
        log.error('Metrics disabled: invalid configuration (' + invalidFields.join(', ') + ')');
        emitUnavailableEvent('invalid_config', { invalidFields });
        return adapters.createNoopMetricsAdapter({
            reason: 'invalid_config',
            invalidFields,
        });
    }

    const validConfig = toValidConfig(config);
    if (!validConfig) {
        emitUnavailableEvent('invalid_config', { invalidFields: ['metrics_config'] });
        return adapters.createNoopMetricsAdapter({
            reason: 'invalid_config',
            invalidFields: ['metrics_config'],
        });
    }

    try {
        return adapters.createMemcacheMetricsAdapter(validConfig, {
            onReady: () => {
                emitEvent('info', SERVER_EVENT_NAMES.METRICS_READY, {
                    memcachedHost: validConfig.memcached_host,
                    memcachedPort: validConfig.memcached_port,
                    serverName: validConfig.server_name,
                });
            },
            onUnavailable: (reason, details) => {
                emitUnavailableEvent(reason, details);
            },
        });
    } catch (err) {
        const errorMessage = resolveErrorMessage(err as RuntimeErrorLike);
        log.error('Metrics disabled: ' + errorMessage);
        emitUnavailableEvent('init_failed', {
            error: errorMessage,
        });
        return adapters.createNoopMetricsAdapter({
            reason: 'init_failed',
            error: errorMessage,
        });
    }
}

export { createMetrics };
export default { createMetrics };
