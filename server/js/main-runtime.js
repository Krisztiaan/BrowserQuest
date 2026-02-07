
var ConfigPreflight = require('./config-preflight'),
    MetricsRuntime = require('./metrics-runtime'),
    Log = require('./log');
var log = Log.getLogger();

function createRuntimeDependencies(overrides) {
    var injected = overrides || {};
    return {
        ws: injected.ws || require("./ws"),
        WorldServer: injected.WorldServer || require("./worldserver"),
        Player: injected.Player || require("./player"),
        metricsRuntime: injected.metricsRuntime || MetricsRuntime,
        processObject: injected.processObject || process,
        setIntervalFn: injected.setIntervalFn || setInterval,
        setTimeoutFn: injected.setTimeoutFn || setTimeout
    };
}

function createServerEventEmitter(logger) {
    return function(level, eventName, fields) {
        logger.event(level, eventName, fields);
    };
}

function createPopulationCheckTimer(metrics, getWorlds, setIntervalFn) {
    var lastTotalPlayers = 0;

    return setIntervalFn(function() {
        if(metrics.isEnabled && metrics.isReady) {
            metrics.getTotalPlayers(function(totalPlayers) {
                if(totalPlayers !== lastTotalPlayers) {
                    lastTotalPlayers = totalPlayers;
                    getWorlds().forEach(function(world) {
                        world.updatePopulation(totalPlayers);
                    });
                }
            });
        }
    }, 1000);
}

function createServerAndMetrics(config, emitServerEvent, dependencies) {
    return {
        server: new dependencies.ws.MultiVersionWebsocketServer(config.port),
        metrics: dependencies.metricsRuntime.createMetrics(config, emitServerEvent)
    };
}

function createWorlds(config, server, metrics, dependencies, onPopulationChange) {
    var worlds = [];

    for(var i = 0; i < config.nb_worlds; i += 1) {
        var world = new dependencies.WorldServer('world'+ (i+1), config.nb_players_per_world, server);
        world.run(config.map_filepath);
        worlds.push(world);
        if(metrics.isEnabled) {
            world.onPlayerAdded(onPopulationChange);
            world.onPlayerRemoved(onPopulationChange);
        }
    }

    return worlds;
}

function createFatalReporter(emitServerEvent, logger) {
    var fatalEvents = {
        uncaughtException: "server.fatal.uncaught_exception",
        unhandledRejection: "server.fatal.unhandled_rejection"
    };

    return function(label, err) {
        var eventName = fatalEvents[label] || "server.fatal.unknown";
        if(err && err.stack) {
            logger.error(label + ": " + err.stack);
            emitServerEvent("error", eventName, {
                source: label,
                message: String(err.message || err),
                stack: String(err.stack)
            });
        } else {
            logger.error(label + ": " + err);
            emitServerEvent("error", eventName, {
                source: label,
                message: String(err)
            });
        }
    };
}

function installFatalHandlers(processObject, reportFatal) {
    processObject.on('uncaughtException', function (e) {
        reportFatal('uncaughtException', e);
    });

    processObject.on('unhandledRejection', function (reason) {
        reportFatal('unhandledRejection', reason);
    });
}

function triggerFatalTestEvent(env, setTimeoutFn, reportFatal) {
    var runtimeEnv = env || {};
    var fatalTestTrigger = runtimeEnv.BQ_TEST_TRIGGER_FATAL_EVENT;
    if(fatalTestTrigger === "unhandled_rejection") {
        setTimeoutFn(function() {
            reportFatal('unhandledRejection', new Error("bq-fatal-test-unhandled-rejection"));
        }, 10);
    } else if(fatalTestTrigger === "uncaught_exception") {
        setTimeoutFn(function() {
            reportFatal('uncaughtException', new Error("bq-fatal-test-uncaught-exception"));
        }, 10);
    }
}

function main(config, options) {
    var runtimeOptions = options || {};
    var emitServerEvent = createServerEventEmitter(log),
        validationResult = ConfigPreflight.validateConfig(config),
        dependencies = createRuntimeDependencies(runtimeOptions.dependencies);

    if(!validationResult.isValid) {
        emitServerEvent("error", "server.config.invalid", {
            errors: validationResult.errors
        });
        log.error("Invalid server configuration: " + JSON.stringify(validationResult.errors));
        dependencies.processObject.exit(1);
        return;
    }

    var ws = dependencies.ws,
        Player = dependencies.Player,
        runtime = createServerAndMetrics(config, emitServerEvent, dependencies),
        server = runtime.server,
        metrics = runtime.metrics,
        worlds = [];

    createPopulationCheckTimer(metrics, function() {
        return worlds;
    }, dependencies.setIntervalFn);
    
    switch(config.debug_level) {
        case "error":
            Log.setLevel(Log.ERROR); break;
        case "debug":
            Log.setLevel(Log.DEBUG); break;
        case "info":
            Log.setLevel(Log.INFO); break;
        default:
            Log.setLevel(Log.INFO); break;
    };
    
    log.info("Starting BrowserQuest game server...");
    emitServerEvent("info", "server.start", {
        port: config.port,
        worlds: config.nb_worlds,
        worldCapacity: config.nb_players_per_world,
        metricsEnabled: !!config.metrics_enabled
    });
    
    server.onConnect(function(connection) {
        var connect = function(world) {
                if(world) {
                    world.connect_callback(new Player(connection, world));
                    return;
                }
                connection.close("Server is full.");
                emitServerEvent("info", "server.connect.rejected", {
                    reason: "world_capacity_reached"
                });
            };
        
        if(metrics.isEnabled) {
            metrics.getOpenWorldCount(function(open_world_count) {
                var openWorldCount = Number.parseInt(open_world_count, 10);
                if(!Number.isFinite(openWorldCount) || openWorldCount < 0) {
                    openWorldCount = worlds.length;
                }
                // choose the least populated world among open worlds
                var openWorlds = worlds.slice(0, openWorldCount);
                var world = openWorlds.length === 0 ? null : openWorlds.reduce(function(minWorld, candidate) {
                    return candidate.playerCount < minWorld.playerCount ? candidate : minWorld;
                });
                connect(world);
            });
        }
        else {
            // simply fill each world sequentially until they are full
            var world = worlds.find(function(world) {
                return world.playerCount < config.nb_players_per_world;
            });
            if(world) {
                world.updatePopulation();
            }
            connect(world);
        }
    });

    server.onError(function() {
        log.error(Array.prototype.join.call(arguments, ", "));
        emitServerEvent("error", "server.error", {
            message: Array.prototype.join.call(arguments, ", ")
        });
    });
    
    var onPopulationChange = function() {
        metrics.updatePlayerCounters(worlds, function(totalPlayers) {
            worlds.forEach(function(world) {
                world.updatePopulation(totalPlayers);
            });
        });
        metrics.updateWorldDistribution(getWorldDistribution(worlds));
    };

    worlds = createWorlds(config, server, metrics, dependencies, onPopulationChange);
    
    server.onRequestStatus(function() {
        return JSON.stringify(getWorldDistribution(worlds));
    });
    
    if(metrics.isEnabled) {
        metrics.ready(function() {
            onPopulationChange(); // initialize all counters to 0 when the server starts
        });
    }

    var reportFatal = createFatalReporter(emitServerEvent, log);
    installFatalHandlers(dependencies.processObject, reportFatal);
    triggerFatalTestEvent(dependencies.processObject.env, dependencies.setTimeoutFn, reportFatal);
}

function getWorldDistribution(worlds) {
    return worlds.map(function(world) {
        return world.playerCount;
    });
}

module.exports = {
    main: main,
    getWorldDistribution: getWorldDistribution,
    createRuntimeDependencies: createRuntimeDependencies,
    createServerAndMetrics: createServerAndMetrics,
    createWorlds: createWorlds,
    createServerEventEmitter: createServerEventEmitter,
    createPopulationCheckTimer: createPopulationCheckTimer,
    createFatalReporter: createFatalReporter,
    installFatalHandlers: installFatalHandlers,
    triggerFatalTestEvent: triggerFatalTestEvent
};
