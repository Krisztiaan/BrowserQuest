
var cls = require("./lib/class"),
    MetricsClient = require("./metrics-client"),
    Log = require("./log");
var log = Log.getLogger();

var Metrics = cls.Class.extend({
    init: function(config) {
        var self = this,
            memcacheModule = require("memcache");
        
        this.config = config;
        this.client = null;
        this.isReady = false;

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
                log.error("Memcached client connect failed: " + String(error && error.message ? error.message : error));
            }
        });
        this.client.connect();
    },
    
    ready: function(callback) {
        this.ready_callback = callback;
        if(this.isReady && typeof this.ready_callback === "function") {
            this.ready_callback();
        }
    },

    setValue: function(key, value, callback) {
        var done = typeof callback === "function" ? callback : function() {};

        if(!this.isReady) {
            done(false);
            return;
        }

        this.client.set(key, value, done);
    },

    getValue: function(key, callback) {
        var done = typeof callback === "function" ? callback : function() {};

        if(!this.isReady) {
            done(undefined);
            return;
        }

        this.client.get(key, done);
    },
    
    updatePlayerCounters: function(worlds, updatedCallback) {
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
    },
    
    updateWorldDistribution: function(worlds) {
        this.setValue('world_distribution_'+this.config.server_name, worlds);
    },
    
    getOpenWorldCount: function(callback) {
        this.getValue('world_count_'+this.config.server_name, function(result) {
            callback(result);
        });
    },
    
    getTotalPlayers: function(callback) {
        this.getValue('total_players', function(result) {
            callback(result);
        });
    }
});

module.exports = Metrics;
