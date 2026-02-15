import { expect, test } from 'bun:test';
import Types from '../../../shared/gametypes-browser';
import Player from '../../../server/player';
import { gridPos } from '../../../shared/domain/positions';
import { WorldEcsCommandPipeline } from '../../../server/world/ecs-command-pipeline';
import { INTENT_SEQ_STATE_RESOURCE } from '../../../server/ecs/intent-seq';

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

test('server ignores duplicate seq INTENT movement (idempotent) and acks', () => {
    const player = createTestPlayer(22101);
    player.setPosition(0, 0);

    const delivered: unknown[] = [];
    const host: Record<string, unknown> = {
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
        moveEntity(entity: unknown, x: number, y: number) {
            (entity as { setPosition: (nextX: number, nextY: number) => void }).setPosition(x, y);
        },
        removeEntity() {},
        addItemFromChest() {
            return null;
        },
        pushToPlayerId(playerId: number, message: unknown) {
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
    pipeline.state.world.addComponent(player.id, pipeline.Position, gridPos(0, 0));
    pipeline.state.world.addComponent(player.id, pipeline.combat.HitPoints, 100);
    pipeline.state.world.addComponent(player.id, pipeline.combat.MaxHitPoints, 100);

    pipeline.enqueue({
        type: 'INTENT',
        source: { connectionId: 'c', playerId: player.id },
        seq: 1,
        intentTypeId: 'move.step',
        payloadJson: JSON.stringify({ x: 1, y: 0 }),
    });
    pipeline.tick();
    expect(pipeline.Position.store.get(player.id)).toEqual(gridPos(1, 0));

    delivered.length = 0;
    pipeline.enqueue({
        type: 'INTENT',
        source: { connectionId: 'c', playerId: player.id },
        seq: 1,
        intentTypeId: 'move.step',
        payloadJson: JSON.stringify({ x: 2, y: 0 }),
    });
    pipeline.tick();

    expect(pipeline.Position.store.get(player.id)).toEqual(gridPos(1, 0));
    expect(
        delivered.some((msg) => Array.isArray(msg) && msg[0] === Types.Messages.ACK && msg[1] === 1)
    ).toBe(true);
});

test('server rejects stale seq and emits a correction', () => {
    const player = createTestPlayer(22102);
    player.setPosition(0, 0);

    const delivered: unknown[] = [];
    const host: Record<string, unknown> = {
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
        moveEntity(entity: unknown, x: number, y: number) {
            (entity as { setPosition: (nextX: number, nextY: number) => void }).setPosition(x, y);
        },
        removeEntity() {},
        addItemFromChest() {
            return null;
        },
        pushToPlayerId(playerId: number, message: unknown) {
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
    pipeline.state.world.addComponent(player.id, pipeline.Position, gridPos(0, 0));
    pipeline.state.world.addComponent(player.id, pipeline.combat.HitPoints, 100);
    pipeline.state.world.addComponent(player.id, pipeline.combat.MaxHitPoints, 100);

    pipeline.enqueue({
        type: 'INTENT',
        source: { connectionId: 'c', playerId: player.id },
        seq: 2,
        intentTypeId: 'move.step',
        payloadJson: JSON.stringify({ x: 1, y: 0 }),
    });
    pipeline.tick();
    expect(pipeline.Position.store.get(player.id)).toEqual(gridPos(1, 0));

    delivered.length = 0;
    pipeline.enqueue({
        type: 'INTENT',
        source: { connectionId: 'c', playerId: player.id },
        seq: 1,
        intentTypeId: 'move.step',
        payloadJson: JSON.stringify({ x: 0, y: 0 }),
    });
    pipeline.tick();

    expect(
        delivered.some((msg) => Array.isArray(msg) && msg[0] === Types.Messages.REJECT && msg[1] === 1)
    ).toBe(true);
    expect(
        delivered.some(
            (msg) =>
                Array.isArray(msg) &&
                msg[0] === Types.Messages.CORRECTION &&
                msg[1] === 1 &&
                msg[2] === 1 &&
                msg[3] === 0
        )
    ).toBe(true);
});

test('server rejects invalid move.step (non-adjacent) and emits CORRECTION (no ACK/TELEPORT)', () => {
    const player = createTestPlayer(22103);
    player.setPosition(0, 0);

    const delivered: unknown[] = [];
    const host: Record<string, unknown> = {
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
        moveEntity(entity: unknown, x: number, y: number) {
            (entity as { setPosition: (nextX: number, nextY: number) => void }).setPosition(x, y);
        },
        removeEntity() {},
        addItemFromChest() {
            return null;
        },
        pushToPlayerId(playerId: number, message: unknown) {
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
    pipeline.state.world.addComponent(player.id, pipeline.Position, gridPos(0, 0));
    pipeline.state.world.addComponent(player.id, pipeline.combat.HitPoints, 100);
    pipeline.state.world.addComponent(player.id, pipeline.combat.MaxHitPoints, 100);

    pipeline.enqueue({
        type: 'INTENT',
        source: { connectionId: 'c', playerId: player.id },
        seq: 1,
        intentTypeId: 'move.step',
        payloadJson: JSON.stringify({ x: 2, y: 0 }),
    });
    pipeline.tick();

    expect(
        delivered.some((msg) => Array.isArray(msg) && msg[0] === Types.Messages.REJECT && msg[1] === 1)
    ).toBe(true);
    expect(
        delivered.some(
            (msg) =>
                Array.isArray(msg) &&
                msg[0] === Types.Messages.CORRECTION &&
                msg[1] === 1 &&
                msg[2] === 0 &&
                msg[3] === 0
        )
    ).toBe(true);
    expect(delivered.some((msg) => Array.isArray(msg) && msg[0] === Types.Messages.ACK && msg[1] === 1)).toBe(false);
    expect(delivered.some((msg) => Array.isArray(msg) && msg[0] === Types.Messages.TELEPORT)).toBe(false);

    delivered.length = 0;
    pipeline.enqueue({
        type: 'INTENT',
        source: { connectionId: 'c', playerId: player.id },
        seq: 1,
        intentTypeId: 'move.step',
        payloadJson: JSON.stringify({ x: 2, y: 0 }),
    });
    pipeline.tick();

    expect(
        delivered.some((msg) => Array.isArray(msg) && msg[0] === Types.Messages.REJECT && msg[1] === 1)
    ).toBe(true);
    expect(delivered.some((msg) => Array.isArray(msg) && msg[0] === Types.Messages.ACK && msg[1] === 1)).toBe(false);
});

test('server clears per-player seq state when entity is removed', () => {
    const player = createTestPlayer(22104);

    const host: Record<string, unknown> = {
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
        isPlayerActive() {
            return true;
        },
        pushSpawnsToPlayerId() {},
        isValidPosition() {
            return true;
        },
        getDroppedItem() {
            return null;
        },
        handleItemDespawn() {},
        moveEntity() {},
        removeEntity() {},
        addItemFromChest() {
            return null;
        },
        pushToPlayerId() {},
        persistPlayerEquipment() {},
        persistPlayerCheckpoint() {},
        persistPlayerAchievementUnlock() {},
        recordPlayerMobKill() {},
        recordPlayerDamageTaken() {},
        recordPlayerRevive() {},
    };

    const pipeline = new WorldEcsCommandPipeline(host as never);
    pipeline.state.world.ensureEntity(player.id);

    const seqState = pipeline.state.resources.require(INTENT_SEQ_STATE_RESOURCE);
    seqState.lastAcceptedByPlayerId.set(player.id, 99);
    expect(seqState.lastAcceptedByPlayerId.get(player.id)).toBe(99);

    pipeline.removeEntity(player.id);
    expect(seqState.lastAcceptedByPlayerId.has(player.id)).toBe(false);
});
