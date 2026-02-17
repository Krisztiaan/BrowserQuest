import { expect, test } from 'bun:test';
import * as MainRuntimeModule from '../../../../server/runtime';
import type {
    RuntimeConnection,
    RuntimeMetrics,
    RuntimeServer,
    RuntimeServerEventEmitter,
    RuntimeWorld,
    ServerConfig,
} from '../../../../server/runtime-types';

const MainRuntime = MainRuntimeModule;

function createValidConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
    return {
        port: 8123,
        debug_level: 'info',
        nb_players_per_world: 50,
        nb_worlds: 2,
        map_filepath: 'maps/world.json',
        metrics_enabled: false,
        ...overrides,
    };
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

class FakePlayer {
    id = 'player-1';
    constructor(_connection: RuntimeConnection, _world: RuntimeWorld) {}
}

test('main runtime createServerAndMetrics builds server and metrics via dependency seam', () => {
    const calls: {
        port?: number;
        metricsConfig?: ServerConfig;
        metricsEmit?: RuntimeServerEventEmitter;
    } = {};

    class FakeServer implements RuntimeServer {
        readonly port: number;

        constructor(port: number) {
            this.port = port;
            calls.port = port;
        }

        on(_eventName: 'connect' | 'error', _callback: (...args: never[]) => void): void {
            // no-op
        }
        onRequestStatus(_callback: () => string): void {
            // no-op
        }
    }

    const fakeMetrics: RuntimeMetrics = createDisabledMetrics();
    const dependencies = MainRuntime.createRuntimeDependencies({
        ws: { MultiVersionWebsocketServer: FakeServer },
        metricsRuntime: {
            createMetrics(config: ServerConfig, emitServerEvent: RuntimeServerEventEmitter) {
                calls.metricsConfig = config;
                calls.metricsEmit = emitServerEvent;
                return fakeMetrics;
            },
        },
        WorldServer: class implements RuntimeWorld {
            playerCount = 0;
            constructor(_name: string, _capacity: number, _server: RuntimeServer) {}
            on(_eventName: 'ready' | 'playerAdded' | 'playerRemoved', _callback: () => void): void {}
            emit(_eventName: 'playerConnect', _player: FakePlayer): void {}
            run(_mapFilePath: string): void {}
            updatePopulation(_totalPlayers?: number): void {}
        },
        Player: FakePlayer,
    });
    const config = createValidConfig({ nb_worlds: 1, nb_players_per_world: 10 });
    const emitServerEvent: RuntimeServerEventEmitter = () => {
        // no-op
    };

    const runtime = MainRuntime.createServerAndMetrics(config, emitServerEvent, dependencies);

    expect(calls.port).toBe(8123);
    expect(calls.metricsConfig).toBe(config);
    expect(calls.metricsEmit).toBe(emitServerEvent);
    expect(runtime.metrics).toBe(fakeMetrics);
});

test('main runtime createWorlds assembles worlds and runs configured map path', () => {
    const created: Array<{ name: string; capacity: number; server: RuntimeServer; world: FakeWorldServer | null }> = [];
    const receivedConfigs: ServerConfig[] = [];
    let onPlayerAddedCount = 0;
    let onPlayerRemovedCount = 0;

    class FakeWorldServer implements RuntimeWorld {
        readonly name: string;
        runPath: string | null = null;
        playerCount = 0;

        constructor(name: string, capacity: number, server: RuntimeServer) {
            this.name = name;
            created.push({ name, capacity, server, world: this });
        }

        on(eventName: 'ready' | 'playerAdded' | 'playerRemoved', _callback: () => void): void {
            if (eventName === 'playerAdded') {
                onPlayerAddedCount += 1;
                return;
            }
            if (eventName === 'playerRemoved') {
                onPlayerRemovedCount += 1;
            }
        }

        emit(_eventName: 'playerConnect', _player: FakePlayer): void {
            // no-op
        }

        run(path: string): void {
            this.runPath = path;
        }

        updatePopulation(_totalPlayers?: number): void {
            // no-op
        }

        setServerConfig(config: ServerConfig): void {
            receivedConfigs.push(config);
        }
    }

    const dependencies = MainRuntime.createRuntimeDependencies({
        WorldServer: FakeWorldServer,
        Player: FakePlayer,
        metricsRuntime: {
            createMetrics() {
                return createDisabledMetrics();
            },
        },
    });
    const config = createValidConfig({ nb_worlds: 2, nb_players_per_world: 50, map_filepath: 'maps/world.json' });
    const worlds = MainRuntime.createWorlds(config, new (class implements RuntimeServer {
        on(_eventName: 'connect' | 'error', _callback: (...args: never[]) => void): void {}
        onRequestStatus(_callback: () => string): void {}
    })(), dependencies);

    expect(worlds.length).toBe(2);
    expect(created.map((entry) => entry.name)).toEqual(['world1', 'world2']);
    expect(created.map((entry) => entry.capacity)).toEqual([50, 50]);
    expect(created[0]?.world?.runPath).toBe('maps/world.json');
    expect(created[1]?.world?.runPath).toBe('maps/world.json');
    expect(receivedConfigs).toEqual([config, config]);
    expect(onPlayerAddedCount).toBe(0);
    expect(onPlayerRemovedCount).toBe(0);
});
