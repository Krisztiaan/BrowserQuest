import { expect, test } from 'bun:test';
import Types from '../../../shared/gametypes-browser';
import Player from '../../../server/player';
import ServerMap from '../../../server/map';
import { loadRuntimeMapPackFromSource } from '../../../server/runtime-map-pack-source';
import { gridPos } from '../../../shared/domain/positions';
import { WorldEcsCommandPipeline } from '../../../server/world/ecs-command-pipeline';
import {
    encodeMoveInputIntentPayload,
    MOVE_INPUT_KEY_A,
    MOVE_INPUT_KEY_D,
    MOVE_INPUT_KEY_S,
    MOVE_INPUT_KEY_W,
} from '../../../shared/protocol/intents';
import type { WorldMessage } from '../../../server/world/contracts';
import { SUBPIXELS, tileToWorldPosCenter } from '../../../shared/world/worldpos';

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

test('move.input intent acks and produces an authoritative MOVE step', () => {
    const player = createTestPlayer(24901);
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
    pipeline.state.world.addComponent(player.id, pipeline.PositionSub, tileToWorldPosCenter(1, 1));
    pipeline.state.world.addComponent(player.id, pipeline.combat.HitPoints, 100);
    pipeline.state.world.addComponent(player.id, pipeline.combat.MaxHitPoints, 100);

    const payloadBytes = encodeMoveInputIntentPayload({ keysMask: MOVE_INPUT_KEY_D });
    expect(payloadBytes).toBeTruthy();
    if (!payloadBytes) {
        throw new Error('Failed to encode move.input');
    }

    pipeline.enqueue({
        type: 'INTENT',
        source: { connectionId: 'c', playerId: player.id },
        seq: 1,
        intentTypeId: 'move.input',
        payloadBytes,
    });
    pipeline.tick();
    for (let i = 0; i < 8; i += 1) {
        pipeline.tick();
    }

    expect(delivered.some((msg) => Array.isArray(msg) && msg[0] === Types.Messages.ACK && msg[1] === 1)).toBe(true);
    expect(delivered.some((msg) => Array.isArray(msg) && msg[0] === Types.Messages.MOVE && msg[2] === 2 && msg[3] === 1)).toBe(true);
});

test('move.input overrides any existing MoveQueue (cancels click-to-move on server)', () => {
    const player = createTestPlayer(24902);
    player.setPosition(5, 5);

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
    pipeline.state.world.addComponent(player.id, pipeline.Position, gridPos(5, 5));
    pipeline.state.world.addComponent(player.id, pipeline.PositionSub, tileToWorldPosCenter(5, 5));
    pipeline.state.world.addComponent(player.id, pipeline.combat.HitPoints, 100);
    pipeline.state.world.addComponent(player.id, pipeline.combat.MaxHitPoints, 100);

    // Pre-seed a "click-to-move" style queue to the right; move.input should override it to the left.
    pipeline.state.world.addComponent(player.id, pipeline.movement.MoveQueue, { entries: [gridPos(6, 5)] });

    const payloadBytes = encodeMoveInputIntentPayload({ keysMask: MOVE_INPUT_KEY_A });
    expect(payloadBytes).toBeTruthy();
    if (!payloadBytes) {
        throw new Error('Failed to encode move.input');
    }

    pipeline.enqueue({
        type: 'INTENT',
        source: { connectionId: 'c', playerId: player.id },
        seq: 1,
        intentTypeId: 'move.input',
        payloadBytes,
    });
    pipeline.tick();
    for (let i = 0; i < 8; i += 1) {
        pipeline.tick();
    }

    expect(delivered.some((msg) => Array.isArray(msg) && msg[0] === Types.Messages.MOVE && msg[2] === 4 && msg[3] === 5)).toBe(true);
});

test('move.input supports diagonal combos (W+D)', () => {
    const player = createTestPlayer(24903);
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
    pipeline.state.world.addComponent(player.id, pipeline.PositionSub, tileToWorldPosCenter(1, 1));
    pipeline.state.world.addComponent(player.id, pipeline.combat.HitPoints, 100);
    pipeline.state.world.addComponent(player.id, pipeline.combat.MaxHitPoints, 100);

    const payloadBytes = encodeMoveInputIntentPayload({ keysMask: MOVE_INPUT_KEY_W | MOVE_INPUT_KEY_D });
    expect(payloadBytes).toBeTruthy();
    if (!payloadBytes) {
        throw new Error('Failed to encode move.input');
    }

    pipeline.enqueue({
        type: 'INTENT',
        source: { connectionId: 'c', playerId: player.id },
        seq: 1,
        intentTypeId: 'move.input',
        payloadBytes,
    });
    pipeline.tick();
    for (let i = 0; i < 8; i += 1) {
        pipeline.tick();
    }

    expect(delivered.some((msg) => Array.isArray(msg) && msg[0] === Types.Messages.MOVE && msg[2] === 2 && msg[3] === 0)).toBe(true);
});

test('move.input never leaves map extents even if host isValidPosition is permissive', () => {
    const player = createTestPlayer(24904);
    player.setPosition(0, 0);

    const host = {
        ups: 50,
        map: {
            width: 2,
            height: 2,
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
    pipeline.state.world.addComponent(player.id, pipeline.replication.Kind, Types.Entities.WARRIOR);
    pipeline.state.world.addComponent(player.id, pipeline.Position, gridPos(0, 0));
    pipeline.state.world.addComponent(player.id, pipeline.PositionSub, tileToWorldPosCenter(0, 0));
    pipeline.state.world.addComponent(player.id, pipeline.combat.HitPoints, 100);
    pipeline.state.world.addComponent(player.id, pipeline.combat.MaxHitPoints, 100);

    const payloadBytes = encodeMoveInputIntentPayload({ keysMask: MOVE_INPUT_KEY_A });
    expect(payloadBytes).toBeTruthy();
    if (!payloadBytes) {
        throw new Error('Failed to encode move.input');
    }

    pipeline.enqueue({
        type: 'INTENT',
        source: { connectionId: 'c', playerId: player.id },
        seq: 1,
        intentTypeId: 'move.input',
        payloadBytes,
    });

    for (let i = 0; i < 20; i += 1) {
        pipeline.tick();
    }

    const subPos = pipeline.PositionSub.store.get(player.id);
    const gridPosNow = pipeline.Position.store.get(player.id);
    expect(subPos?.x).toBe(6 * SUBPIXELS);
    expect(gridPosNow).toEqual(gridPos(0, 0));
});

test('move.input diagonal near dense world collisions never commits blocked tiles', async () => {
    const player = createTestPlayer(24905);
    player.setPosition(158, 117);

    const pack = await loadRuntimeMapPackFromSource('./assets/maps/tiled/world.json') as {
        maps?: Array<{ id?: string; server?: unknown }>;
    };
    const worldRecord = pack.maps?.find((entry) => entry.id === 'world_01')?.server;
    expect(worldRecord).toBeTruthy();
    if (!worldRecord) {
        throw new Error('Missing world_01 server payload compiled from world.json');
    }

    const worldMap = new ServerMap();
    worldMap.initMap(worldRecord as never);
    worldMap.generateCollisionGrid();

    const delivered: WorldMessage[] = [];
    const host = {
        ups: 50,
        map: worldMap,
        getDefaultMapId() {
            return 'world_01';
        },
        getMapById(mapId: string) {
            return mapId === 'world_01' ? worldMap : null;
        },
        getCheckpoint() {
            return null;
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
        isValidPosition(x: number, y: number) {
            return !worldMap.isOutOfBounds(x, y) && !worldMap.isColliding(x, y);
        },
        isValidPositionForMap(mapId: string, x: number, y: number) {
            if (mapId !== 'world_01') {
                return false;
            }
            return !worldMap.isOutOfBounds(x, y) && !worldMap.isColliding(x, y);
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
    pipeline.state.world.addComponent(player.id, pipeline.Position, gridPos(158, 117));
    pipeline.state.world.addComponent(player.id, pipeline.PositionSub, tileToWorldPosCenter(158, 117));
    pipeline.state.world.addComponent(player.id, pipeline.combat.HitPoints, 100);
    pipeline.state.world.addComponent(player.id, pipeline.combat.MaxHitPoints, 100);

    const payloadBytes = encodeMoveInputIntentPayload({ keysMask: MOVE_INPUT_KEY_D | MOVE_INPUT_KEY_S });
    expect(payloadBytes).toBeTruthy();
    if (!payloadBytes) {
        throw new Error('Failed to encode move.input');
    }

    pipeline.enqueue({
        type: 'INTENT',
        source: { connectionId: 'c', playerId: player.id },
        seq: 1,
        intentTypeId: 'move.input',
        payloadBytes,
    });

    for (let i = 0; i < 40; i += 1) {
        pipeline.tick();
    }

    const moveTiles = delivered
        .filter((msg) => Array.isArray(msg) && msg[0] === Types.Messages.MOVE)
        .map((msg) => {
            const x = msg[2];
            const y = msg[3];
            if (typeof x !== 'number' || typeof y !== 'number') {
                return null;
            }
            return { x, y };
        })
        .filter((tile): tile is { x: number; y: number } => tile !== null);
    expect(moveTiles.length).toBeGreaterThan(0);
    for (const tile of moveTiles) {
        expect(worldMap.isColliding(tile.x, tile.y)).toBe(false);
    }

    const finalGrid = pipeline.Position.store.get(player.id);
    expect(finalGrid).toBeTruthy();
    if (!finalGrid) {
        throw new Error('Missing final grid position');
    }
    expect(worldMap.isColliding(finalGrid.x, finalGrid.y)).toBe(false);
});
