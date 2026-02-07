function createMetricsClient(memcacheModule, config, hooks) {
    var onReady = hooks && typeof hooks.onReady === "function" ? hooks.onReady : function() {},
        onError = hooks && typeof hooks.onError === "function" ? hooks.onError : function() {},
        onOperationError = hooks && typeof hooks.onOperationError === "function" ? hooks.onOperationError : function() {},
        LegacyClient = memcacheModule && memcacheModule.Client,
        ModernMemcacheClient = memcacheModule && (memcacheModule.Memcache || memcacheModule.default);

    var normalizeError = function(error) {
        if(!error) {
            return "unknown_error";
        }
        if(error && error.message) {
            return String(error.message);
        }
        return String(error);
    };

    if(typeof LegacyClient === "function") {
        var legacyClient = new LegacyClient(config.memcached_port, config.memcached_host);
        legacyClient.on("connect", onReady);
        legacyClient.on("error", onError);
        return {
            clientType: "legacy",
            connect: function() {
                legacyClient.connect();
            },
            set: function(key, value, callback) {
                legacyClient.set(key, value, function(error) {
                    if(error) {
                        onOperationError({
                            operation: "write",
                            key: key,
                            error: normalizeError(error)
                        });
                        callback(false);
                        return;
                    }
                    callback(true);
                });
            },
            get: function(key, callback) {
                legacyClient.get(key, function(error, result) {
                    if(error) {
                        onOperationError({
                            operation: "read",
                            key: key,
                            error: normalizeError(error)
                        });
                    }
                    callback(result);
                });
            }
        };
    }

    if(typeof ModernMemcacheClient === "function") {
        var modernClient = new ModernMemcacheClient(config.memcached_host + ":" + config.memcached_port);
        if(typeof modernClient.on === "function") {
            modernClient.on("connect", onReady);
            modernClient.on("error", onError);
        }
        return {
            clientType: "modern",
            connect: function() {
                Promise.resolve(modernClient.connect())
                    .then(onReady)
                    .catch(function(error) {
                        onError(normalizeError(error));
                    });
            },
            set: function(key, value, callback) {
                Promise.resolve(modernClient.set(key, value))
                    .then(function(result) {
                        callback(result !== false);
                    })
                    .catch(function(error) {
                        onOperationError({
                            operation: "write",
                            key: key,
                            error: normalizeError(error)
                        });
                        callback(false);
                    });
            },
            get: function(key, callback) {
                Promise.resolve(modernClient.get(key))
                    .then(function(result) {
                        callback(result);
                    })
                    .catch(function(error) {
                        onOperationError({
                            operation: "read",
                            key: key,
                            error: normalizeError(error)
                        });
                        callback(undefined);
                    });
            }
        };
    }

    throw new Error("Unsupported memcache client API");
}

module.exports = {
    createMetricsClient: createMetricsClient
};
