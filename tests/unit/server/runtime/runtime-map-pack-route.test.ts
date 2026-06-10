import { expect, test } from 'bun:test';
import * as MainRuntimeModule from '../../../../server/runtime';
import type { RuntimeConnection, RuntimeServer, RuntimeWorld } from '../../../../server/runtime-types';

const MainRuntime = MainRuntimeModule;

function createValidConfig() {
    return {
        port: 8000,
        debug_level: 'info' as const,
        nb_players_per_world: 200,
        nb_worlds: 1,
        map_filepath: './assets/maps/tiled/world.json',
        metrics_enabled: false,
        player_db_path: ':memory:',
    };
}

test('main runtime serves compiled runtime map payload from authored world.json', async () => {
    const timerHandle = { id: 'timer' };
    const processObject = {
        env: {},
        on() {},
        off() {},
        exit() {
            return undefined as never;
        },
    };

    const runtimeMapPackHandlerRef: { current: ((request: Request) => Response | Promise<Response>) | null } = {
        current: null,
    };

    class FakeServer implements RuntimeServer {
        constructor(_port: number) {}

        on(_eventName: 'connect', _callback: (connection: RuntimeConnection) => void): void;
        on(_eventName: 'error', _callback: (...args: Array<string | Error | object | null | undefined>) => void): void;
        on(
            _eventName: 'connect' | 'error',
            _callback:
                | ((connection: RuntimeConnection) => void)
                | ((...args: Array<string | Error | object | null | undefined>) => void)
        ): void {
            // no-op
        }

        onRequestStatus(_callback: () => string): void {}

        onRequestRuntimeMapPack(callback: (request: Request) => Response | Promise<Response>): void {
            runtimeMapPackHandlerRef.current = callback;
        }
    }

    class FakeWorld implements RuntimeWorld {
        playerCount = 0;

        constructor(_name: string, _cap: number, _server: RuntimeServer) {}

        on(_eventName: 'ready' | 'playerAdded' | 'playerRemoved', callback: () => void): void {
            callback();
        }

        emit(_eventName: 'playerConnect', _player: { id?: string | number }): void {}

        run(_path: string): void {}

        updatePopulation(_totalPlayers?: number): void {}
    }

    class FakePlayer {
        constructor(_connection: RuntimeConnection, _world: RuntimeWorld) {}
    }

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
                        ready() {},
                        getTotalPlayers() {},
                        updatePlayerCounters() {},
                        updateWorldDistribution() {},
                    };
                },
            },
            logger: {
                info() {},
                error() {},
                event() {},
            },
            processObject,
            setIntervalFn() {
                return timerHandle;
            },
            clearIntervalFn() {},
            setTimeoutFn() {},
        },
    });

    const handler = runtimeMapPackHandlerRef.current;
    expect(handler).not.toBeNull();
    if (!handler) {
        throw new Error('runtime map pack handler was not registered');
    }
    const response = await handler(new Request('http://localhost/assets/maps/runtime/map-pack.json'));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');

    const payload = (await response.json()) as {
        schemaVersion?: number;
        maps?: Array<{ id?: string; client?: object; server?: object }>;
    };
    expect(payload.schemaVersion).toBe(2);
    expect(payload.maps?.some((map) => map.id === 'world_01')).toBe(true);

    runtime?.cleanup();
});
