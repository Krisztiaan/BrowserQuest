import type {
    MainRuntimeDependencies,
    MainRuntimeDependencyOverrides,
    MainRuntimeOptions,
    RuntimeConnection,
    RuntimeEventFieldValue,
    RuntimeLogger,
    RuntimeMetrics,
    RuntimePlayer,
    RuntimeProcessLike,
    RuntimeServer,
    RuntimeServerEventEmitter,
    RuntimeIntervalHandle,
    RuntimeWorld,
    ServerConfig,
} from './runtime-types';
import { SERVER_EVENT_NAMES, type RuntimeEventName } from './server-event-names';
import ConfigPreflight from './config-preflight';
import MetricsRuntime from './metrics-runtime';
import Log from './log';
import WsRuntimeModule from './ws/runtime';
import WorldServer from './world-server';
import Player from './player';
import { attachWorldConnectionSession } from './player-session';
import { DEFAULT_PLAYER_DB_PATH, SqlitePlayerPersistence } from './player-persistence';
import { createProfilePreviewJsonResponse, createProfilePreviewResponse } from './profile-preview';
import { createPasskeyAuthResponse } from './passkey-auth';
import { parseRequestPathname } from './http-utils';

const WsRuntime = WsRuntimeModule as MainRuntimeDependencies['ws'];
type SessionAttachArgs = Parameters<typeof attachWorldConnectionSession>[0];
type SessionConnection = SessionAttachArgs['connection'];
type SessionWorld = SessionAttachArgs['world'];

const log = Log.getLogger();

function createRuntimeDependencies(overrides?: MainRuntimeDependencyOverrides): MainRuntimeDependencies {
    const injected = overrides ?? {};
    return {
        ws: injected.ws ?? WsRuntime,
        WorldServer: injected.WorldServer ?? WorldServer,
        Player: injected.Player ?? Player,
        metricsRuntime: injected.metricsRuntime ?? MetricsRuntime,
        logger: injected.logger ?? log,
        processObject: injected.processObject ?? (process as RuntimeProcessLike),
        setIntervalFn:
            injected.setIntervalFn ??
            function (handler, timeoutMs) {
                return setInterval(handler, timeoutMs);
            },
        setTimeoutFn:
            injected.setTimeoutFn ??
            function (handler, timeoutMs) {
                return setTimeout(handler, timeoutMs);
            },
        clearIntervalFn:
            injected.clearIntervalFn ??
            function (timerHandle) {
                clearInterval(timerHandle as Parameters<typeof clearInterval>[0]);
            },
    };
}

function isSessionConnection(connection: RuntimeConnection): connection is RuntimeConnection & SessionConnection {
    return (
        typeof connection.id === 'string'
        && typeof connection.listen === 'function'
        && typeof connection.onClose === 'function'
        && typeof connection.sendUTF8 === 'function'
        && typeof connection.close === 'function'
    );
}

function isSessionWorld(world: RuntimeWorld): world is RuntimeWorld & SessionWorld {
    const candidate = world as {
        isPlayerActive?: unknown;
        enqueueCommand?: unknown;
        getConnectionPlayerById?: unknown;
    };
    return (
        typeof candidate.isPlayerActive === 'function'
        && typeof candidate.enqueueCommand === 'function'
        && typeof candidate.getConnectionPlayerById === 'function'
    );
}

function hasSessionPlayerId(player: RuntimePlayer): player is RuntimePlayer & { id: SessionAttachArgs['playerId'] } {
    return typeof player.id === 'number';
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
): RuntimeIntervalHandle {
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
    timerHandle: RuntimeIntervalHandle,
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
    dependencies: MainRuntimeDependencies,
    onWorldReady: () => void = () => {},
    onWorldCreated: (world: RuntimeWorld) => void = () => {}
): RuntimeWorld[] {
    const worlds: RuntimeWorld[] = [];

    for (let i = 0; i < config.nb_worlds; i += 1) {
        const world = new dependencies.WorldServer('world' + (i + 1), config.nb_players_per_world, server);
        const worldWithConfig = world as RuntimeWorld & { setServerConfig?: (config: ServerConfig) => void };
        worldWithConfig.setServerConfig?.(config);
        onWorldCreated(world);
        if (typeof world.on === 'function') {
            world.on('ready', onWorldReady);
        }
        world.run(config.map_filepath);
        worlds.push(world);
    }

    return worlds;
}

function resolvePlayerPersistencePath(config: ServerConfig): string {
    if (typeof config.player_db_path !== 'string' || config.player_db_path.trim().length === 0) {
        return DEFAULT_PLAYER_DB_PATH;
    }
    return config.player_db_path;
}

function flushWorldPersistenceOnShutdown(worlds: RuntimeWorld[]): void {
    for (const world of worlds) {
        const flushable = world as RuntimeWorld & { flushPersistenceOnShutdown?: () => void };
        if (typeof flushable.flushPersistenceOnShutdown === 'function') {
            try {
                flushable.flushPersistenceOnShutdown();
            } catch (err) {
                const worldId = (world as { id?: string }).id ?? 'unknown';
                log.event('error', 'server.shutdown.flush_failed', {
                    worldId,
                    error: String(err),
                });
            }
        }
    }
}

function closeWorldPersistenceOnShutdown(worlds: RuntimeWorld[]): void {
    for (const world of worlds) {
        const closeable = world as RuntimeWorld & { closePersistence?: () => void };
        if (typeof closeable.closePersistence === 'function') {
            try {
                closeable.closePersistence();
            } catch (err) {
                const worldId = (world as { id?: string }).id ?? 'unknown';
                log.event('error', 'server.shutdown.close_failed', {
                    worldId,
                    error: String(err),
                });
            }
        }
    }
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
): (label: string, err: string | Error | object | null | undefined) => void {
    const fatalEvents: Record<string, RuntimeEventName> = {
        uncaughtException: SERVER_EVENT_NAMES.FATAL_UNCAUGHT_EXCEPTION,
        unhandledRejection: SERVER_EVENT_NAMES.FATAL_UNHANDLED_REJECTION,
    };

    return function (label, err) {
        const eventName = fatalEvents[label] ?? SERVER_EVENT_NAMES.FATAL_UNKNOWN;
        const resolveObjectTag = (value: object): string => {
            const ctor = (value as { constructor?: { name?: unknown } }).constructor;
            return typeof ctor?.name === 'string' && ctor.name.length > 0 ? `[object ${ctor.name}]` : '[object Object]';
        };
        const safeJson = (value: unknown): string => {
            try {
                const json = JSON.stringify(value);
                return typeof json === 'string' ? json : value !== null && typeof value === 'object' ? resolveObjectTag(value) : String(value);
            } catch {
                return value !== null && typeof value === 'object' ? resolveObjectTag(value) : String(value);
            }
        };
        if (typeof err === 'object' && err !== null && 'stack' in err) {
            const errorRecord: { stack?: unknown; message?: unknown } = err;
            const stackValue: unknown = Reflect.get(errorRecord, 'stack');
            const stack = typeof stackValue === 'string' ? stackValue : safeJson(stackValue);
            const messageValue: unknown = Reflect.get(errorRecord, 'message');
            const message = typeof messageValue === 'string' ? messageValue : safeJson(messageValue ?? err);
            logger.error(label + ': ' + stack);
            emitServerEvent('error', eventName, {
                source: label,
                message: message,
                stack: stack,
            });
        } else {
            const message = typeof err === 'string' ? err : safeJson(err);
            logger.error(label + ': ' + message);
            emitServerEvent('error', eventName, {
                source: label,
                message,
            });
        }
    };
}

function installFatalHandlers(
    processObject: RuntimeProcessLike,
    reportFatal: (label: string, err: string | Error | object | null | undefined) => void
): () => void {
    const uncaughtHandler = function (e: string | Error | object | null | undefined) {
        reportFatal('uncaughtException', e);
    };
    const rejectionHandler = function (reason: string | Error | object | null | undefined) {
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

function installShutdownHandlers(
    processObject: RuntimeProcessLike,
    onShutdown: (signal: 'SIGTERM' | 'SIGINT') => void
): () => void {
    const handlers: Partial<Record<'SIGTERM' | 'SIGINT', () => void>> = {};
    const signals: Array<'SIGTERM' | 'SIGINT'> = ['SIGTERM', 'SIGINT'];

    signals.forEach(function (signal) {
        const handler = function () {
            onShutdown(signal);
        };
        handlers[signal] = handler;
        processObject.on(signal, handler);
    });

    return function () {
        signals.forEach(function (signal) {
            const handler = handlers[signal];
            if (!handler) {
                return;
            }
            if (typeof processObject.off === 'function') {
                processObject.off(signal, handler);
            } else if (typeof processObject.removeListener === 'function') {
                processObject.removeListener(signal, handler);
            }
        });
    };
}

function triggerFatalTestEvent(
    env: RuntimeProcessLike['env'] | undefined,
    setTimeoutFn: MainRuntimeDependencies['setTimeoutFn'],
    reportFatal: (label: string, err: string | Error | object | null | undefined) => void
): void {
    const runtimeEnv = env ?? {};
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

function createRuntimeCleanup(teardownHandlers?: Array<() => void>): () => void {
    const handlers = Array.isArray(teardownHandlers) ? teardownHandlers : [];
    let cleanedUp = false;

    return function () {
        if (cleanedUp) {
            return;
        }
        cleanedUp = true;
        handlers.forEach(function (handler) {
            handler();
        });
    };
}

function main(config: ServerConfig, options?: MainRuntimeOptions): { cleanup: () => void } | undefined {
    const runtimeOptions = options ?? {};
    const validationResult = ConfigPreflight.validateConfig(config);
    const dependencies = createRuntimeDependencies(runtimeOptions.dependencies);
    const logger = dependencies.logger;
    const emitServerEvent = createServerEventEmitter(logger);

    if (!validationResult.isValid) {
        const runtimeValidationErrors = validationResult.errors.map((error) => ({
            field: error.field,
            reason: error.reason,
        }) satisfies Record<string, RuntimeEventFieldValue>);
        emitServerEvent('error', SERVER_EVENT_NAMES.CONFIG_INVALID, {
            errors: runtimeValidationErrors,
        });
        logger.error('Invalid server configuration: ' + JSON.stringify(validationResult.errors));
        dependencies.processObject.exit(1);
        return;
    }

    const Player = dependencies.Player;
    const runtime = createServerAndMetrics(config, emitServerEvent, dependencies);
    const server = runtime.server;
    const metrics = runtime.metrics;
    let worlds: RuntimeWorld[] = [];
    const playerPersistence = new SqlitePlayerPersistence(resolvePlayerPersistencePath(config));

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
        playerDbPath: playerPersistence.databasePath,
    });

    if (typeof server.onRequestProfilePreview === 'function') {
        server.onRequestProfilePreview(function (request: Request) {
            const pathname = parseRequestPathname(request.url);
            if (pathname === '/profile/preview.json') {
                return createProfilePreviewJsonResponse({
                    cookieHeader: request.headers.get('cookie'),
                    profileLookup: playerPersistence,
                });
            }
            return createProfilePreviewResponse({
                cookieHeader: request.headers.get('cookie'),
                profileLookup: playerPersistence,
            });
        });
    }
    if (typeof server.onRequestPasskeyAuth === 'function') {
        server.onRequestPasskeyAuth(function (request: Request) {
            return createPasskeyAuthResponse({
                request,
                persistence: playerPersistence,
            });
        });
    }

    let runtimeReady = config.nb_worlds === 0;

    server.on('connect', function (connection) {
        if (!runtimeReady) {
            connection.close('Server world is still starting up.');
            emitServerEvent('info', SERVER_EVENT_NAMES.CONNECT_REJECTED, {
                reason: 'world_not_ready',
            });
            return;
        }

        const connect = function (world: RuntimeWorld | null | undefined) {
            if (world) {
                if (!isSessionConnection(connection)) {
                    connection.close('Invalid connection runtime shape.');
                    emitServerEvent('error', SERVER_EVENT_NAMES.CONNECT_REJECTED, {
                        reason: 'connection_shape_invalid',
                    });
                    return;
                }
                if (!isSessionWorld(world)) {
                    connection.close('Invalid world session runtime shape.');
                    emitServerEvent('error', SERVER_EVENT_NAMES.CONNECT_REJECTED, {
                        reason: 'world_shape_invalid',
                    });
                    return;
                }
                const player = new Player(connection, world);
                if (!hasSessionPlayerId(player)) {
                    connection.close('Player identity unavailable.');
                    emitServerEvent('error', SERVER_EVENT_NAMES.CONNECT_REJECTED, {
                        reason: 'player_id_missing',
                    });
                    return;
                }
                world.emit('playerConnect', player);
                attachWorldConnectionSession({
                    connection,
                    world,
                    playerId: player.id,
                });
                return;
            }
            connection.close('Server is full.');
            emitServerEvent('info', SERVER_EVENT_NAMES.CONNECT_REJECTED, {
                reason: 'world_capacity_reached',
            });
        };

        const availableWorlds = worlds.filter(function (candidateWorld) {
            return candidateWorld.playerCount < config.nb_players_per_world;
        });
        const world =
            availableWorlds.length === 0
                ? null
                : availableWorlds.reduce(function (minWorld, candidate) {
                      return candidate.playerCount < minWorld.playerCount ? candidate : minWorld;
                  });
        if (world) {
            world.updatePopulation();
        }
        connect(world);
    });

    server.on('error', function (...args: Array<string | Error | object | null | undefined>) {
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
    let readyCount = 0;
    const installStatusEndpoint = (): void => {
        server.onRequestStatus(function () {
            return JSON.stringify(getWorldDistribution(worlds));
        });
    };

    worlds = createWorlds(
        config,
        server,
        dependencies,
        function () {
            readyCount += 1;
            if (readyCount === config.nb_worlds) {
                runtimeReady = true;
                installStatusEndpoint();
            }
        },
        function (world) {
            const worldWithPersistence = world as RuntimeWorld & {
                setPlayerPersistence?: (persistence: SqlitePlayerPersistence) => void;
            };
            worldWithPersistence.setPlayerPersistence?.(playerPersistence);
        }
    );
    installWorldPopulationHooks(worlds, metrics, onPopulationChange);
    // If worlds are already ready (unlikely), ensure /status exists.
    if (config.nb_worlds === 0) {
        runtimeReady = true;
        installStatusEndpoint();
    }

    initializeMetricsPopulation(metrics, onPopulationChange);

    const reportFatal = createFatalReporter(emitServerEvent, logger);
    const cleanupFatalHandlers = installFatalHandlers(dependencies.processObject, reportFatal);
    const baseRuntimeCleanup = createRuntimeCleanup([
        cleanupPopulationCheckTimer,
        cleanupFatalHandlers,
        function () {
            playerPersistence.close();
        },
    ]);
    let hasShutdownStarted = false;
    const cleanupShutdownHandlers = installShutdownHandlers(dependencies.processObject, function (signal) {
        if (hasShutdownStarted) {
            return;
        }
        hasShutdownStarted = true;
        emitServerEvent('info', SERVER_EVENT_NAMES.SHUTDOWN_SIGNAL, { signal });
        logger.info('Received ' + signal + ', shutting down runtime.');

        const closeableServer = server as RuntimeServer & { close?: () => void };
        if (typeof closeableServer.close === 'function') {
            try {
                closeableServer.close();
            } catch (_) {
                // ignore close failures during shutdown
            }
        }

        flushWorldPersistenceOnShutdown(worlds);
        baseRuntimeCleanup();
        closeWorldPersistenceOnShutdown(worlds);
        dependencies.processObject.exit(0);
    });
    const cleanupRuntime = createRuntimeCleanup([baseRuntimeCleanup, cleanupShutdownHandlers]);

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
    installShutdownHandlers,
    triggerFatalTestEvent,
    createRuntimeCleanup,
};
