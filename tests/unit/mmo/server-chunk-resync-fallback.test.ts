import { expect, test } from 'bun:test';
import Types from '../../../shared/gametypes-browser';
import Player from '../../../server/player';
import { gridPos } from '../../../shared/domain/positions';
import { WorldEcsCommandPipeline } from '../../../server/world/ecs-command-pipeline';
import { CHUNK_AOI_STATE_RESOURCE } from '../../../server/world/chunks/chunk-aoi';
import { makeScopedChunkKey } from '../../../server/world/chunks/chunk-overlay-store';
import type { WorldMessage } from '../../../server/world/contracts';
import type { ServerToClientProtocolAction } from '../../../shared/protocol/types';

function createTestPlayer(wireId: number): Player {
    const connection = {
        id: String(wireId),
        listen() {},
        onClose() {},
        send() {},
        sendUTF8() {},
        close() {},
    };
    const player = new Player(connection, null);
    player.resetHitPoints(100);
    player.isDead = false;
    player.setPosition(0, 0);
    return player;
}

function toSerializedAction(message: WorldMessage): ServerToClientProtocolAction {
    return Array.isArray(message) ? message : message.serialize();
}

function collectActions(messages: readonly WorldMessage[]): ServerToClientProtocolAction[] {
    return messages.map(toSerializedAction);
}

function isChunkSnapshotMessage(action: ServerToClientProtocolAction): action is [number, number, number, number, string] {
    return action[0] === Types.Messages.CHUNK_SNAPSHOT;
}

function isChunkDeltaMessage(action: ServerToClientProtocolAction): action is [number, number, number, number, number, string] {
    return action[0] === Types.Messages.CHUNK_DELTA;
}

function isChunkSnapshotPartMessage(
    action: ServerToClientProtocolAction
): action is [number, number, number, number, number, number, string] {
    return action[0] === Types.Messages.CHUNK_SNAPSHOT_PART;
}

function createPipelineFixture(player: Player): {
    pipeline: WorldEcsCommandPipeline;
    delivered: WorldMessage[];
} {
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
        moveEntity(entity: Player, x: number, y: number) {
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

    return { pipeline, delivered };
}

test('delta version gaps are healed by snapshot resync fallback', () => {
    const player = createTestPlayer(23801);
    player.setPosition(1, 1);
    const { pipeline, delivered } = createPipelineFixture(player);

    pipeline.enqueue({
        type: 'CHUNK_SUBSCRIBE',
        source: { connectionId: 'c', playerId: player.id },
        chunkX: 0,
        chunkY: 0,
        radius: 0,
    });
    pipeline.tick();

    const chunkAoi = pipeline.state.resources.require(CHUNK_AOI_STATE_RESOURCE);
    const sub = chunkAoi.byPlayerId.get(player.id);
    expect(sub).toBeTruthy();
    if (!sub) {
        return;
    }
    const key = makeScopedChunkKey('world', 0, 0);

    pipeline.chunkOverlays.setGlobal(1, 1, 123);
    const beforeTick2 = delivered.length;
    pipeline.tick();
    const tick2 = collectActions(delivered.slice(beforeTick2));
    const deltas2 = tick2.filter(isChunkDeltaMessage);
    expect(deltas2).toHaveLength(1);
    expect([deltas2[0]?.[3], deltas2[0]?.[4]]).toEqual([0, 1]);

    sub.knownChunkVersions.set(key, 0);

    pipeline.chunkOverlays.setGlobal(1, 2, 124);
    const beforeTick3 = delivered.length;
    pipeline.tick();
    const tick3 = collectActions(delivered.slice(beforeTick3));
    expect(tick3.filter(isChunkDeltaMessage)).toHaveLength(0);
    expect(tick3.filter(isChunkSnapshotMessage)).toHaveLength(0);

    const beforeTick4 = delivered.length;
    pipeline.tick();
    const tick4 = collectActions(delivered.slice(beforeTick4));
    const snapshots4 = tick4.filter(isChunkSnapshotMessage);
    expect(snapshots4).toHaveLength(1);
    expect(snapshots4[0]?.[3]).toBe(2);

    pipeline.chunkOverlays.setGlobal(1, 3, 125);
    const beforeTick5 = delivered.length;
    pipeline.tick();
    const tick5 = collectActions(delivered.slice(beforeTick5));
    expect(tick5.filter(isChunkSnapshotMessage)).toHaveLength(0);
    const deltas5 = tick5.filter(isChunkDeltaMessage);
    expect(deltas5).toHaveLength(1);
    expect([deltas5[0]?.[3], deltas5[0]?.[4]]).toEqual([2, 3]);
});

test('delta overflow fallback emits snapshot parts even when part count exceeds configured cap', () => {
    const player = createTestPlayer(23802);
    player.setPosition(1, 1);
    const { pipeline, delivered } = createPipelineFixture(player);

    pipeline.setServerConfig({
        port: 0,
        nb_worlds: 1,
        nb_players_per_world: 1,
        map_filepath: '',
        metrics_enabled: false,
        debug_level: 'info',
        chunk_snapshot_payload_max_utf8_bytes: 128,
        chunk_snapshot_max_parts: 2,
    });

    pipeline.enqueue({
        type: 'CHUNK_SUBSCRIBE',
        source: { connectionId: 'c', playerId: player.id },
        chunkX: 0,
        chunkY: 0,
        radius: 0,
    });
    pipeline.tick();

    for (let i = 0; i < 300; i += 1) {
        pipeline.chunkOverlays.setGlobal(i % 32, Math.floor(i / 32), (0xffff_ffff - i) >>> 0);
    }

    const beforeTick2 = delivered.length;
    pipeline.tick();
    pipeline.tick();
    const tick2 = collectActions(delivered.slice(beforeTick2));
    const parts = tick2.filter(isChunkSnapshotPartMessage);

    expect(parts.length).toBeGreaterThan(0);
    if (parts.length > 0) {
        expect(parts[0]?.[5]).toBeGreaterThan(2);
    }
});
