import { expect, test } from 'bun:test';
import * as MainRuntimeModule from '../../server/js/main-runtime';

const MainRuntime = MainRuntimeModule as any;

test('main runtime createServerAndMetrics builds server and metrics via dependency seam', () => {
    const calls: { port?: number; metricsConfig?: unknown; metricsEmit?: unknown } = {};
    const FakeServer = function FakeServer(this: { port: number }, port: number) {
        this.port = port;
        calls.port = port;
    } as unknown as {
        new (port: number): { port: number };
    };
    const fakeMetrics = { isEnabled: false };
    const fakeMetricsRuntime = {
        createMetrics(config: unknown, emitServerEvent: unknown) {
            calls.metricsConfig = config;
            calls.metricsEmit = emitServerEvent;
            return fakeMetrics;
        },
    };
    const dependencies = MainRuntime.createRuntimeDependencies({
        ws: { MultiVersionWebsocketServer: FakeServer },
        metricsRuntime: fakeMetricsRuntime,
        WorldServer: function WorldServer() {},
        Player: function Player() {},
    });
    const config = { port: 8123 };
    const emitServerEvent = () => {
        // no-op
    };

    const runtime = MainRuntime.createServerAndMetrics(config, emitServerEvent, dependencies);

    expect(calls.port).toBe(8123);
    expect(calls.metricsConfig).toBe(config);
    expect(calls.metricsEmit).toBe(emitServerEvent);
    expect(runtime.metrics).toBe(fakeMetrics);
});

test('main runtime createWorlds assembles worlds and runs configured map path', () => {
    const created: Array<{ name: string; capacity: number; server: unknown }> = [];
    let onPlayerAddedCount = 0;
    let onPlayerRemovedCount = 0;
    const FakeWorldServer = function FakeWorldServer(
        this: {
            name: string;
            runPath: string | null;
            run: (path: string) => void;
            onPlayerAdded: (callback: () => void) => void;
            onPlayerRemoved: (callback: () => void) => void;
        },
        name: string,
        capacity: number,
        server: unknown
    ) {
        this.name = name;
        this.runPath = null;
        created.push({ name, capacity, server });
        this.run = (path: string) => {
            this.runPath = path;
        };
        this.onPlayerAdded = () => {
            onPlayerAddedCount += 1;
        };
        this.onPlayerRemoved = () => {
            onPlayerRemovedCount += 1;
        };
    } as unknown as {
        new (
            name: string,
            capacity: number,
            server: unknown
        ): {
            name: string;
            runPath: string | null;
            run: (path: string) => void;
            onPlayerAdded: (callback: () => void) => void;
            onPlayerRemoved: (callback: () => void) => void;
        };
    };
    const dependencies = MainRuntime.createRuntimeDependencies({
        ws: { MultiVersionWebsocketServer: function MultiVersionWebsocketServer() {} },
        metricsRuntime: { createMetrics() {} },
        WorldServer: FakeWorldServer,
        Player: function Player() {},
    });
    const config = {
        nb_worlds: 2,
        nb_players_per_world: 50,
        map_filepath: 'maps/world.json',
    };
    const worlds = MainRuntime.createWorlds(config, { id: 'server' }, dependencies);

    expect(worlds.length).toBe(2);
    expect(created.map((entry) => entry.name)).toEqual(['world1', 'world2']);
    expect(created.map((entry) => entry.capacity)).toEqual([50, 50]);
    expect(worlds[0].runPath).toBe('maps/world.json');
    expect(worlds[1].runPath).toBe('maps/world.json');
    expect(onPlayerAddedCount).toBe(0);
    expect(onPlayerRemovedCount).toBe(0);
});
