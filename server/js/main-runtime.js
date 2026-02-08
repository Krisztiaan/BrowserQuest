// AUTO-GENERATED from server/js/main-runtime.cts via `bun run build:main-runtime`.
// Do not edit server/js/main-runtime.js directly.

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ConfigPreflight = require('./config-preflight');
const MetricsRuntime = require('./metrics-runtime');
const Log = require('./log');
const log = Log.getLogger();
function createRuntimeDependencies(overrides) {
    const injected = overrides || {};
    return {
        ws: injected.ws || require('./ws'),
        WorldServer: injected.WorldServer || require('./worldserver'),
        Player: injected.Player || require('./player'),
        metricsRuntime: injected.metricsRuntime || MetricsRuntime,
        logger: injected.logger || log,
        processObject: injected.processObject || process,
        setIntervalFn: injected.setIntervalFn ||
            function (handler, timeoutMs) {
                return setInterval(handler, timeoutMs);
            },
        setTimeoutFn: injected.setTimeoutFn ||
            function (handler, timeoutMs) {
                return setTimeout(handler, timeoutMs);
            },
        clearIntervalFn: injected.clearIntervalFn ||
            function (timerHandle) {
                clearInterval(timerHandle);
            },
    };
}
function createServerEventEmitter(logger) {
    return function (level, eventName, fields) {
        logger.event(level, eventName, fields);
    };
}
function createPopulationCheckTimer(metrics, getWorlds, setIntervalFn) {
    let lastTotalPlayers = 0;
    return setIntervalFn(function () {
        if (metrics.isEnabled && metrics.isReady) {
            metrics.getTotalPlayers(function (totalPlayers) {
                if (totalPlayers !== lastTotalPlayers) {
                    lastTotalPlayers = totalPlayers;
                    getWorlds().forEach(function (world) {
                        world.updatePopulation(totalPlayers);
                    });
                }
            });
        }
    }, 1000);
}
function createPopulationCheckCleanup(timerHandle, clearIntervalFn) {
    return function () {
        clearIntervalFn(timerHandle);
    };
}
function createServerAndMetrics(config, emitServerEvent, dependencies) {
    return {
        server: new dependencies.ws.MultiVersionWebsocketServer(config.port),
        metrics: dependencies.metricsRuntime.createMetrics(config, emitServerEvent),
    };
}
function createWorlds(config, server, dependencies) {
    const worlds = [];
    for (let i = 0; i < config.nb_worlds; i += 1) {
        const world = new dependencies.WorldServer('world' + (i + 1), config.nb_players_per_world, server);
        world.run(config.map_filepath);
        worlds.push(world);
    }
    return worlds;
}
function createPopulationChangeHandler(metrics, getWorlds, getWorldDistributionFn) {
    return function () {
        const worlds = getWorlds();
        metrics.updatePlayerCounters(worlds, function (totalPlayers) {
            worlds.forEach(function (world) {
                world.updatePopulation(totalPlayers);
            });
        });
        metrics.updateWorldDistribution(getWorldDistributionFn(worlds));
    };
}
function installWorldPopulationHooks(worlds, metrics, onPopulationChange) {
    if (!metrics.isEnabled) {
        return;
    }
    worlds.forEach(function (world) {
        world.onPlayerAdded(onPopulationChange);
        world.onPlayerRemoved(onPopulationChange);
    });
}
function initializeMetricsPopulation(metrics, onPopulationChange) {
    if (!metrics.isEnabled) {
        return;
    }
    metrics.ready(function () {
        onPopulationChange(); // initialize all counters to 0 when the server starts
    });
}
function createFatalReporter(emitServerEvent, logger) {
    const fatalEvents = {
        uncaughtException: 'server.fatal.uncaught_exception',
        unhandledRejection: 'server.fatal.unhandled_rejection',
    };
    return function (label, err) {
        const eventName = fatalEvents[label] || 'server.fatal.unknown';
        if (typeof err === 'object' && err !== null && 'stack' in err) {
            const stack = String(err.stack);
            logger.error(label + ': ' + stack);
            emitServerEvent('error', eventName, {
                source: label,
                message: String(err.message || err),
                stack: stack,
            });
        }
        else {
            logger.error(label + ': ' + err);
            emitServerEvent('error', eventName, {
                source: label,
                message: String(err),
            });
        }
    };
}
function installFatalHandlers(processObject, reportFatal) {
    const uncaughtHandler = function (e) {
        reportFatal('uncaughtException', e);
    };
    const rejectionHandler = function (reason) {
        reportFatal('unhandledRejection', reason);
    };
    processObject.on('uncaughtException', uncaughtHandler);
    processObject.on('unhandledRejection', rejectionHandler);
    return function () {
        if (typeof processObject.off === 'function') {
            processObject.off('uncaughtException', uncaughtHandler);
            processObject.off('unhandledRejection', rejectionHandler);
        }
        else if (typeof processObject.removeListener === 'function') {
            processObject.removeListener('uncaughtException', uncaughtHandler);
            processObject.removeListener('unhandledRejection', rejectionHandler);
        }
    };
}
function triggerFatalTestEvent(env, setTimeoutFn, reportFatal) {
    const runtimeEnv = env || {};
    const fatalTestTrigger = runtimeEnv.BQ_TEST_TRIGGER_FATAL_EVENT;
    if (fatalTestTrigger === 'unhandled_rejection') {
        setTimeoutFn(function () {
            reportFatal('unhandledRejection', new Error('bq-fatal-test-unhandled-rejection'));
        }, 10);
    }
    else if (fatalTestTrigger === 'uncaught_exception') {
        setTimeoutFn(function () {
            reportFatal('uncaughtException', new Error('bq-fatal-test-uncaught-exception'));
        }, 10);
    }
}
function createRuntimeCleanup(teardownHandlers) {
    const handlers = Array.isArray(teardownHandlers) ? teardownHandlers : [];
    let cleanedUp = false;
    return function () {
        if (cleanedUp) {
            return;
        }
        cleanedUp = true;
        handlers.forEach(function (handler) {
            if (typeof handler === 'function') {
                handler();
            }
        });
    };
}
function main(config, options) {
    const runtimeOptions = options || {};
    const validationResult = ConfigPreflight.validateConfig(config);
    const dependencies = createRuntimeDependencies(runtimeOptions.dependencies);
    const logger = dependencies.logger;
    const emitServerEvent = createServerEventEmitter(logger);
    if (!validationResult.isValid) {
        emitServerEvent('error', 'server.config.invalid', {
            errors: validationResult.errors,
        });
        logger.error('Invalid server configuration: ' + JSON.stringify(validationResult.errors));
        dependencies.processObject.exit(1);
        return;
    }
    const ws = dependencies.ws;
    const Player = dependencies.Player;
    const runtime = createServerAndMetrics(config, emitServerEvent, dependencies);
    const server = runtime.server;
    const metrics = runtime.metrics;
    let worlds = [];
    const populationCheckTimer = createPopulationCheckTimer(metrics, function () {
        return worlds;
    }, dependencies.setIntervalFn);
    const cleanupPopulationCheckTimer = createPopulationCheckCleanup(populationCheckTimer, dependencies.clearIntervalFn);
    switch (config.debug_level) {
        case 'error':
            Log.setLevel(Log.ERROR);
            break;
        case 'debug':
            Log.setLevel(Log.DEBUG);
            break;
        case 'info':
            Log.setLevel(Log.INFO);
            break;
        default:
            Log.setLevel(Log.INFO);
            break;
    }
    logger.info('Starting BrowserQuest game server...');
    emitServerEvent('info', 'server.start', {
        port: config.port,
        worlds: config.nb_worlds,
        worldCapacity: config.nb_players_per_world,
        metricsEnabled: !!config.metrics_enabled,
    });
    server.onConnect(function (connection) {
        const connect = function (world) {
            if (world) {
                world.connect_callback(new Player(connection, world));
                return;
            }
            connection.close('Server is full.');
            emitServerEvent('info', 'server.connect.rejected', {
                reason: 'world_capacity_reached',
            });
        };
        if (metrics.isEnabled) {
            metrics.getOpenWorldCount(function (open_world_count) {
                let openWorldCount = Number.parseInt(String(open_world_count), 10);
                if (!Number.isFinite(openWorldCount) || openWorldCount < 0) {
                    openWorldCount = worlds.length;
                }
                // choose the least populated world among open worlds
                const openWorlds = worlds.slice(0, openWorldCount);
                const world = openWorlds.length === 0
                    ? null
                    : openWorlds.reduce(function (minWorld, candidate) {
                        return candidate.playerCount < minWorld.playerCount ? candidate : minWorld;
                    });
                connect(world);
            });
        }
        else {
            // simply fill each world sequentially until they are full
            const world = worlds.find(function (candidateWorld) {
                return candidateWorld.playerCount < config.nb_players_per_world;
            });
            if (world) {
                world.updatePopulation();
            }
            connect(world);
        }
    });
    server.onError(function (...args) {
        const message = args.map(String).join(', ');
        logger.error(message);
        emitServerEvent('error', 'server.error', {
            message: message,
        });
    });
    const onPopulationChange = createPopulationChangeHandler(metrics, function () {
        return worlds;
    }, getWorldDistribution);
    worlds = createWorlds(config, server, dependencies);
    installWorldPopulationHooks(worlds, metrics, onPopulationChange);
    server.onRequestStatus(function () {
        return JSON.stringify(getWorldDistribution(worlds));
    });
    initializeMetricsPopulation(metrics, onPopulationChange);
    const reportFatal = createFatalReporter(emitServerEvent, logger);
    const cleanupFatalHandlers = installFatalHandlers(dependencies.processObject, reportFatal);
    const cleanupRuntime = createRuntimeCleanup([cleanupPopulationCheckTimer, cleanupFatalHandlers]);
    triggerFatalTestEvent(dependencies.processObject.env, dependencies.setTimeoutFn, reportFatal);
    if (typeof runtimeOptions.onLifecycle === 'function') {
        runtimeOptions.onLifecycle({
            cleanup: cleanupRuntime,
        });
    }
    return {
        cleanup: cleanupRuntime,
    };
}
function getWorldDistribution(worlds) {
    return worlds.map(function (world) {
        return world.playerCount;
    });
}
module.exports = {
    main: main,
    getWorldDistribution: getWorldDistribution,
    createRuntimeDependencies: createRuntimeDependencies,
    createServerAndMetrics: createServerAndMetrics,
    createWorlds: createWorlds,
    createPopulationChangeHandler: createPopulationChangeHandler,
    installWorldPopulationHooks: installWorldPopulationHooks,
    initializeMetricsPopulation: initializeMetricsPopulation,
    createServerEventEmitter: createServerEventEmitter,
    createPopulationCheckTimer: createPopulationCheckTimer,
    createPopulationCheckCleanup: createPopulationCheckCleanup,
    createFatalReporter: createFatalReporter,
    installFatalHandlers: installFatalHandlers,
    triggerFatalTestEvent: triggerFatalTestEvent,
    createRuntimeCleanup: createRuntimeCleanup,
};
