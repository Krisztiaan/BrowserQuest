import { expect, test } from 'bun:test';
import type {
    MainRuntimeDependencyOverrides,
    RuntimeConnection,
    RuntimeServer,
    RuntimeWorld,
} from '../../../../server/main-runtime-types';
import * as MainRuntimeModule from '../../../../server/main-runtime';

const MainRuntime = MainRuntimeModule as any;

test('main runtime dependency helper uses injected boundaries when provided', () => {
    class MultiVersionWebsocketServer implements RuntimeServer {
        constructor(_port: number) {}

        on(_eventName: 'connect', _callback: (connection: RuntimeConnection) => void): void;
        on(_eventName: 'error', _callback: (...args: unknown[]) => void): void;
        on(
            _eventName: 'connect' | 'error',
            _callback: ((...args: unknown[]) => void) | ((connection: RuntimeConnection) => void)
        ): void {}
        onRequestStatus(_callback: () => string): void {}
    }

    class WorldServer implements RuntimeWorld {
        playerCount = 0;

        constructor(_id: string, _capacity: number, _server: RuntimeServer) {}

        on(_eventName: 'playerAdded' | 'playerRemoved', _callback: () => void): void {}
        emit(_eventName: 'playerConnect', _player: unknown): void {}
        run(_mapFilePath: string): void {}
        updatePopulation(_totalPlayers?: number): void {}
    }

    class Player {
        constructor(_connection: RuntimeConnection, _world: RuntimeWorld) {}
    }

    const ws = { MultiVersionWebsocketServer };

    const overrides: MainRuntimeDependencyOverrides = {
        ws,
        WorldServer,
        Player,
    };
    const dependencies = MainRuntime.createRuntimeDependencies(overrides);

    expect(dependencies.ws).toBe(ws);
    expect(dependencies.WorldServer).toBe(WorldServer);
    expect(dependencies.Player).toBe(Player);
});

test('main runtime dependency helper defaults ws boundary to modern ESM runtime module', () => {
    const dependencies = MainRuntime.createRuntimeDependencies({
        WorldServer: function WorldServer() {},
        Player: function Player() {},
    });

    expect(typeof dependencies.ws.MultiVersionWebsocketServer).toBe('function');
});
