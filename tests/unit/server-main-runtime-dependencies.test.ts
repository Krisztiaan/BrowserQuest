import { expect, test } from 'bun:test';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MainRuntime = require('../../server/js/main-runtime');

test('main runtime dependency helper uses injected boundaries when provided', () => {
    const ws = { MultiVersionWebsocketServer: function MultiVersionWebsocketServer() {} };
    const WorldServer = function WorldServer() {};
    const Player = function Player() {};

    const dependencies = MainRuntime.createRuntimeDependencies({
        ws,
        WorldServer,
        Player,
    });

    expect(dependencies.ws).toBe(ws);
    expect(dependencies.WorldServer).toBe(WorldServer);
    expect(dependencies.Player).toBe(Player);
});
