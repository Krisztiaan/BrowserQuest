import { expect, test } from 'bun:test';
import * as MainRuntimeModule from '../../../../server/runtime';

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

    let passkeyAuthHandler: ((request: Request) => Response | Promise<Response>) | null = null;

    const FakeServer = function FakeServer(this: {
        on: (eventName: 'connect' | 'error', callback: (...args: unknown[]) => void) => void;
        onRequestStatus: (callback: () => string) => void;
        onRequestPasskeyAuth: (callback: (request: Request) => Response | Promise<Response>) => void;
    }) {
        this.on = () => {
            // no-op
        };
        this.onRequestStatus = () => {
            // no-op
        };
        this.onRequestPasskeyAuth = (callback) => {
            passkeyAuthHandler = callback;
        };
    } as unknown as {
        new (port: number): {
            on: (eventName: 'connect' | 'error', callback: (...args: unknown[]) => void) => void;
            onRequestStatus: (callback: () => string) => void;
            onRequestPasskeyAuth: (callback: (request: Request) => Response | Promise<Response>) => void;
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
        this.on = (_eventName, callback) => {
            callback();
        };
        this.emit = () => {
            // no-op
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
                        ready() {},
                        getTotalPlayers() {},
                        getOpenWorldCount() {},
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

    expect(typeof passkeyAuthHandler).toBe('function');

    const response = await passkeyAuthHandler!(
        new Request('http://localhost/auth/passkey/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'alice', credentialId: 'cred-runtime' }),
        })
    );

    expect(response.status).toBe(200);
    const setCookie = response.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('bq_session=');
    expect(setCookie).toContain('bq_account=alice');

    runtime?.cleanup();
});
