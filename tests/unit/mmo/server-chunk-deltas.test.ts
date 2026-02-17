import { expect, test } from 'bun:test';
import Types from '../../../shared/gametypes-browser';
import Player from '../../../server/player';
import { gridPos } from '../../../shared/domain/positions';
import { WorldEcsCommandPipeline } from '../../../server/world/ecs-command-pipeline';
import { decodeChunkDeltaPayloadJson } from '../../../shared/protocol/chunks/chunk-delta-codec';
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

function isChunkDeltaMessage(msg: WorldMessage): msg is [number, number, number, number, number, string] {
    return (
        Array.isArray(msg)
        && msg[0] === Types.Messages.CHUNK_DELTA
        && typeof msg[1] === 'number'
        && typeof msg[2] === 'number'
        && typeof msg[3] === 'number'
        && typeof msg[4] === 'number'
        && typeof msg[5] === 'string'
    );
}

test('chunk overlay edits stream versioned CHUNK_DELTA when subscriber version aligns', () => {
    const player = createTestPlayer(23301);
    player.setPosition(1, 1);

    const delivered: WorldMessage[] = [];
    const host = {
        ups: 50,
        map: {
            getCheckpoint() {
                return null;
            },
            isDoor() {
                return false;
            },
            getDoorDestination() {
                return null;
            },
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
        getEntityById() {
            return null;
        },
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
    pipeline.state.world.addComponent(player.id, pipeline.Position, gridPos(1, 1));
    pipeline.state.world.addComponent(player.id, pipeline.combat.HitPoints, 100);
    pipeline.state.world.addComponent(player.id, pipeline.combat.MaxHitPoints, 100);

    pipeline.enqueue({
        type: 'CHUNK_SUBSCRIBE',
        source: { connectionId: 'c', playerId: player.id },
        chunkX: 0,
        chunkY: 0,
        radius: 0,
    });

    pipeline.tick();

    pipeline.chunkOverlays.setGlobal(1, 1, 123);
    const beforeTick2 = delivered.length;
    pipeline.tick();
    const tick2 = delivered.slice(beforeTick2).filter(isChunkDeltaMessage);
    expect(tick2).toHaveLength(1);
    const firstTick2 = tick2[0];
    expect(firstTick2).toBeTruthy();
    if (!firstTick2) {
        throw new Error('Expected first CHUNK_DELTA message.');
    }
    const [, chunkX, chunkY, fromVersion, toVersion, payloadJson] = firstTick2;
    expect([chunkX, chunkY]).toEqual([0, 0]);
    expect([fromVersion, toVersion]).toEqual([0, 1]);
    if (typeof payloadJson !== 'string') {
        throw new Error('Expected first CHUNK_DELTA payload to be a string.');
    }
    const decoded = decodeChunkDeltaPayloadJson(payloadJson);
    expect(decoded?.chunkSize).toBe(32);
    expect(decoded?.changes).toContainEqual([1, 1, 123]);

    pipeline.chunkOverlays.clearGlobal(1, 1);
    const beforeTick3 = delivered.length;
    pipeline.tick();
    const tick3 = delivered.slice(beforeTick3).filter(isChunkDeltaMessage);
    expect(tick3).toHaveLength(1);
    const firstTick3 = tick3[0];
    expect(firstTick3).toBeTruthy();
    if (!firstTick3) {
        throw new Error('Expected second CHUNK_DELTA message.');
    }
    const [, chunkX2, chunkY2, fromVersion2, toVersion2, payloadJson2] = firstTick3;
    expect([chunkX2, chunkY2]).toEqual([0, 0]);
    expect([fromVersion2, toVersion2]).toEqual([1, 2]);
    if (typeof payloadJson2 !== 'string') {
        throw new Error('Expected second CHUNK_DELTA payload to be a string.');
    }
    const decoded2 = decodeChunkDeltaPayloadJson(payloadJson2);
    expect(decoded2?.changes).toContainEqual([1, 1, null]);
});
