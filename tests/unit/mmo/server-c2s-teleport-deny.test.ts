import { expect, test } from 'bun:test';
import Types from '../../../shared/gametypes-browser';
import Player from '../../../server/player';
import { gridPos } from '../../../shared/domain/positions';
import { WorldEcsCommandPipeline } from '../../../server/world/ecs-command-pipeline';
import type { WorldMessage } from '../../../server/world/contracts';

function createTestPlayer(wireId: number): Player {
    const connection = {
        id: String(wireId),
        listen() {},
        onClose() {},
        send() {},
        sendUTF8() {},
        close() {},
    };
    const player = new Player(connection as never, null);
    player.resetHitPoints(100);
    player.isDead = false;
    player.setPosition(0, 0);
    return player;
}

function createPipelineFixture(params: {
    player: Player;
    isDoor: (x: number, y: number) => boolean;
    getDoorDestination: (x: number, y: number) => { x: number; y: number } | null;
}): { pipeline: WorldEcsCommandPipeline; delivered: WorldMessage[] } {
    const { player, isDoor, getDoorDestination } = params;
    const delivered: WorldMessage[] = [];

    const host = {
        ups: 50,
        map: {
            getCheckpoint() {
                return null;
            },
            isDoor,
            getDoorDestination,
            getGroupIdFromPosition() {
                return 'g';
            },
            forEachAdjacentGroup(_groupId: string | null | undefined, cb: (groupId: string) => void) {
                cb('g');
            },
        },
        getConnectionPlayerById(id: number) {
            return id === player.id ? player : null;
        },
        removeEntityFromAreas() {},
        scheduleMobRespawn() {},
        scheduleStaticItemRespawn() {},
        addPlayer() {},
        emitPlayerEnter() {},
        isPlayerActive(id: number) {
            return id === player.id;
        },
        pushSpawnsToPlayerId() {},
        isValidPosition() {
            return true;
        },
        getDroppedItem() {
            return null;
        },
        handleItemDespawn() {},
        moveEntity(entity: { setPosition: (nextX: number, nextY: number) => void }, x: number, y: number) {
            entity.setPosition(x, y);
        },
        removeEntity() {},
        addItemFromChest() {
            return null;
        },
        pushToPlayerId(playerId: number, message: WorldMessage) {
            if (playerId === player.id) {
                delivered.push(message);
            }
        },
        persistPlayerEquipment() {},
        persistPlayerCheckpoint() {},
        persistPlayerAchievementUnlock() {},
        recordPlayerMobKill() {},
        recordPlayerDamageTaken() {},
        recordPlayerRevive() {},
    };

    const pipeline = new WorldEcsCommandPipeline(host as never);
    pipeline.state.world.ensureEntity(player.id);
    pipeline.state.world.addComponent(player.id, pipeline.replication.Kind, Types.Entities.WARRIOR);
    pipeline.state.world.addComponent(player.id, pipeline.Position, gridPos(player.x, player.y));

    return { pipeline, delivered };
}

test('server denies C2S TELEPORT to arbitrary tiles (not on a door)', () => {
    const player = createTestPlayer(21001);
    player.setPosition(5, 5);

    const { pipeline, delivered } = createPipelineFixture({
        player,
        isDoor: () => false,
        getDoorDestination: () => null,
    });

    pipeline.state.world.addComponent(player.id, pipeline.Position, gridPos(5, 5));

    pipeline.enqueue({
        type: 'TELEPORT',
        source: { connectionId: 'c', playerId: player.id },
        to: gridPos(10, 10),
    });

    pipeline.tick();

    expect(pipeline.Position.store.get(player.id)).toEqual(gridPos(5, 5));
    expect(delivered.some((msg) => Array.isArray(msg) && msg[0] === Types.Messages.TELEPORT)).toBe(false);
});

test('server allowlists C2S TELEPORT only for door destinations (transitional)', () => {
    const player = createTestPlayer(21002);
    player.setPosition(5, 5);

    const { pipeline, delivered } = createPipelineFixture({
        player,
        isDoor: (x, y) => x === 5 && y === 5,
        getDoorDestination: (x, y) => (x === 5 && y === 5 ? { x: 10, y: 10 } : null),
    });

    pipeline.state.world.addComponent(player.id, pipeline.Position, gridPos(5, 5));

    pipeline.enqueue({
        type: 'TELEPORT',
        source: { connectionId: 'c', playerId: player.id },
        to: gridPos(10, 10),
    });

    pipeline.tick();

    expect(pipeline.Position.store.get(player.id)).toEqual(gridPos(10, 10));
    expect(
        delivered.some(
            (msg) =>
                Array.isArray(msg) &&
                msg[0] === Types.Messages.TELEPORT &&
                msg[1] === player.id &&
                msg[2] === 10 &&
                msg[3] === 10
        )
    ).toBe(true);
});
