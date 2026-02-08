import { expect, test } from 'bun:test';
import type {
    MainRuntimeDependencyOverrides,
    RuntimeConnection,
    RuntimeServer,
    RuntimeWorld,
} from '../../server/js/main-runtime-types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MainRuntime = require('../../server/js/main-runtime');

test('main runtime dependency helper uses injected boundaries when provided', () => {
    class MultiVersionWebsocketServer implements RuntimeServer {
        constructor(_port: number) {}

        onConnect(_callback: (connection: RuntimeConnection) => void): void {}
        onError(_callback: (...args: unknown[]) => void): void {}
        onRequestStatus(_callback: () => string): void {}
    }

    class WorldServer implements RuntimeWorld {
        playerCount = 0;

        constructor(_id: string, _capacity: number, _server: RuntimeServer) {}

        connect_callback(_player: unknown): void {}
        run(_mapFilePath: string): void {}
        updatePopulation(_totalPlayers?: number): void {}
        onPlayerAdded(_callback: () => void): void {}
        onPlayerRemoved(_callback: () => void): void {}
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
