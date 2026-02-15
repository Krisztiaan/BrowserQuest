import { expect, test } from 'bun:test';
import WorldServer from '../../../server/world-server';
import Player from '../../../server/player';

function createWorld(): WorldServer {
    const server = {
        getConnection() {
            return undefined;
        },
    };
    return new WorldServer('world-runtime-simplify', 2000, server as never);
}

function createPlayer(wireId: string): Player {
    const connection = {
        id: wireId,
        listen() {},
        onClose() {},
        send() {},
        sendUTF8() {},
        close() {},
    };
    const player = new Player(connection as never, null);
    player.name = 'player-' + wireId;
    player.accountNameKey = player.name;
    player.setPosition(1, 1);
    return player;
}

test('WorldServer.addPlayer syncs spawn replication once through addEntity', () => {
    const world = createWorld();
    const player = createPlayer('25101');

    let spawnSyncCalls = 0;
    const originalSyncSpawn = world.ecsPipeline.syncSpawnReplicationEntity.bind(world.ecsPipeline);
    world.ecsPipeline.syncSpawnReplicationEntity = ((...args: Parameters<typeof originalSyncSpawn>) => {
        spawnSyncCalls += 1;
        return originalSyncSpawn(...args);
    }) as typeof world.ecsPipeline.syncSpawnReplicationEntity;

    world.addPlayer(player);

    expect(spawnSyncCalls).toBe(1);
});

test('WorldServer.removePlayer removes ecs entity exactly once', () => {
    const world = createWorld();
    const player = createPlayer('25102');
    world.addPlayer(player);

    let removeEntityCalls = 0;
    const originalRemove = world.ecsPipeline.removeEntity.bind(world.ecsPipeline);
    world.ecsPipeline.removeEntity = ((...args: Parameters<typeof originalRemove>) => {
        removeEntityCalls += 1;
        return originalRemove(...args);
    }) as typeof world.ecsPipeline.removeEntity;

    world.removePlayer(player);

    expect(removeEntityCalls).toBe(1);
});
