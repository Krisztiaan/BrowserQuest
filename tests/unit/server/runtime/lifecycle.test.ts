import { expect, test } from 'bun:test';
import * as MainRuntimeModule from '../../../../server/runtime';

const MainRuntime = MainRuntimeModule;

function createValidConfig() {
    return {
        port: 8000,
        debug_level: 'info',
        nb_players_per_world: 200,
        nb_worlds: 1,
        map_filepath: './assets/maps/tiled/world.json',
        metrics_enabled: false,
    };
}

test('main runtime exposes lifecycle cleanup handle and onLifecycle receives same cleanup contract', () => {
    const timerHandle = { id: 'timer' };
    const cleared: unknown[] = [];
    const removedEvents: string[] = [];
    const processHandlers: Record<string, (value: unknown) => void> = {};
    const processObject = {
        env: {},
        on(eventName: string, handler: (value: unknown) => void) {
            processHandlers[eventName] = handler;
        },
        off(eventName: string) {
            removedEvents.push(eventName);
            delete processHandlers[eventName];
        },
        exit() {
            // no-op
        },
    };
    const FakeServer = function FakeServer(this: {
        on: (eventName: 'connect' | 'error', callback: unknown) => void;
        onRequestStatus: (callback: unknown) => void;
    }) {
        this.on = () => {
            // no-op
        };
        this.onRequestStatus = () => {
            // no-op
        };
    } as unknown as {
        new (port: number): {
            on: (eventName: 'connect' | 'error', callback: unknown) => void;
            onRequestStatus: (callback: unknown) => void;
        };
    };
    const FakeWorld = function FakeWorld(this: { run: (path: string) => void }) {
        this.run = () => {
            // no-op
        };
    } as unknown as {
        new (name: string, cap: number, server: unknown): { run: (path: string) => void };
    };
    const lifecyclePayloads: Array<{ cleanup: () => void }> = [];
    const runtime = MainRuntime.main(createValidConfig(), {
        dependencies: {
            ws: { MultiVersionWebsocketServer: FakeServer },
            WorldServer: FakeWorld,
            Player: function Player() {},
            metricsRuntime: {
                createMetrics() {
                    return {
                        isEnabled: false,
                        isReady: false,
                    };
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
            clearIntervalFn(handle: unknown) {
                cleared.push(handle);
            },
            setTimeoutFn() {
                // no-op
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
    const processHandlers: Record<string, (...args: unknown[]) => void> = {};
    const connectCloseReasons: string[] = [];
    const connectedPlayers: unknown[] = [];
    const emittedEvents: Array<{ eventName: string; fields: Record<string, unknown> }> = [];
    const handshakeFrames: string[] = [];
    let connectHandler: ((connection: unknown) => void) | null = null;
    let worldReadyHandler: (() => void) | null = null;

    const processObject = {
        env: {},
        on(eventName: string, handler: (...args: unknown[]) => void) {
            processHandlers[eventName] = handler;
        },
        off(eventName: string) {
            delete processHandlers[eventName];
        },
        exit() {
            // no-op
        },
    };

    const FakeServer = function FakeServer(this: {
        on: (eventName: 'connect' | 'error', callback: (...args: unknown[]) => void) => void;
        onRequestStatus: (callback: unknown) => void;
    }) {
        this.on = (eventName, callback) => {
            if (eventName === 'connect') {
                connectHandler = callback as unknown as (connection: unknown) => void;
            }
        };
        this.onRequestStatus = () => {
            // no-op
        };
    } as unknown as {
        new (port: number): {
            on: (eventName: 'connect' | 'error', callback: (...args: unknown[]) => void) => void;
            onRequestStatus: (callback: unknown) => void;
        };
    };

    const FakeWorld = function FakeWorld(
        this: {
            playerCount: number;
            on: (eventName: 'ready' | 'playerAdded' | 'playerRemoved', callback: () => void) => void;
            emit: (eventName: 'playerConnect', player: unknown) => void;
            run: (path: string) => void;
            updatePopulation: (totalPlayers?: number) => void;
        }
    ) {
        this.playerCount = 0;
        this.on = (eventName, callback) => {
            if (eventName === 'ready') {
                worldReadyHandler = callback;
            }
        };
        this.emit = (eventName, player) => {
            if (eventName === 'playerConnect') {
                connectedPlayers.push(player);
            }
        };
        this.run = () => {
            // no-op
        };
        this.updatePopulation = () => {
            // no-op
        };
    } as unknown as {
        new (name: string, cap: number, server: unknown): {
            playerCount: number;
            on: (eventName: 'ready' | 'playerAdded' | 'playerRemoved', callback: () => void) => void;
            emit: (eventName: 'playerConnect', player: unknown) => void;
            run: (path: string) => void;
            updatePopulation: (totalPlayers?: number) => void;
        };
    };

    const FakePlayer = function FakePlayer(this: { id: string }) {
        this.id = 'player-1';
    } as unknown as { new (connection: unknown, world: unknown): { id: string } };

    const runtime = MainRuntime.main(createValidConfig(), {
        dependencies: {
            ws: { MultiVersionWebsocketServer: FakeServer },
            WorldServer: FakeWorld,
            Player: FakePlayer,
            metricsRuntime: {
                createMetrics() {
                    return {
                        isEnabled: false,
                        isReady: false,
                        ready() {
                            // no-op
                        },
                        getTotalPlayers() {
                            // no-op
                        },
                        getOpenWorldCount() {
                            // no-op
                        },
                        updatePlayerCounters() {
                            // no-op
                        },
                        updateWorldDistribution() {
                            // no-op
                        },
                    };
                },
            },
            logger: {
                info() {
                    // no-op
                },
                error() {
                    // no-op
                },
                event(_level: string, eventName: string, fields: Record<string, unknown>) {
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
                // no-op
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
            (entry) =>
                entry.eventName === 'server.connect.rejected' && entry.fields.reason === 'world_not_ready'
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

    runtime?.cleanup();
});
