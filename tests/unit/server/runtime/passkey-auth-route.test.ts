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
        map_filepath: './assets/maps/tiled/map-pack.config.json',
        metrics_enabled: false,
        player_db_path: ':memory:',
    };
}

test('main runtime wires passkey auth handler when websocket server exposes auth route seam', async () => {
    const timerHandle = { id: 'timer' };
    const processObject = {
        env: {},
        on() {
            // no-op
        },
        off() {
            // no-op
        },
        exit() {
            // no-op
            return undefined as never;
        },
    };

    let passkeyAuthHandler: (request: Request) => Promise<Response> = () =>
        Promise.reject(new Error('Passkey auth handler was not installed.'));
    let passkeyHandlerInstalled = false;

    class FakeServer implements RuntimeServer {
        constructor(_port: number) {
            // no-op
        }

        on(_eventName: 'connect', _callback: (connection: RuntimeConnection) => void): void;
        on(
            _eventName: 'error',
            _callback: (...args: Array<string | Error | object | null | undefined>) => void
        ): void;
        on(
            _eventName: 'connect' | 'error',
            _callback:
                | ((connection: RuntimeConnection) => void)
                | ((...args: Array<string | Error | object | null | undefined>) => void)
        ): void {
            // no-op
        }

        onRequestStatus(_callback: () => string): void {
            // no-op
        }

        onRequestPasskeyAuth(callback: (request: Request) => Response | Promise<Response>): void {
            passkeyHandlerInstalled = true;
            passkeyAuthHandler = (request: Request) => Promise.resolve(callback(request));
        }
    }

    class FakeWorld implements RuntimeWorld {
        playerCount = 0;

        constructor(_name: string, _cap: number, _server: RuntimeServer) {
            // no-op
        }

        on(_eventName: 'ready' | 'playerAdded' | 'playerRemoved', callback: () => void): void {
            callback();
        }

        emit(_eventName: 'playerConnect', _player: { id?: string | number }): void {
            // no-op
        }

        run(_path: string): void {
            // no-op
        }

        updatePopulation(_totalPlayers?: number): void {
            // no-op
        }
    }

    class FakePlayer {
        constructor(_connection: RuntimeConnection, _world: RuntimeWorld) {
            // no-op
        }
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

    expect(passkeyHandlerInstalled).toBe(true);

    const response = await passkeyAuthHandler(
        new Request('http://localhost/auth/passkey/register/options', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'alice' }),
        })
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok?: boolean; options?: { challenge?: string } };
    expect(body.ok).toBe(true);
    expect(typeof body.options?.challenge).toBe('string');

    runtime?.cleanup();
});
