import { expect, test } from 'bun:test';
import Types from '../../../shared/gametypes-browser';
import Player from '../../../server/player';
import { gridPos } from '../../../shared/domain/positions';
import { tileToWorldPosCenter } from '../../../shared/world/worldpos';
import { WorldEcsCommandPipeline } from '../../../server/world/ecs-command-pipeline';
import type { WorldMessage } from '../../../server/world/contracts';
import type { MapTransitionEvent } from '../../../server/world/map-transition-observability';

type TestMap = {
    width: number;
    height: number;
    grid: number[][];
    getCheckpoint(id: string | number): null;
    isDoor(x: number, y: number): boolean;
    getDoorDestination(x: number, y: number): { x: number; y: number } | null;
    getGroupIdFromPosition(x: number, y: number): string;
    forEachAdjacentGroup(groupId: string | null | undefined, callback: (groupId: string) => void): void;
    isOutOfBounds(x: number, y: number): boolean;
    isColliding(x: number, y: number): boolean;
};

function createTestPlayer(wireId: number, name: string): Player {
    const connection = {
        id: String(wireId),
        listen() {},
        onClose() {},
        send() {},
        sendUTF8() {},
        close() {},
    };
    const player = new Player(connection as never, null);
    player.name = name;
    player.accountNameKey = name;
    player.armor = Types.Entities.CLOTHARMOR;
    player.weapon = Types.Entities.SWORD1;
    player.armorLevel = 1;
    player.weaponLevel = 1;
    player.resetHitPoints(100);
    player.isDead = false;
    return player;
}

function createMap(width: number, height: number): TestMap {
    const grid = Array.from({ length: height }, () => Array.from({ length: width }, () => 0));
    return {
        width,
        height,
        grid,
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
        forEachAdjacentGroup(_groupId: string | null | undefined, callback: (groupId: string) => void) {
            callback('g');
        },
        isOutOfBounds(x: number, y: number) {
            return x < 0 || y < 0 || x >= width || y >= height;
        },
        isColliding(x: number, y: number) {
            if (x < 0 || y < 0 || x >= width || y >= height) {
                return false;
            }
            return grid[y]?.[x] === 1;
        },
    };
}

function seedPlayer({
    pipeline,
    player,
    mapId,
    x,
    y,
}: {
    pipeline: WorldEcsCommandPipeline;
    player: Player;
    mapId: string;
    x: number;
    y: number;
}): void {
    player.setPosition(x, y);
    pipeline.state.world.ensureEntity(player.id);
    pipeline.state.world.addComponent(player.id, pipeline.replication.Kind, Types.Entities.WARRIOR);
    pipeline.state.world.addComponent(player.id, pipeline.MapId, mapId);
    pipeline.state.world.addComponent(player.id, pipeline.Position, gridPos(x, y));
    pipeline.state.world.addComponent(player.id, pipeline.PositionSub, tileToWorldPosCenter(x, y));
    pipeline.state.world.addComponent(player.id, pipeline.replication.Name, player.name);
    pipeline.state.world.addComponent(player.id, pipeline.replication.Orientation, Types.Orientations.DOWN);
    pipeline.state.world.addComponent(player.id, pipeline.replication.Armor, player.armor);
    pipeline.state.world.addComponent(player.id, pipeline.replication.Weapon, player.weapon);
    pipeline.state.world.addComponent(player.id, pipeline.combat.HitPoints, 100);
    pipeline.state.world.addComponent(player.id, pipeline.combat.MaxHitPoints, 100);
}

function hasPlayerMessage(
    messages: WorldMessage[],
    predicate: (msg: WorldMessage) => boolean
): boolean {
    return messages.some((msg) => predicate(msg));
}

test('door transition moves player across maps and updates interest visibility', () => {
    const mover = createTestPlayer(22101, 'mover');
    const sourceObserver = createTestPlayer(22102, 'source-observer');
    const targetObserver = createTestPlayer(22103, 'target-observer');

    const maps = {
        overworld: createMap(20, 20),
        house: createMap(12, 12),
    };
    const delivered = new Map<number, WorldMessage[]>();
    const transitionEvents: MapTransitionEvent[] = [];

    const host = {
        ups: 50,
        map: maps.overworld,
        getDefaultMapId() {
            return 'overworld';
        },
        getMapById(mapId: string) {
            return mapId === 'overworld' ? maps.overworld : mapId === 'house' ? maps.house : null;
        },
        resolveDoorTeleport(mapId: string, x: number, y: number) {
            if (mapId === 'overworld' && x === 2 && y === 1) {
                return { toMapId: 'house', to: gridPos(1, 1) };
            }
            return null;
        },
        isValidPositionForMap(mapId: string, x: number, y: number) {
            const map = mapId === 'overworld' ? maps.overworld : mapId === 'house' ? maps.house : null;
            if (!map) {
                return false;
            }
            return !map.isOutOfBounds(x, y) && !map.isColliding(x, y);
        },
        getConnectionPlayerById(id: number) {
            if (id === mover.id) return mover;
            if (id === sourceObserver.id) return sourceObserver;
            if (id === targetObserver.id) return targetObserver;
            return null;
        },
        removeEntityFromAreas() {},
        scheduleMobRespawn() {},
        scheduleStaticItemRespawn() {},
        addPlayer() {},
        emitPlayerEnter() {},
        isPlayerActive(id: number) {
            return id === mover.id || id === sourceObserver.id || id === targetObserver.id;
        },
        pushSpawnsToPlayerId() {},
        isValidPosition(x: number, y: number) {
            return !maps.overworld.isOutOfBounds(x, y) && !maps.overworld.isColliding(x, y);
        },
        getDroppedItem() {
            return null;
        },
        handleItemDespawn() {},
        removeEntity() {},
        addItemFromChest() {
            return null;
        },
        pushToPlayerId(playerId: number, message: WorldMessage) {
            const bucket = delivered.get(playerId) ?? [];
            bucket.push(message);
            delivered.set(playerId, bucket);
        },
        persistPlayerEquipment() {},
        persistPlayerCheckpoint() {},
        persistPlayerAchievementUnlock() {},
        recordPlayerMobKill() {},
        recordPlayerDamageTaken() {},
        recordPlayerRevive() {},
        recordMapTransitionEvent(event: MapTransitionEvent) {
            transitionEvents.push(event);
        },
    };

    const pipeline = new WorldEcsCommandPipeline(host as never);
    seedPlayer({ pipeline, player: mover, mapId: 'overworld', x: 1, y: 1 });
    seedPlayer({ pipeline, player: sourceObserver, mapId: 'overworld', x: 1, y: 2 });
    seedPlayer({ pipeline, player: targetObserver, mapId: 'house', x: 2, y: 1 });

    pipeline.tick();
    delivered.set(sourceObserver.id, []);
    delivered.set(targetObserver.id, []);

    pipeline.enqueue({
        type: 'MOVE',
        source: { connectionId: 'c1', playerId: mover.id },
        to: gridPos(2, 1),
    });

    pipeline.tick();
    for (let i = 0; i < 12; i += 1) {
        pipeline.tick();
    }

    expect(pipeline.MapId.store.get(mover.id)).toBe('house');
    expect(pipeline.Position.store.get(mover.id)).toEqual(gridPos(1, 1));

    const sourceMessages = delivered.get(sourceObserver.id) ?? [];
    const targetMessages = delivered.get(targetObserver.id) ?? [];
    expect(
        hasPlayerMessage(
            sourceMessages,
            (msg) => Array.isArray(msg) && msg[0] === Types.Messages.DESPAWN && msg[1] === mover.id
        )
    ).toBe(true);
    expect(
        hasPlayerMessage(
            targetMessages,
            (msg) => Array.isArray(msg) && msg[0] === Types.Messages.SPAWN && msg[1] === mover.id
        )
    ).toBe(true);
    expect(
        transitionEvents.some(
            (event) =>
                event.kind === 'begin'
                && event.playerId === mover.id
                && event.fromMapId === 'overworld'
                && event.toMapId === 'house'
        )
    ).toBe(true);
    expect(
        transitionEvents.some(
            (event) =>
                event.kind === 'commit'
                && event.playerId === mover.id
                && event.fromMapId === 'overworld'
                && event.toMapId === 'house'
        )
    ).toBe(true);
});

test('door transition rejects invalid destination maps/tiles', () => {
    const mover = createTestPlayer(22111, 'mover');
    const maps = {
        overworld: createMap(20, 20),
        house: createMap(6, 6),
    };
    const delivered: WorldMessage[] = [];
    const transitionEvents: MapTransitionEvent[] = [];

    const host = {
        ups: 50,
        map: maps.overworld,
        getDefaultMapId() {
            return 'overworld';
        },
        getMapById(mapId: string) {
            return mapId === 'overworld' ? maps.overworld : mapId === 'house' ? maps.house : null;
        },
        resolveDoorTeleport(mapId: string, x: number, y: number) {
            if (mapId === 'overworld' && x === 2 && y === 1) {
                return { toMapId: 'house', to: gridPos(99, 99) };
            }
            return null;
        },
        isValidPositionForMap(mapId: string, x: number, y: number) {
            const map = mapId === 'overworld' ? maps.overworld : mapId === 'house' ? maps.house : null;
            if (!map) {
                return false;
            }
            return !map.isOutOfBounds(x, y) && !map.isColliding(x, y);
        },
        getConnectionPlayerById(id: number) {
            return id === mover.id ? mover : null;
        },
        removeEntityFromAreas() {},
        scheduleMobRespawn() {},
        scheduleStaticItemRespawn() {},
        addPlayer() {},
        emitPlayerEnter() {},
        isPlayerActive(id: number) {
            return id === mover.id;
        },
        pushSpawnsToPlayerId() {},
        isValidPosition(x: number, y: number) {
            return !maps.overworld.isOutOfBounds(x, y) && !maps.overworld.isColliding(x, y);
        },
        getDroppedItem() {
            return null;
        },
        handleItemDespawn() {},
        removeEntity() {},
        addItemFromChest() {
            return null;
        },
        pushToPlayerId(playerId: number, message: WorldMessage) {
            if (playerId === mover.id) {
                delivered.push(message);
            }
        },
        persistPlayerEquipment() {},
        persistPlayerCheckpoint() {},
        persistPlayerAchievementUnlock() {},
        recordPlayerMobKill() {},
        recordPlayerDamageTaken() {},
        recordPlayerRevive() {},
        recordMapTransitionEvent(event: MapTransitionEvent) {
            transitionEvents.push(event);
        },
    };

    const pipeline = new WorldEcsCommandPipeline(host as never);
    seedPlayer({ pipeline, player: mover, mapId: 'overworld', x: 1, y: 1 });

    pipeline.enqueue({
        type: 'MOVE',
        source: { connectionId: 'c1', playerId: mover.id },
        to: gridPos(2, 1),
    });

    pipeline.tick();
    for (let i = 0; i < 12; i += 1) {
        pipeline.tick();
    }

    expect(pipeline.MapId.store.get(mover.id)).toBe('overworld');
    expect(pipeline.Position.store.get(mover.id)).toEqual(gridPos(2, 1));
    expect(
        hasPlayerMessage(
            delivered,
            (msg) => Array.isArray(msg) && msg[0] === Types.Messages.TELEPORT && msg[1] === mover.id
        )
    ).toBe(false);
    expect(
        transitionEvents.some(
            (event) =>
                event.kind === 'reject'
                && event.reason === 'invalid_destination'
                && event.playerId === mover.id
                && event.fromMapId === 'overworld'
                && event.toMapId === 'house'
        )
    ).toBe(true);
});

test('door transition remains stable across repeated map threshold crossings', () => {
    const mover = createTestPlayer(22121, 'mover');
    const maps = {
        overworld: createMap(20, 20),
        house: createMap(20, 20),
    };
    const transitionEvents: MapTransitionEvent[] = [];

    const host = {
        ups: 50,
        map: maps.overworld,
        getDefaultMapId() {
            return 'overworld';
        },
        getMapById(mapId: string) {
            return mapId === 'overworld' ? maps.overworld : mapId === 'house' ? maps.house : null;
        },
        resolveDoorTeleport(mapId: string, x: number, y: number) {
            if (x !== 2 || y !== 1) {
                return null;
            }
            if (mapId === 'overworld') {
                return { toMapId: 'house', to: gridPos(3, 1) };
            }
            if (mapId === 'house') {
                return { toMapId: 'overworld', to: gridPos(1, 1) };
            }
            return null;
        },
        isValidPositionForMap(mapId: string, x: number, y: number) {
            const map = mapId === 'overworld' ? maps.overworld : mapId === 'house' ? maps.house : null;
            if (!map) {
                return false;
            }
            return !map.isOutOfBounds(x, y) && !map.isColliding(x, y);
        },
        getConnectionPlayerById(id: number) {
            return id === mover.id ? mover : null;
        },
        removeEntityFromAreas() {},
        scheduleMobRespawn() {},
        scheduleStaticItemRespawn() {},
        addPlayer() {},
        emitPlayerEnter() {},
        isPlayerActive(id: number) {
            return id === mover.id;
        },
        pushSpawnsToPlayerId() {},
        isValidPosition(x: number, y: number) {
            return !maps.overworld.isOutOfBounds(x, y) && !maps.overworld.isColliding(x, y);
        },
        getDroppedItem() {
            return null;
        },
        handleItemDespawn() {},
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
        recordMapTransitionEvent(event: MapTransitionEvent) {
            transitionEvents.push(event);
        },
    };

    const pipeline = new WorldEcsCommandPipeline(host as never);
    seedPlayer({ pipeline, player: mover, mapId: 'overworld', x: 1, y: 1 });

    let currentMapId = pipeline.MapId.store.get(mover.id);
    expect(currentMapId).toBe('overworld');

    const transitions = 24;
    for (let i = 0; i < transitions; i += 1) {
        pipeline.enqueue({
            type: 'MOVE',
            source: { connectionId: 'c-repeat', playerId: mover.id },
            to: gridPos(2, 1),
        });
        pipeline.tick();
        for (let j = 0; j < 8; j += 1) {
            pipeline.tick();
        }
        const nextMapId = pipeline.MapId.store.get(mover.id);
        expect(nextMapId === 'overworld' || nextMapId === 'house').toBe(true);
        expect(nextMapId).not.toBe(currentMapId);
        currentMapId = nextMapId;
    }

    expect(transitionEvents.filter((event) => event.kind === 'begin')).toHaveLength(transitions);
    expect(transitionEvents.filter((event) => event.kind === 'commit')).toHaveLength(transitions);
    expect(transitionEvents.filter((event) => event.kind === 'reject')).toHaveLength(0);
});
