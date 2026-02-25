import { expect, test } from 'bun:test';
import Types from '../../../shared/gametypes-browser';
import Player from '../../../server/player';
import { gridPos } from '../../../shared/domain/positions';
import { WorldEcsCommandPipeline } from '../../../server/world/ecs-command-pipeline';
import { CHUNK_AOI_STATE_RESOURCE } from '../../../server/world/chunks/chunk-aoi';
import { makeScopedChunkKey } from '../../../server/world/chunks/chunk-overlay-store';
import { decodeChunkSnapshotPayloadBinary } from '../../../shared/protocol/chunks/chunk-snapshot-codec';
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

function isChunkSnapshotMessage(
    msg: WorldMessage
): msg is [number, number, number, number, ReadonlyArray<number> | Uint8Array] {
    return (
        Array.isArray(msg)
        && msg[0] === Types.Messages.CHUNK_SNAPSHOT
        && typeof msg[1] === 'number'
        && typeof msg[2] === 'number'
        && typeof msg[3] === 'number'
        && (Array.isArray(msg[4]) || (msg[4] as unknown) instanceof Uint8Array)
    );
}

test('CHUNK_SUBSCRIBE streams bounded CHUNK_SNAPSHOTs and includes overlay overrides', () => {
    const player = createTestPlayer(23201);
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

    pipeline.chunkOverlays.setGlobal(1, 1, 123);

    pipeline.enqueue({
        type: 'CHUNK_SUBSCRIBE',
        source: { connectionId: 'c', playerId: player.id },
        chunkX: 999,
        chunkY: 999,
        radius: 1,
    });

    const beforeTick1 = delivered.length;
    pipeline.tick();
    const tick1 = delivered.slice(beforeTick1).filter(isChunkSnapshotMessage);
    expect(tick1).toHaveLength(8);

    const coords1 = new Set(tick1.map((msg) => `${msg[1]},${msg[2]}`));
    expect(coords1.size).toBe(8);
    for (const coord of coords1) {
        const [chunkXRaw, chunkYRaw] = coord.split(',');
        const chunkX = Number(chunkXRaw);
        const chunkY = Number(chunkYRaw);
        expect(chunkX).toBeGreaterThanOrEqual(-1);
        expect(chunkX).toBeLessThanOrEqual(1);
        expect(chunkY).toBeGreaterThanOrEqual(-1);
        expect(chunkY).toBeLessThanOrEqual(1);
    }

    const beforeTick2 = delivered.length;
    pipeline.tick();
    const tick2 = delivered.slice(beforeTick2).filter(isChunkSnapshotMessage);
    expect(tick2).toHaveLength(1);
    const coords2 = new Set(tick2.map((msg) => `${msg[1]},${msg[2]}`));
    for (const coord of coords2) {
        expect(coords1.has(coord)).toBe(false);
    }

    const allSnapshots = [...tick1, ...tick2];
    const center = allSnapshots.find((msg) => msg[1] === 0 && msg[2] === 0);
    expect(center).toBeTruthy();
    if (!center) {
        return;
    }
    expect(center[3]).toBe(1);
    const decoded = decodeChunkSnapshotPayloadBinary(center[4]);
    expect(decoded?.schemaVersion).toBe(1);
    expect(decoded?.encoding).toBe('binary');
    expect(decoded?.chunkSize).toBe(32);
    expect(decoded?.overrides).toContainEqual([1, 1, 123]);

    const beforeTick3 = delivered.length;
    pipeline.tick();
    const tick3 = delivered.slice(beforeTick3).filter(isChunkSnapshotMessage);
    expect(tick3).toHaveLength(0);
});

test('chunk AOI prunes stale/out-of-window state and enforces pending queue caps', () => {
    const player = createTestPlayer(23202);
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
        radius: 8,
    });
    pipeline.tick();

    const chunkAoi = pipeline.state.resources.require(CHUNK_AOI_STATE_RESOURCE);
    const sub = chunkAoi.byPlayerId.get(player.id);
    expect(sub).toBeTruthy();
    if (!sub) {
        return;
    }

    const nearKey = makeScopedChunkKey('world', 0, 0);
    const farKey = makeScopedChunkKey('world', 200, 200);
    sub.knownChunks.add(nearKey);
    sub.knownChunkVersions.set(nearKey, 1);
    sub.knownChunks.add(farKey);
    sub.knownChunkVersions.set(farKey, 7);

    sub.lastMapId = 'world';
    sub.pendingChunks.push({ mapId: 'world', chunkX: 0, chunkY: 0 });
    sub.pendingChunks.push({ mapId: 'world', chunkX: 0, chunkY: 0 });
    sub.pendingChunks.push({ mapId: 'world', chunkX: 200, chunkY: 200 });
    sub.pendingChunkKeys.add(makeScopedChunkKey('world', 0, 0));
    sub.pendingChunkKeys.add(makeScopedChunkKey('world', 200, 200));

    sub.pendingSnapshotParts = [];
    sub.inFlightSnapshotKeys.clear();
    for (let i = 0; i < 40; i += 1) {
        const chunkX = (i % 10) - 5;
        const chunkY = Math.floor(i / 10) - 2;
        const key = makeScopedChunkKey('world', chunkX, chunkY);
        sub.pendingSnapshotParts.push({
            key,
            mapId: 'world',
            chunkX,
            chunkY,
            version: i + 1,
            parts: Array.from({ length: 80 }, () => '{}'),
            nextPartIndex: 0,
        });
        sub.inFlightSnapshotKeys.add(key);
    }

    pipeline.tick();

    expect(sub.knownChunks.has(farKey)).toBe(false);
    expect(sub.knownChunkVersions.has(farKey)).toBe(false);
    expect(sub.knownChunkVersions.has(nearKey)).toBe(true);

    const pendingCoordSet = new Set(sub.pendingChunks.map((entry) => `${entry.chunkX},${entry.chunkY}`));
    expect(pendingCoordSet.size).toBe(sub.pendingChunks.length);
    for (const pending of sub.pendingChunks) {
        expect(Math.abs(pending.chunkX)).toBeLessThanOrEqual(8);
        expect(Math.abs(pending.chunkY)).toBeLessThanOrEqual(8);
    }
    expect(sub.pendingChunkKeys.size).toBe(sub.pendingChunks.length);

    const totalPendingParts = sub.pendingSnapshotParts.reduce((sum, stream) => sum + stream.parts.length, 0);
    expect(sub.pendingSnapshotParts.length).toBeLessThanOrEqual(32);
    expect(totalPendingParts).toBeLessThanOrEqual(2048);
    expect(sub.inFlightSnapshotKeys.size).toBe(sub.pendingSnapshotParts.length);
});
