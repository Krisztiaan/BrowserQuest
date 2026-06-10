import { expect, test } from 'bun:test';
import WorldServer from '../../../server/world-server';
import Player from '../../../server/player';
import Types from '../../../shared/gametypes-browser';
import { gridPos } from '../../../shared/domain/positions';
import { entityIdGeneration, entityIdIndex } from '../../../shared/domain/ids';

function createWorld(): WorldServer {
    const server = {
        getConnection() {
            return undefined;
        },
    };
    return new WorldServer('world-runtime-simplify', 2000, server);
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
    const player = new Player(connection, null);
    player.name = 'player-' + wireId;
    player.accountNameKey = player.name;
    player.setPosition(1, 1);
    return player;
}

test('WorldServer.addPlayer syncs spawn replication once through addEntity', () => {
    const world = createWorld();
    const player = createPlayer('25101');

    let spawnSyncCalls = 0;
    const originalSyncSpawn = world.ecsPipeline.syncSpawnReplicationEntity.bind(
        world.ecsPipeline
    ) as typeof world.ecsPipeline.syncSpawnReplicationEntity;
    world.ecsPipeline.syncSpawnReplicationEntity = ((...args: Parameters<typeof originalSyncSpawn>) => {
        spawnSyncCalls += 1;
        originalSyncSpawn(...args);
    });

    world.addPlayer(player);

    expect(spawnSyncCalls).toBe(1);
});

test('WorldServer.removePlayer removes ecs entity exactly once', () => {
    const world = createWorld();
    const player = createPlayer('25102');
    world.addPlayer(player);

    let removeEntityCalls = 0;
    const originalRemove = world.ecsPipeline.removeEntity.bind(world.ecsPipeline) as typeof world.ecsPipeline.removeEntity;
    world.ecsPipeline.removeEntity = ((...args: Parameters<typeof originalRemove>) => {
        removeEntityCalls += 1;
        originalRemove(...args);
    });

    world.removePlayer(player);

    expect(removeEntityCalls).toBe(1);
});

test('WorldServer.scheduleMobRespawn allocates fresh id when stale generation id was reused', () => {
    const world = createWorld();

    const staleMobId = world.ecsPipeline.state.world.createEntity();
    world.ecsPipeline.removeEntity(staleMobId);

    const occupiedId = world.ecsPipeline.state.world.createEntity();
    expect(entityIdIndex(occupiedId)).toBe(entityIdIndex(staleMobId));
    expect(entityIdGeneration(occupiedId)).not.toBe(entityIdGeneration(staleMobId));

    const originalScheduleStaticRespawn = world.ecsPipeline.scheduleStaticRespawn.bind(
        world.ecsPipeline
    ) as typeof world.ecsPipeline.scheduleStaticRespawn;
    world.ecsPipeline.scheduleStaticRespawn = ((entity) => {
        entity.emit('respawn');
    });

    const aliveBefore = world.ecsPipeline.state.world.entities.aliveCount;
    world.scheduleMobRespawn({
        mobId: staleMobId,
        kind: Types.Entities.RAT,
        spawn: gridPos(8, 9),
        delaySeconds: 0,
    });

    expect(world.ecsPipeline.state.world.entities.aliveCount).toBe(aliveBefore + 1);

    world.ecsPipeline.scheduleStaticRespawn = originalScheduleStaticRespawn;
});
