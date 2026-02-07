
var MetricsClient = require("./metrics-client"),
    Log = require("./log");
var log = Log.getLogger();
var MEMCACHE_MODULE_NAME = "memcache";

class Metrics {
    constructor(config, options) {
        var self = this,
            runtimeOptions = options || {},
            memcacheModule = require(MEMCACHE_MODULE_NAME);
        
        this.config = config;
        this.client = null;
        this.isEnabled = false;
        this.isReady = false;
        this.unavailableReasons = {};
        this.onUnavailable = typeof runtimeOptions.onUnavailable === "function" ? runtimeOptions.onUnavailable : function() {};

        var reportUnavailable = function(reason, fields) {
            if(self.unavailableReasons[reason]) {
                return;
            }
            self.unavailableReasons[reason] = true;
            self.onUnavailable(reason, fields || {});
        };

        var markReady = function() {
            if(self.isReady) {
                return;
            }
            self.isReady = true;
            log.info("Metrics enabled: memcached client connected to "+config.memcached_host+":"+config.memcached_port);
            if(self.ready_callback) {
                self.ready_callback();
            }
        };

        this.client = MetricsClient.createMetricsClient(memcacheModule, config, {
            onReady: markReady,
            onError: function(error) {
                var errorMessage = String(error && error.message ? error.message : error);
                log.error("Memcached client connect failed: " + errorMessage);
                reportUnavailable("connect_failed", {
                    error: errorMessage
                });
            },
            onOperationError: function(details) {
                var operation = details && details.operation ? String(details.operation) : "unknown";
                var reason = operation === "read" ? "read_failed" : "write_failed";
                reportUnavailable(reason, {
                    operation: operation,
                    key: details && details.key ? String(details.key) : undefined,
                    error: details && details.error ? String(details.error) : "unknown_error"
                });
            }
        });
        this.client.connect();
    }
    
    ready(callback) {
        this.ready_callback = callback;
        if(this.isReady && typeof this.ready_callback === "function") {
            this.ready_callback();
        }
    }

    setValue(key, value, callback) {
        var done = typeof callback === "function" ? callback : function() {};

        if(!this.isReady) {
            done(false);
            return;
        }

        this.client.set(key, value, done);
    }

    getValue(key, callback) {
        var done = typeof callback === "function" ? callback : function() {};

        if(!this.isReady) {
            done(undefined);
            return;
        }

        this.client.get(key, done);
    }
    
    updatePlayerCounters(worlds, updatedCallback) {
        var self = this,
            config = this.config,
            gameServers = Array.isArray(config.game_servers) ? config.game_servers : [],
            numServers = gameServers.length,
            playerCount = worlds.reduce(function(sum, world) { return sum + world.playerCount; }, 0);
        
        if(this.isReady) {
            // Set the number of players on this server
            this.setValue('player_count_'+config.server_name, playerCount, function() {
                var total_players = 0;
                
                // Recalculate the total number of players and set it
                gameServers.forEach(function(server) {
                    self.getValue('player_count_'+server.name, function(result) {
                        var count = result ? Number.parseInt(result, 10) : 0;

                        total_players += count;
                        numServers -= 1;
                        if(numServers === 0) {
                            self.setValue('total_players', total_players, function() {
                                if(updatedCallback) {
                                    updatedCallback(total_players);
                                }
                            });
                        }
                    });
                });
            });
        } else {
            log.error("Memcached client not connected");
        }
    }
    
    updateWorldDistribution(worlds) {
        this.setValue('world_distribution_'+this.config.server_name, worlds);
    }
    
    getOpenWorldCount(callback) {
        this.getValue('world_count_'+this.config.server_name, function(result) {
            callback(result);
        });
    }
    
    getTotalPlayers(callback) {
        this.getValue('total_players', function(result) {
            callback(result);
        });
    }
}

module.exports = Metrics;
