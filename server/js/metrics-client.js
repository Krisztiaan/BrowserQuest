function createMetricsClient(memcacheModule, config, hooks) {
    var onReady = hooks && typeof hooks.onReady === "function" ? hooks.onReady : function() {},
        onError = hooks && typeof hooks.onError === "function" ? hooks.onError : function() {},
        LegacyClient = memcacheModule && memcacheModule.Client,
        ModernMemcacheClient = memcacheModule && (memcacheModule.Memcache || memcacheModule.default);

    if(typeof LegacyClient === "function") {
        var legacyClient = new LegacyClient(config.memcached_port, config.memcached_host);
        legacyClient.on("connect", onReady);
        return {
            clientType: "legacy",
            connect: function() {
                legacyClient.connect();
            },
            set: function(key, value, callback) {
                legacyClient.set(key, value, function() {
                    callback(true);
                });
            },
            get: function(key, callback) {
                legacyClient.get(key, function(error, result) {
                    callback(result);
                });
            }
        };
    }

    if(typeof ModernMemcacheClient === "function") {
        var modernClient = new ModernMemcacheClient(config.memcached_host + ":" + config.memcached_port);
        if(typeof modernClient.on === "function") {
            modernClient.on("connect", onReady);
        }
        return {
            clientType: "modern",
            connect: function() {
                Promise.resolve(modernClient.connect())
                    .then(onReady)
                    .catch(onError);
            },
            set: function(key, value, callback) {
                Promise.resolve(modernClient.set(key, value))
                    .then(function(result) {
                        callback(result !== false);
                    })
                    .catch(function() {
                        callback(false);
                    });
            },
            get: function(key, callback) {
                Promise.resolve(modernClient.get(key))
                    .then(function(result) {
                        callback(result);
                    })
                    .catch(function() {
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
