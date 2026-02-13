import { expect, test } from 'bun:test';
import Types from '../../../shared/gametypes-browser';
import { entityIdFromWire } from '../../../shared/domain/ids';
import { gridPos } from '../../../shared/domain/positions';
import Player from '../../../server/player';
import Mob from '../../../server/mob';
import { WorldEcsCommandPipeline } from '../../../server/world/ecs-command-pipeline';

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

function seedEntity(
    pipeline: WorldEcsCommandPipeline,
    entity: Readonly<{
        id: number;
        kind: number;
        x: number;
        y: number;
        hitPoints?: number;
        maxHitPoints?: number;
        armorLevel?: number;
        weaponLevel?: number;
    }>
): void {
    pipeline.state.world.ensureEntity(entity.id);
    pipeline.state.world.addComponent(entity.id, pipeline.replication.Kind, entity.kind);
    pipeline.state.world.addComponent(entity.id, pipeline.Position, gridPos(entity.x, entity.y));
    pipeline.syncCombatEntity(entity);
}

function createPipelineFixture({
    player,
    entities,
    isValidPosition,
}: {
    player: Player;
    entities: Map<number, unknown>;
    isValidPosition: (x: number, y: number) => boolean;
}): { pipeline: WorldEcsCommandPipeline; delivered: unknown[] } {
    const delivered: unknown[] = [];

    const host: Record<string, unknown> = {
        ups: 5,
        map: {
            getCheckpoint() {
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
        getEntityById(id: number) {
            return entities.get(id) ?? null;
        },
        addPlayer() {},
        emit() {},
        isPlayerActive(id: number) {
            return id === player.id;
        },
        pushSpawnsToPlayerId() {},
        isValidPosition,
        getDroppedItem() {
            return null;
        },
        handleItemDespawn() {},
        moveEntity(entity: unknown, x: number, y: number) {
            (entity as { setPosition: (nextX: number, nextY: number) => void }).setPosition(x, y);
        },
        addItemFromChest() {
            return null;
        },
        pushToPlayerId(playerId: number, message: unknown) {
            if (playerId === player.id) {
                delivered.push(message);
            }
        },
    };

    const pipeline = new WorldEcsCommandPipeline(host as never);
    (host as unknown as { removeEntity: (entity: unknown) => void }).removeEntity = (entity: unknown) => {
        const id = (entity as { id: number }).id;
        entities.delete(id);
        pipeline.removeEntity(id);
    };

    return { pipeline, delivered };
}

test('server mob_ai steps toward target and stops when adjacent', () => {
    const player = createTestPlayer(100);
    player.setPosition(2, 0);

    const mobId = entityIdFromWire(7);
    const mob = new Mob(mobId, Types.Entities.RAT, 0, 0);

    const entities = new Map<number, unknown>([
        [player.id, player],
        [mob.id, mob],
    ]);

    const { pipeline } = createPipelineFixture({
        player,
        entities,
        isValidPosition: (x, y) => Number.isInteger(x) && Number.isInteger(y),
    });

    seedEntity(pipeline, player);
    seedEntity(pipeline, mob);
    pipeline.state.world.addComponent(mob.id, pipeline.mobAi.MobHate, {
        entries: [{ id: player.id, hate: 5 }],
    });

    pipeline.tick();
    pipeline.tick();

    const after = pipeline.Position.store.get(mob.id);
    expect(after).toEqual(gridPos(1, 0));

    pipeline.tick();
    const afterAdjacent = pipeline.Position.store.get(mob.id);
    expect(afterAdjacent).toEqual(gridPos(1, 0));
});

test('mob_ai avoids occupied direct lane and picks alternate adjacent approach', () => {
    const player = createTestPlayer(101);
    player.setPosition(2, 3);

    const mobId = entityIdFromWire(8);
    const mob = new Mob(mobId, Types.Entities.RAT, 0, 2);
    const blockingChest = {
        id: entityIdFromWire(900),
        kind: Types.Entities.CHEST,
        x: 1,
        y: 2,
    };

    const entities = new Map<number, unknown>([
        [player.id, player],
        [mob.id, mob],
        [blockingChest.id, blockingChest],
    ]);

    const { pipeline } = createPipelineFixture({
        player,
        entities,
        isValidPosition: (x, y) => Number.isInteger(x) && Number.isInteger(y),
    });

    seedEntity(pipeline, player);
    seedEntity(pipeline, mob);
    seedEntity(pipeline, blockingChest);
    pipeline.state.world.addComponent(mob.id, pipeline.mobAi.MobHate, {
        entries: [{ id: player.id, hate: 5 }],
    });

    pipeline.tick();
    pipeline.tick();

    const after = pipeline.Position.store.get(mob.id);
    expect(after).toEqual(gridPos(0, 3));
    expect(after).not.toEqual(gridPos(blockingChest.x, blockingChest.y));
});

test('mob_ai never steps onto an occupied tile when lane is blocked', () => {
    const player = createTestPlayer(102);
    player.setPosition(2, 1);

    const mobId = entityIdFromWire(9);
    const mob = new Mob(mobId, Types.Entities.RAT, 0, 1);
    const blockingChest = {
        id: entityIdFromWire(901),
        kind: Types.Entities.CHEST,
        x: 1,
        y: 1,
    };

    const entities = new Map<number, unknown>([
        [player.id, player],
        [mob.id, mob],
        [blockingChest.id, blockingChest],
    ]);
    const validTiles = new Set(['0,1', '1,1', '2,1']);

    const { pipeline } = createPipelineFixture({
        player,
        entities,
        isValidPosition: (x, y) => validTiles.has(`${x},${y}`),
    });

    seedEntity(pipeline, player);
    seedEntity(pipeline, mob);
    seedEntity(pipeline, blockingChest);
    pipeline.state.world.addComponent(mob.id, pipeline.mobAi.MobHate, {
        entries: [{ id: player.id, hate: 5 }],
    });

    pipeline.tick();
    pipeline.tick();

    const after = pipeline.Position.store.get(mob.id);
    expect(after).toEqual(gridPos(0, 1));
});

test('mob_ai repaths every tick under movement churn (no long chase stall)', () => {
    const player = createTestPlayer(103);
    player.setPosition(4, 0);

    const mobId = entityIdFromWire(10);
    const mob = new Mob(mobId, Types.Entities.RAT, 0, 0);
    const entities = new Map<number, unknown>([
        [player.id, player],
        [mob.id, mob],
    ]);

    const { pipeline } = createPipelineFixture({
        player,
        entities,
        isValidPosition: (x, y) => Number.isInteger(x) && Number.isInteger(y),
    });

    seedEntity(pipeline, player);
    seedEntity(pipeline, mob);
    pipeline.state.world.addComponent(mob.id, pipeline.mobAi.MobHate, {
        entries: [{ id: player.id, hate: 5 }],
    });

    pipeline.tick();
    pipeline.tick();
    const afterFirstChaseTick = pipeline.Position.store.get(mob.id);
    expect(afterFirstChaseTick).toEqual(gridPos(1, 0));

    player.setPosition(4, 2);
    pipeline.state.world.addComponent(player.id, pipeline.Position, gridPos(player.x, player.y));

    pipeline.tick();
    const afterSecondChaseTick = pipeline.Position.store.get(mob.id);
    expect(afterSecondChaseTick).not.toEqual(afterFirstChaseTick);

    const dist1 = Math.abs((afterFirstChaseTick?.x ?? 0) - 4) + Math.abs((afterFirstChaseTick?.y ?? 0) - 2);
    const dist2 = Math.abs((afterSecondChaseTick?.x ?? 0) - 4) + Math.abs((afterSecondChaseTick?.y ?? 0) - 2);
    expect(dist2).toBeLessThan(dist1);
});

test('server-authoritative combat kills mob on ATTACK and emits DESPAWN', () => {
    const player = createTestPlayer(104);
    player.setPosition(5, 5);
    player.weaponLevel = 1;

    const mobId = entityIdFromWire(11);
    const mob = new Mob(mobId, Types.Entities.RAT, 6, 5);
    mob.armorLevel = 0;
    mob.maxHitPoints = 1;
    mob.hitPoints = 1;

    const entities = new Map<number, unknown>([
        [player.id, player],
        [mob.id, mob],
    ]);
    const { pipeline, delivered } = createPipelineFixture({
        player,
        entities,
        isValidPosition: () => true,
    });

    seedEntity(pipeline, player);
    seedEntity(pipeline, mob);
    pipeline.enqueue({
        type: 'ATTACK',
        source: { connectionId: 'c', playerId: player.id },
        targetId: mob.id,
    });

    pipeline.tick();

    const hasDespawn = delivered.some(
        (msg) => Array.isArray(msg) && msg[0] === Types.Messages.DESPAWN && msg[1] === mob.id
    );
    expect(hasDespawn).toBe(true);
    expect(entities.has(mob.id)).toBe(false);
});

test('server-authoritative combat enforces cooldown between consecutive hits', () => {
    const player = createTestPlayer(105);
    player.setPosition(5, 5);
    player.weaponLevel = 1;

    const mobId = entityIdFromWire(12);
    const mob = new Mob(mobId, Types.Entities.RAT, 6, 5);
    mob.armorLevel = 0;
    mob.maxHitPoints = 100;
    mob.hitPoints = 100;

    const entities = new Map<number, unknown>([
        [player.id, player],
        [mob.id, mob],
    ]);
    const { pipeline } = createPipelineFixture({
        player,
        entities,
        isValidPosition: () => true,
    });

    seedEntity(pipeline, player);
    seedEntity(pipeline, mob);
    pipeline.enqueue({
        type: 'ATTACK',
        source: { connectionId: 'c', playerId: player.id },
        targetId: mob.id,
    });

    pipeline.tick();
    const hpAfterFirstHit = pipeline.combat.HitPoints.store.get(mob.id) ?? 0;
    expect(hpAfterFirstHit).toBeLessThan(100);

    pipeline.tick();
    pipeline.tick();
    pipeline.tick();
    const hpBeforeCooldownExpires = pipeline.combat.HitPoints.store.get(mob.id) ?? 0;
    expect(hpBeforeCooldownExpires).toBe(hpAfterFirstHit);

    pipeline.tick();
    const hpAfterCooldownExpires = pipeline.combat.HitPoints.store.get(mob.id) ?? 0;
    expect(hpAfterCooldownExpires).toBeLessThan(hpAfterFirstHit);
});

test('server-authoritative combat rejects out-of-range ATTACK damage', () => {
    const player = createTestPlayer(106);
    player.setPosition(0, 0);
    player.weaponLevel = 1;

    const mobId = entityIdFromWire(13);
    const mob = new Mob(mobId, Types.Entities.RAT, 10, 10);
    mob.armorLevel = 0;
    mob.maxHitPoints = 100;
    mob.hitPoints = 100;

    const entities = new Map<number, unknown>([
        [player.id, player],
        [mob.id, mob],
    ]);
    const { pipeline } = createPipelineFixture({
        player,
        entities,
        isValidPosition: () => true,
    });

    seedEntity(pipeline, player);
    seedEntity(pipeline, mob);
    pipeline.enqueue({
        type: 'ATTACK',
        source: { connectionId: 'c', playerId: player.id },
        targetId: mob.id,
    });

    pipeline.tick();
    const hpAfterAttack = pipeline.combat.HitPoints.store.get(mob.id) ?? 0;
    expect(hpAfterAttack).toBe(100);
});

test('respawn task queue emits mob respawn event on schedule', () => {
    const player = createTestPlayer(107);
    const mobId = entityIdFromWire(14);
    const mob = new Mob(mobId, Types.Entities.RAT, 10, 10);
    const entities = new Map<number, unknown>([
        [player.id, player],
        [mob.id, mob],
    ]);

    const { pipeline } = createPipelineFixture({
        player,
        entities,
        isValidPosition: () => true,
    });

    let respawned = false;
    mob.on('respawn', () => {
        respawned = true;
    });

    pipeline.scheduleStaticRespawn(mob, 0);
    pipeline.tick();

    expect(respawned).toBe(true);
});

test('server-authoritative combat tolerates stale target links after same-tick kill', () => {
    const playerA = createTestPlayer(108);
    playerA.setPosition(5, 5);
    playerA.weaponLevel = 100;

    const playerB = createTestPlayer(109);
    playerB.setPosition(7, 5);
    playerB.weaponLevel = 100;

    const mobId = entityIdFromWire(15);
    const mob = new Mob(mobId, Types.Entities.RAT, 6, 5);
    mob.armorLevel = 0;
    mob.maxHitPoints = 1;
    mob.hitPoints = 1;

    const entities = new Map<number, unknown>([
        [playerA.id, playerA],
        [playerB.id, playerB],
        [mob.id, mob],
    ]);
    const { pipeline } = createPipelineFixture({
        player: playerA,
        entities,
        isValidPosition: () => true,
    });

    seedEntity(pipeline, playerA);
    seedEntity(pipeline, playerB);
    seedEntity(pipeline, mob);

    pipeline.enqueue({
        type: 'ATTACK',
        source: { connectionId: 'c-a', playerId: playerA.id },
        targetId: mob.id,
    });
    pipeline.enqueue({
        type: 'ATTACK',
        source: { connectionId: 'c-b', playerId: playerB.id },
        targetId: mob.id,
    });

    pipeline.tick();

    expect(pipeline.state.world.entities.isAlive(mob.id)).toBe(false);
    expect(pipeline.replication.Target.store.has(playerA.id)).toBe(false);
    expect(pipeline.replication.Target.store.has(playerB.id)).toBe(false);
});
