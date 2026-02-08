// AUTO-GENERATED from server/js/metrics-runtime.cts via `bun run build:metrics-runtime`.
// Do not edit server/js/metrics-runtime.js directly.

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const NoopAdapter = require('./metrics-adapters/noop');
const MemcacheAdapter = require('./metrics-adapters/memcache');
const Log = require('./log');
const log = Log.getLogger();
function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}
function isValidPort(value) {
    const port = Number.parseInt(String(value), 10);
    return Number.isFinite(port) && port > 0;
}
function hasValidGameServers(value) {
    return (Array.isArray(value) &&
        value.length > 0 &&
        value.every(function (server) {
            return (typeof server === 'object' && server !== null && isNonEmptyString(server.name));
        }));
}
function getInvalidFields(config) {
    const invalidFields = [];
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
function createMetrics(config, emitServerEvent, options) {
    const runtimeOptions = options || {};
    const adapters = runtimeOptions.adapters || {
        createNoopMetricsAdapter: NoopAdapter.createNoopMetricsAdapter,
        createMemcacheMetricsAdapter: MemcacheAdapter.createMemcacheMetricsAdapter,
    };
    const emitEvent = typeof emitServerEvent === 'function' ? emitServerEvent : function () { };
    const emitUnavailableEvent = function (reason, fields) {
        const payload = { reason: reason };
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
    }
    catch (err) {
        const errorMessage = typeof err === 'object' && err !== null && 'message' in err
            ? String(err.message)
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
