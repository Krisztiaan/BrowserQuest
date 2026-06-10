import { expect, test } from 'bun:test';
import Types from '../../../shared/gametypes-browser';
import Player from '../../../server/player';
import { gridPos } from '../../../shared/domain/positions';
import { WorldEcsCommandPipeline } from '../../../server/world/ecs-command-pipeline';
import type { WorldMessage } from '../../../server/world/contracts';
import { tileToWorldPosCenter } from '../../../shared/world/worldpos';

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

function createDoorTraversalHost({
    player,
    delivered,
    includeResolveDoorTeleport,
}: {
    player: Player;
    delivered: WorldMessage[];
    includeResolveDoorTeleport: boolean;
}) {
    const testMap = {
        getCheckpoint() {
            return null;
        },
        isDoor(x: number, y: number) {
            return x === 5 && y === 5;
        },
        getDoorDestination(x: number, y: number) {
            return x === 5 && y === 5 ? { x: 10, y: 10 } : null;
        },
        getGroupIdFromPosition() {
            return 'g';
        },
        forEachAdjacentGroup(_groupId: string | null | undefined, cb: (groupId: string) => void) {
            cb('g');
        },
    };
    const host = {
        ups: 50,
        map: testMap,
        getDefaultMapId() {
            return 'world_01';
        },
        getMapById(mapId: string) {
            return mapId === 'world_01' ? testMap : null;
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
        isValidPositionForMap(mapId: string, x: number, y: number) {
            return mapId === 'world_01' && Number.isInteger(x) && Number.isInteger(y);
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
    } as Record<string, unknown>;

    if (includeResolveDoorTeleport) {
        host.resolveDoorTeleport = (mapId: string, x: number, y: number) => {
            if (mapId !== 'world_01') {
                return null;
            }
            return x === 5 && y === 5 ? { toMapId: 'world_01', to: gridPos(10, 10) } : null;
        };
    }

    return host;
}

test('stepping onto a door tile produces a server-issued TELEPORT to its destination', () => {
    const player = createTestPlayer(21201);
    player.setPosition(4, 5);

    const delivered: WorldMessage[] = [];
    const host = createDoorTraversalHost({ player, delivered, includeResolveDoorTeleport: true });

    const pipeline = new WorldEcsCommandPipeline(host as never);
    pipeline.state.world.ensureEntity(player.id);
    pipeline.state.world.addComponent(player.id, pipeline.replication.Kind, Types.Entities.WARRIOR);
    pipeline.state.world.addComponent(player.id, pipeline.Position, gridPos(4, 5));
    pipeline.state.world.addComponent(player.id, pipeline.PositionSub, tileToWorldPosCenter(4, 5));
    pipeline.state.world.addComponent(player.id, pipeline.combat.HitPoints, 100);
    pipeline.state.world.addComponent(player.id, pipeline.combat.MaxHitPoints, 100);
    player.setPosition(4, 5);

    pipeline.enqueue({
        type: 'MOVE',
        source: { connectionId: 'c', playerId: player.id },
        to: gridPos(5, 5),
    });

    pipeline.tick();
    for (let i = 0; i < 12; i += 1) {
        pipeline.tick();
    }

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

test('door traversal does not use map.getDoorDestination when resolveDoorTeleport is unavailable', () => {
    const player = createTestPlayer(21202);
    player.setPosition(4, 5);

    const delivered: WorldMessage[] = [];
    const host = createDoorTraversalHost({ player, delivered, includeResolveDoorTeleport: false });

    const pipeline = new WorldEcsCommandPipeline(host as never);
    pipeline.state.world.ensureEntity(player.id);
    pipeline.state.world.addComponent(player.id, pipeline.replication.Kind, Types.Entities.WARRIOR);
    pipeline.state.world.addComponent(player.id, pipeline.Position, gridPos(4, 5));
    pipeline.state.world.addComponent(player.id, pipeline.PositionSub, tileToWorldPosCenter(4, 5));
    pipeline.state.world.addComponent(player.id, pipeline.combat.HitPoints, 100);
    pipeline.state.world.addComponent(player.id, pipeline.combat.MaxHitPoints, 100);
    player.setPosition(4, 5);

    pipeline.enqueue({
        type: 'MOVE',
        source: { connectionId: 'c', playerId: player.id },
        to: gridPos(5, 5),
    });

    pipeline.tick();
    for (let i = 0; i < 12; i += 1) {
        pipeline.tick();
    }

    expect(pipeline.Position.store.get(player.id)).toEqual(gridPos(5, 5));
    expect(
        delivered.some((msg) => Array.isArray(msg) && msg[0] === Types.Messages.TELEPORT && msg[1] === player.id)
    ).toBe(false);
});
