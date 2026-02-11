import { expect, test } from 'bun:test';
import * as MainRuntimeModule from '../../../../server/runtime';

const MainRuntime = MainRuntimeModule as any;

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
