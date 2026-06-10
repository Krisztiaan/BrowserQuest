import { expect, test } from 'bun:test';
import * as MainRuntimeModule from '../../../../server/runtime';
import type {
    RuntimeConnection,
    RuntimeEventFields,
    RuntimeMetrics,
    RuntimePlayer,
    RuntimeProcessLike,
    RuntimeServer,
    RuntimeWorld,
} from '../../../../server/runtime-types';

const MainRuntime = MainRuntimeModule;
type RuntimeErrorArg = string | Error | object | null | undefined;

function createValidConfig() {
    return {
        port: 8000,
        debug_level: 'info',
        nb_players_per_world: 200,
        nb_worlds: 1,
        map_filepath: './assets/maps/tiled/map-pack.config.json',
        metrics_enabled: false,
    } as const;
}

function createDisabledMetrics(): RuntimeMetrics {
    return {
        isEnabled: false,
        isReady: false,
        ready() {
            // no-op
        },
        getTotalPlayers() {
            // no-op
        },
        updatePlayerCounters() {
            // no-op
        },
        updateWorldDistribution() {
            // no-op
        },
    };
}

class FakeServer implements RuntimeServer {
    readonly #onConnect: (callback: (connection: RuntimeConnection) => void) => void;

    constructor(_port: number, onConnect: (callback: (connection: RuntimeConnection) => void) => void = () => {}) {
        this.#onConnect = onConnect;
    }

    on(eventName: 'connect', callback: (connection: RuntimeConnection) => void): void;
    on(eventName: 'error', callback: (...args: RuntimeErrorArg[]) => void): void;
    on(
        eventName: 'connect' | 'error',
        callback: ((connection: RuntimeConnection) => void) | ((...args: RuntimeErrorArg[]) => void)
    ): void {
        if (eventName === 'connect') {
            this.#onConnect(callback);
        }
    }

    onRequestStatus(_callback: () => string): void {
        // no-op
    }
}

class FakePlayer implements RuntimePlayer {
    id = 1 as RuntimePlayer['id'];

    constructor(_connection: RuntimeConnection, _world: RuntimeWorld) {}
}

test('main runtime exposes lifecycle cleanup handle and onLifecycle receives same cleanup contract', () => {
    const timerHandle = { id: 'timer' };
    const cleared: Array<{ id: string }> = [];
    const removedEvents: string[] = [];
    const processHandlers: Record<string, (...args: RuntimeErrorArg[]) => void> = {};
    const processObject: RuntimeProcessLike = {
        env: {},
        on(eventName, handler) {
            processHandlers[eventName] = handler;
        },
        off(eventName) {
            removedEvents.push(eventName);
            delete processHandlers[eventName];
        },
        exit() {
            throw new Error('process exit');
        },
    };

    class CleanupFakeWorld implements RuntimeWorld {
        playerCount = 0;

        on(_eventName: 'ready' | 'playerAdded' | 'playerRemoved', _callback: () => void): void {
            // no-op
        }
        emit(_eventName: 'playerConnect', _player: RuntimePlayer): void {
            // no-op
        }
        run(_mapFilePath: string): void {
            // no-op
        }
        updatePopulation(_totalPlayers?: number): void {
            // no-op
        }
    }

    const lifecyclePayloads: Array<{ cleanup: () => void }> = [];
    const runtime = MainRuntime.main(createValidConfig(), {
        dependencies: {
            ws: { MultiVersionWebsocketServer: class extends FakeServer {} },
            WorldServer: CleanupFakeWorld,
            Player: FakePlayer,
            metricsRuntime: {
                createMetrics() {
                    return createDisabledMetrics();
                },
            },
            logger: {
                info() {
                    // no-op
                },
                error() {
                    // no-op
                },
                event() {
                    // no-op
                },
            },
            processObject,
            setIntervalFn() {
                return timerHandle;
            },
            clearIntervalFn(handle) {
                cleared.push(handle as { id: string });
            },
            setTimeoutFn() {
                return { id: 'timeout' };
            },
        },
        onLifecycle(payload: { cleanup: () => void }) {
            lifecyclePayloads.push(payload);
        },
    });

    expect(typeof runtime.cleanup).toBe('function');
    expect(lifecyclePayloads.length).toBe(1);
    expect(lifecyclePayloads[0]?.cleanup).toBe(runtime.cleanup);
    expect(typeof processHandlers.uncaughtException).toBe('function');
    expect(typeof processHandlers.unhandledRejection).toBe('function');
    expect(typeof processHandlers.SIGTERM).toBe('function');
    expect(typeof processHandlers.SIGINT).toBe('function');

    runtime.cleanup();
    runtime.cleanup();

    expect(cleared).toEqual([timerHandle]);
    expect(removedEvents).toEqual(['uncaughtException', 'unhandledRejection', 'SIGTERM', 'SIGINT']);
});

test('main runtime rejects connects until world ready, then accepts new sessions', () => {
    const timerHandle = { id: 'timer' };
    const processHandlers: Record<string, (...args: RuntimeErrorArg[]) => void> = {};
    const connectCloseReasons: string[] = [];
    const connectedPlayers: RuntimePlayer[] = [];
    const emittedEvents: Array<{ eventName: string; fields: RuntimeEventFields }> = [];
    const handshakeFrames: string[] = [];
    let connectHandler: ((connection: RuntimeConnection) => void) | null = null;
    let worldReadyHandler: (() => void) | null = null;

    const processObject: RuntimeProcessLike = {
        env: {},
        on(eventName, handler) {
            processHandlers[eventName] = handler;
        },
        off(eventName) {
            delete processHandlers[eventName];
        },
        exit() {
            throw new Error('process exit');
        },
    };

    class ConnectFakeServer extends FakeServer {
        constructor(port: number) {
            super(port, (callback) => {
                connectHandler = callback;
            });
        }
    }

    class ConnectFakeWorld implements RuntimeWorld {
        playerCount = 0;

        on(eventName: 'ready' | 'playerAdded' | 'playerRemoved', callback: () => void): void {
            if (eventName === 'ready') {
                worldReadyHandler = callback;
            }
        }
        emit(_eventName: 'playerConnect', player: RuntimePlayer): void {
            connectedPlayers.push(player);
        }
        run(_mapFilePath: string): void {
            // no-op
        }
        updatePopulation(_totalPlayers?: number): void {
            // no-op
        }
        isPlayerActive(_playerId: RuntimePlayer['id']): boolean {
            return true;
        }
        enqueueCommand(_command: object): void {
            // no-op
        }
        getConnectionPlayerById(_playerId: RuntimePlayer['id']): {
            isDead?: boolean;
            firepotionTimeout?: ReturnType<typeof setTimeout> | null;
            emit(eventName: 'exit'): void;
        } | null {
            return {
                emit(_eventName: 'exit') {
                    // no-op
                },
            };
        }
    }

    const runtime = MainRuntime.main(createValidConfig(), {
        dependencies: {
            ws: { MultiVersionWebsocketServer: ConnectFakeServer },
            WorldServer: ConnectFakeWorld,
            Player: FakePlayer,
            metricsRuntime: {
                createMetrics() {
                    return createDisabledMetrics();
                },
            },
            logger: {
                info() {
                    // no-op
                },
                error() {
                    // no-op
                },
                event(_level: string, eventName: string, fields: RuntimeEventFields) {
                    emittedEvents.push({ eventName, fields });
                },
            },
            processObject,
            setIntervalFn() {
                return timerHandle;
            },
            clearIntervalFn() {
                // no-op
            },
            setTimeoutFn() {
                return { id: 'timeout' };
            },
        },
    });

    expect(runtime).toBeDefined();
    expect(typeof connectHandler).toBe('function');
    expect(typeof worldReadyHandler).toBe('function');

    connectHandler?.({
        close(reason: string) {
            connectCloseReasons.push(reason);
        },
    });

    expect(connectCloseReasons).toEqual(['Server world is still starting up.']);
    expect(connectedPlayers.length).toBe(0);
    expect(
        emittedEvents.some(
            (entry) => entry.eventName === 'server.connect.rejected' && entry.fields.reason === 'world_not_ready'
        )
    ).toBe(true);

    worldReadyHandler?.();

    connectHandler?.({
        id: 'conn-1',
        close() {
            // no-op
        },
        listen() {
            // no-op
        },
        onClose() {
            // no-op
        },
        sendUTF8(payload: string) {
            handshakeFrames.push(payload);
        },
    });

    expect(connectedPlayers.length).toBe(1);
    expect(handshakeFrames).toEqual(['go']);

    runtime.cleanup();
});
