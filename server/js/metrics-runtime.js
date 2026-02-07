var NoopAdapter = require('./metrics-adapters/noop'),
    MemcacheAdapter = require('./metrics-adapters/memcache'),
    Log = require('./log');
var log = Log.getLogger();

function isNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
}

function isValidPort(value) {
    var port = Number.parseInt(value, 10);
    return Number.isFinite(port) && port > 0;
}

function hasValidGameServers(value) {
    return (
        Array.isArray(value) &&
        value.length > 0 &&
        value.every(function(server) {
            return server && isNonEmptyString(server.name);
        })
    );
}

function getInvalidFields(config) {
    var invalidFields = [];
    if(!isNonEmptyString(config.memcached_host)) {
        invalidFields.push("memcached_host");
    }
    if(!isValidPort(config.memcached_port)) {
        invalidFields.push("memcached_port");
    }
    if(!isNonEmptyString(config.server_name)) {
        invalidFields.push("server_name");
    }
    if(!hasValidGameServers(config.game_servers)) {
        invalidFields.push("game_servers");
    }
    return invalidFields;
}

function createMetrics(config, emitServerEvent, options) {
    var runtimeOptions = options || {};
    var adapters = runtimeOptions.adapters || {
        createNoopMetricsAdapter: NoopAdapter.createNoopMetricsAdapter,
        createMemcacheMetricsAdapter: MemcacheAdapter.createMemcacheMetricsAdapter
    };
    var emitEvent = typeof emitServerEvent === "function" ? emitServerEvent : function() {};

    if(!config.metrics_enabled) {
        return adapters.createNoopMetricsAdapter({ reason: "disabled" });
    }

    var invalidFields = getInvalidFields(config);
    if(invalidFields.length > 0) {
        log.error("Metrics disabled: invalid configuration (" + invalidFields.join(", ") + ")");
        emitEvent("error", "server.metrics.unavailable", {
            reason: "invalid_config",
            invalidFields: invalidFields
        });
        return adapters.createNoopMetricsAdapter({
            reason: "invalid_config",
            invalidFields: invalidFields
        });
    }

    try {
        return adapters.createMemcacheMetricsAdapter(config, {
            onReady: function() {
                emitEvent("info", "server.metrics.ready", {
                    memcachedHost: config.memcached_host,
                    memcachedPort: config.memcached_port,
                    serverName: config.server_name
                });
            }
        });
    } catch(err) {
        var errorMessage = err && err.message ? err.message : String(err);
        log.error("Metrics disabled: " + errorMessage);
        emitEvent("error", "server.metrics.unavailable", {
            reason: "init_failed",
            error: String(errorMessage)
        });
        return adapters.createNoopMetricsAdapter({
            reason: "init_failed",
            error: String(errorMessage)
        });
    }
}

module.exports = {
    createMetrics: createMetrics
};
