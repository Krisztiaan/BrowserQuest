import type {
    MainRuntimeDependencies,
    MainRuntimeDependencyOverrides,
    MainRuntimeOptions,
    RuntimeLogger,
    RuntimeMetrics,
    RuntimeProcessLike,
    RuntimeServer,
    RuntimeServerEventEmitter,
    RuntimeWorld,
    ServerConfig,
} from './main-runtime-types';
import { SERVER_EVENT_NAMES, type RuntimeEventName } from './server-event-names';
import ConfigPreflight from './config-preflight';
import MetricsRuntime from './metrics-runtime';
import Log from './log';
import WsRuntimeModule from './ws-runtime-esm';
import WorldServer from './worldserver';
import Player from './player';

interface ConfigValidationResult {
    isValid: boolean;
    errors: unknown[];
}

const WsRuntime = WsRuntimeModule as MainRuntimeDependencies['ws'];

const log = Log.getLogger();

function createRuntimeDependencies(overrides?: MainRuntimeDependencyOverrides): MainRuntimeDependencies {
    const injected = overrides || {};
    return {
        ws: injected.ws || WsRuntime,
        WorldServer: injected.WorldServer || (WorldServer as unknown as MainRuntimeDependencies['WorldServer']),
        Player: injected.Player || (Player as unknown as MainRuntimeDependencies['Player']),
        metricsRuntime: injected.metricsRuntime || (MetricsRuntime as unknown as MainRuntimeDependencies['metricsRuntime']),
        logger: injected.logger || log,
        processObject: injected.processObject || (process as unknown as RuntimeProcessLike),
        setIntervalFn:
            injected.setIntervalFn ||
            function (handler, timeoutMs) {
                return setInterval(handler, timeoutMs);
            },
        setTimeoutFn:
            injected.setTimeoutFn ||
            function (handler, timeoutMs) {
                return setTimeout(handler, timeoutMs);
            },
        clearIntervalFn:
            injected.clearIntervalFn ||
            function (timerHandle) {
                clearInterval(timerHandle as unknown as Parameters<typeof clearInterval>[0]);
            },
    };
}

function createServerEventEmitter(logger: RuntimeLogger): RuntimeServerEventEmitter {
    return function (level, eventName, fields) {
        logger.event(level, eventName, fields);
    };
}

function createPopulationCheckTimer(
    metrics: RuntimeMetrics,
    getWorlds: () => RuntimeWorld[],
    setIntervalFn: MainRuntimeDependencies['setIntervalFn']
): unknown {
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

function createPopulationCheckCleanup(
    timerHandle: unknown,
    clearIntervalFn: MainRuntimeDependencies['clearIntervalFn']
): () => void {
    return function () {
        clearIntervalFn(timerHandle);
    };
}

function createServerAndMetrics(
    config: ServerConfig,
    emitServerEvent: RuntimeServerEventEmitter,
    dependencies: MainRuntimeDependencies
): { server: RuntimeServer; metrics: RuntimeMetrics } {
    return {
        server: new dependencies.ws.MultiVersionWebsocketServer(config.port),
        metrics: dependencies.metricsRuntime.createMetrics(config, emitServerEvent),
    };
}

function createWorlds(
    config: ServerConfig,
    server: RuntimeServer,
    dependencies: MainRuntimeDependencies
): RuntimeWorld[] {
    const worlds: RuntimeWorld[] = [];

    for (let i = 0; i < config.nb_worlds; i += 1) {
        const world = new dependencies.WorldServer('world' + (i + 1), config.nb_players_per_world, server);
        world.run(config.map_filepath);
        worlds.push(world);
    }

    return worlds;
}

function createPopulationChangeHandler(
    metrics: RuntimeMetrics,
    getWorlds: () => RuntimeWorld[],
    getWorldDistributionFn: (worlds: RuntimeWorld[]) => number[]
): () => void {
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

function installWorldPopulationHooks(
    worlds: RuntimeWorld[],
    metrics: RuntimeMetrics,
    onPopulationChange: () => void
): void {
    if (!metrics.isEnabled) {
        return;
    }

    worlds.forEach(function (world) {
        world.on('playerAdded', onPopulationChange);
        world.on('playerRemoved', onPopulationChange);
    });
}

function initializeMetricsPopulation(metrics: RuntimeMetrics, onPopulationChange: () => void): void {
    if (!metrics.isEnabled) {
        return;
    }

    metrics.ready(function () {
        onPopulationChange(); // initialize all counters to 0 when the server starts
    });
}

function createFatalReporter(
    emitServerEvent: RuntimeServerEventEmitter,
    logger: RuntimeLogger
): (label: string, err: unknown) => void {
    const fatalEvents: Record<string, RuntimeEventName> = {
        uncaughtException: SERVER_EVENT_NAMES.FATAL_UNCAUGHT_EXCEPTION,
        unhandledRejection: SERVER_EVENT_NAMES.FATAL_UNHANDLED_REJECTION,
    };

    return function (label, err) {
        const eventName = fatalEvents[label] || SERVER_EVENT_NAMES.FATAL_UNKNOWN;
        if (typeof err === 'object' && err !== null && 'stack' in err) {
            const stack = String((err as { stack?: unknown }).stack);
            logger.error(label + ': ' + stack);
            emitServerEvent('error', eventName, {
                source: label,
                message: String((err as { message?: unknown }).message || err),
                stack: stack,
            });
        } else {
            logger.error(label + ': ' + err);
            emitServerEvent('error', eventName, {
                source: label,
                message: String(err),
            });
        }
    };
}

function installFatalHandlers(
    processObject: RuntimeProcessLike,
    reportFatal: (label: string, err: unknown) => void
): () => void {
    const uncaughtHandler = function (e: unknown) {
        reportFatal('uncaughtException', e);
    };
    const rejectionHandler = function (reason: unknown) {
        reportFatal('unhandledRejection', reason);
    };

    processObject.on('uncaughtException', uncaughtHandler);
    processObject.on('unhandledRejection', rejectionHandler);

    return function () {
        if (typeof processObject.off === 'function') {
            processObject.off('uncaughtException', uncaughtHandler);
            processObject.off('unhandledRejection', rejectionHandler);
        } else if (typeof processObject.removeListener === 'function') {
            processObject.removeListener('uncaughtException', uncaughtHandler);
            processObject.removeListener('unhandledRejection', rejectionHandler);
        }
    };
}

function triggerFatalTestEvent(
    env: RuntimeProcessLike['env'] | undefined,
    setTimeoutFn: MainRuntimeDependencies['setTimeoutFn'],
    reportFatal: (label: string, err: unknown) => void
): void {
    const runtimeEnv = env || {};
    const fatalTestTrigger = runtimeEnv.BQ_TEST_TRIGGER_FATAL_EVENT;
    if (fatalTestTrigger === 'unhandled_rejection') {
        setTimeoutFn(function () {
            reportFatal('unhandledRejection', new Error('bq-fatal-test-unhandled-rejection'));
        }, 10);
    } else if (fatalTestTrigger === 'uncaught_exception') {
        setTimeoutFn(function () {
            reportFatal('uncaughtException', new Error('bq-fatal-test-uncaught-exception'));
        }, 10);
    }
}

function createRuntimeCleanup(teardownHandlers?: unknown[]): () => void {
    const handlers = Array.isArray(teardownHandlers) ? teardownHandlers : [];
    let cleanedUp = false;

    return function () {
        if (cleanedUp) {
            return;
        }
        cleanedUp = true;
        handlers.forEach(function (handler) {
            if (typeof handler === 'function') {
                (handler as () => void)();
            }
        });
    };
}

function main(config: ServerConfig, options?: MainRuntimeOptions): { cleanup: () => void } | undefined {
    const runtimeOptions = options || {};
    const validationResult = ConfigPreflight.validateConfig(config);
    const dependencies = createRuntimeDependencies(runtimeOptions.dependencies);
    const logger = dependencies.logger;
    const emitServerEvent = createServerEventEmitter(logger);

    if (!validationResult.isValid) {
        emitServerEvent('error', SERVER_EVENT_NAMES.CONFIG_INVALID, {
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
    let worlds: RuntimeWorld[] = [];

    const populationCheckTimer = createPopulationCheckTimer(
        metrics,
        function () {
            return worlds;
        },
        dependencies.setIntervalFn
    );
    const cleanupPopulationCheckTimer = createPopulationCheckCleanup(
        populationCheckTimer,
        dependencies.clearIntervalFn
    );

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
    emitServerEvent('info', SERVER_EVENT_NAMES.START, {
        port: config.port,
        worlds: config.nb_worlds,
        worldCapacity: config.nb_players_per_world,
        metricsEnabled: !!config.metrics_enabled,
    });

    server.onConnect(function (connection) {
        const connect = function (world: RuntimeWorld | null | undefined) {
            if (world) {
                world.emit('playerConnect', new Player(connection, world));
                return;
            }
            connection.close('Server is full.');
            emitServerEvent('info', SERVER_EVENT_NAMES.CONNECT_REJECTED, {
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
                const world =
                    openWorlds.length === 0
                        ? null
                        : openWorlds.reduce(function (minWorld, candidate) {
                              return candidate.playerCount < minWorld.playerCount ? candidate : minWorld;
                          });
                connect(world);
            });
        } else {
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

    server.onError(function (...args: unknown[]) {
        const message = args.map(String).join(', ');
        logger.error(message);
        emitServerEvent('error', SERVER_EVENT_NAMES.ERROR, {
            message: message,
        });
    });

    const onPopulationChange = createPopulationChangeHandler(
        metrics,
        function () {
            return worlds;
        },
        getWorldDistribution
    );
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

function getWorldDistribution(worlds: RuntimeWorld[]): number[] {
    return worlds.map(function (world) {
        return world.playerCount;
    });
}

export {
    main,
    getWorldDistribution,
    createRuntimeDependencies,
    createServerAndMetrics,
    createWorlds,
    createPopulationChangeHandler,
    installWorldPopulationHooks,
    initializeMetricsPopulation,
    createServerEventEmitter,
    createPopulationCheckTimer,
    createPopulationCheckCleanup,
    createFatalReporter,
    installFatalHandlers,
    triggerFatalTestEvent,
    createRuntimeCleanup,
};
