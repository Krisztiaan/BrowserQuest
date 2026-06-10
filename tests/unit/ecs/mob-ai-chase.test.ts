import { expect, test } from 'bun:test';
import Types from '../../../shared/gametypes-browser';
import { entityIdFromWire } from '../../../shared/domain/ids';
import { gridPos } from '../../../shared/domain/positions';
import Player from '../../../server/player';
import MobEntity from '../../../server/world/mob-entity';
import { WorldEcsCommandPipeline } from '../../../server/world/ecs-command-pipeline';
import type { WorldMessage } from '../../../server/world/contracts';

type TestEntity =
    | Readonly<{
          id: number;
          kind: number;
          x: number;
          y: number;
          setPosition?: (nextX: number, nextY: number) => void;
      }>
    | Player
    | MobEntity;

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
    ups,
}: {
    player: Player;
    entities: Map<number, TestEntity>;
    isValidPosition: (x: number, y: number) => boolean;
    ups?: number;
}): { pipeline: WorldEcsCommandPipeline; delivered: WorldMessage[] } {
    const delivered: WorldMessage[] = [];

    const host = {
        ups: typeof ups === 'number' ? ups : 5,
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
        getEntityById(id: number) {
            return entities.get(id) ?? null;
        },
        addPlayer() {},
        emitPlayerEnter() {},
        isPlayerActive(id: number) {
            return id === player.id;
        },
        pushSpawnsToPlayerId() {},
        isValidPosition,
        getDroppedItem() {
            return null;
        },
        handleItemDespawn() {},
        moveEntity(entity: TestEntity, x: number, y: number) {
            if (typeof entity.setPosition === 'function') {
                entity.setPosition(x, y);
            }
        },
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
    (host as { removeEntity: (entity: TestEntity) => void }).removeEntity = (entity: TestEntity) => {
        const id = entity.id;
        entities.delete(id);
        pipeline.removeEntity(id);
    };

    return { pipeline, delivered };
}

test('server mob_ai steps toward target and stops when adjacent', () => {
    const player = createTestPlayer(100);
    player.setPosition(2, 0);

    const mobId = entityIdFromWire(7);
    const mob = new MobEntity(mobId, Types.Entities.RAT, 0, 0);

    const entities = new Map<number, TestEntity>([
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

test('mob_ai respects per-kind movement cooldown at high UPS (no teleport-chase)', () => {
    const player = createTestPlayer(168);
    player.setPosition(10, 0);

    const mobId = entityIdFromWire(2168);
    const mob = new MobEntity(mobId, Types.Entities.SKELETON, 0, 0);

    const entities = new Map<number, TestEntity>([
        [player.id, player],
        [mob.id, mob],
    ]);

    const { pipeline } = createPipelineFixture({
        player,
        entities,
        ups: 50,
        isValidPosition: (x, y) => Number.isInteger(x) && Number.isInteger(y),
    });

    seedEntity(pipeline, player);
    seedEntity(pipeline, mob);
    pipeline.state.world.addComponent(mob.id, pipeline.mobAi.MobHate, {
        entries: [{ id: player.id, hate: 5 }],
    });

    // At high UPS the mob advances continuously in sub-tile increments; it should not "teleport" a full tile
    // in just a couple of ticks.
    pipeline.tick();
    pipeline.tick();
    const afterTwoTicks = pipeline.Position.store.get(mob.id);
    expect(afterTwoTicks).toEqual(gridPos(0, 0));

    // Skeleton moveSpeed is ~350ms per tile; at UPS=50 it should not "skip" multiple tiles in just a few ticks.
    for (let i = 0; i < 20; i += 1) {
        pipeline.tick();
    }
    const afterFirstStep = pipeline.Position.store.get(mob.id);
    expect(afterFirstStep).toEqual(gridPos(1, 0));

    for (let i = 0; i < 20; i += 1) {
        pipeline.tick();
    }
    const afterSecondStep = pipeline.Position.store.get(mob.id);
    expect(afterSecondStep).toEqual(gridPos(2, 0));
});

test('mob_ai avoids occupied direct lane and picks alternate adjacent approach', () => {
    const player = createTestPlayer(101);
    player.setPosition(2, 3);

    const mobId = entityIdFromWire(8);
    const mob = new MobEntity(mobId, Types.Entities.RAT, 0, 2);
    const blockingChest = {
        id: entityIdFromWire(900),
        kind: Types.Entities.CHEST,
        x: 1,
        y: 2,
    };

    const entities = new Map<number, TestEntity>([
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

test('mob_ai treats NPC tiles as occupied (prevents mob/NPC overlap)', () => {
    const player = createTestPlayer(103);
    player.setPosition(2, 3);

    const mobId = entityIdFromWire(10);
    const mob = new MobEntity(mobId, Types.Entities.RAT, 0, 2);
    const blockingNpc = {
        id: entityIdFromWire(902),
        kind: Types.Entities.RICK,
        x: 1,
        y: 2,
    };

    const entities = new Map<number, TestEntity>([
        [player.id, player],
        [mob.id, mob],
        [blockingNpc.id, blockingNpc],
    ]);

    const { pipeline } = createPipelineFixture({
        player,
        entities,
        isValidPosition: (x, y) => Number.isInteger(x) && Number.isInteger(y),
    });

    seedEntity(pipeline, player);
    seedEntity(pipeline, mob);
    seedEntity(pipeline, blockingNpc);
    pipeline.state.world.addComponent(mob.id, pipeline.mobAi.MobHate, {
        entries: [{ id: player.id, hate: 5 }],
    });

    pipeline.tick();
    pipeline.tick();

    const after = pipeline.Position.store.get(mob.id);
    expect(after).toEqual(gridPos(0, 3));
    expect(after).not.toEqual(gridPos(blockingNpc.x, blockingNpc.y));
});

test('mob_ai never steps onto an occupied tile when lane is blocked', () => {
    const player = createTestPlayer(102);
    player.setPosition(2, 1);

    const mobId = entityIdFromWire(9);
    const mob = new MobEntity(mobId, Types.Entities.RAT, 0, 1);
    const blockingChest = {
        id: entityIdFromWire(901),
        kind: Types.Entities.CHEST,
        x: 1,
        y: 1,
    };

    const entities = new Map<number, TestEntity>([
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

test('mob_ai repaths under movement churn (no long chase stall beyond move cooldown)', () => {
    const player = createTestPlayer(103);
    player.setPosition(4, 0);

    const mobId = entityIdFromWire(10);
    const mob = new MobEntity(mobId, Types.Entities.RAT, 0, 0);
    const entities = new Map<number, TestEntity>([
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

    // Movement is cooldown-gated; ensure the mob advances once the move window re-opens.
    pipeline.tick();
    pipeline.tick();
    const afterSecondChaseTick = pipeline.Position.store.get(mob.id);
    expect(afterSecondChaseTick).not.toEqual(afterFirstChaseTick);

    const dist1 = Math.abs((afterFirstChaseTick?.x ?? 0) - 4) + Math.abs((afterFirstChaseTick?.y ?? 0) - 2);
    const dist2 = Math.abs((afterSecondChaseTick?.x ?? 0) - 4) + Math.abs((afterSecondChaseTick?.y ?? 0) - 2);
    expect(dist2).toBeLessThan(dist1);
});

test('mob_ai returns to spawn tile and stops (no pacing oscillation)', () => {
    const player = createTestPlayer(120);
    player.setPosition(999, 999);

    const mobId = entityIdFromWire(1200);
    const mob = new MobEntity(mobId, Types.Entities.RAT, 2, 0);

    const entities = new Map<number, TestEntity>([
        [player.id, player],
        [mob.id, mob],
    ]);

    const { pipeline } = createPipelineFixture({
        player,
        entities,
        ups: 5,
        isValidPosition: (x, y) => y === 0 && x >= 0 && x <= 3,
    });

    seedEntity(pipeline, player);
    seedEntity(pipeline, mob);
    pipeline.state.world.addComponent(mob.id, pipeline.mobAi.MobSpawnPos, gridPos(0, 0));
    pipeline.state.world.addComponent(mob.id, pipeline.mobAi.MobReturnAtTick, 1);

    pipeline.tick(); // ctx.tick === 0 gate
    pipeline.tick(); // tick 1: step toward spawn
    expect(pipeline.Position.store.get(mob.id)).toEqual(gridPos(1, 0));

    pipeline.tick(); // tick 2: cooldown (rat move cooldown ~2 ticks at UPS=5)
    pipeline.tick(); // tick 3: reach spawn
    expect(pipeline.Position.store.get(mob.id)).toEqual(gridPos(0, 0));

    pipeline.tick(); // tick 4: clear return component once at spawn
    expect(pipeline.mobAi.MobReturnAtTick.store.get(mob.id)).toBeUndefined();

    pipeline.tick();
    expect(pipeline.Position.store.get(mob.id)).toEqual(gridPos(0, 0));
});

test('server-authoritative combat kills mob on ATTACK and emits DESPAWN', () => {
    const player = createTestPlayer(104);
    player.setPosition(5, 5);
    player.weaponLevel = 1;

    const mobId = entityIdFromWire(11);
    const mob = new MobEntity(mobId, Types.Entities.RAT, 6, 5);
    mob.armorLevel = 0;
    mob.maxHitPoints = 1;
    mob.hitPoints = 1;

    const entities = new Map<number, TestEntity>([
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

    for (let i = 0; i < 50 && pipeline.state.world.entities.isAlive(mob.id); i += 1) {
        pipeline.tick();
    }

    const hasDespawn = delivered.some(
        (msg) => Array.isArray(msg) && msg[0] === Types.Messages.DESPAWN && msg[1] === mob.id
    );
    expect(hasDespawn).toBe(true);
    expect(pipeline.state.world.entities.isAlive(mob.id)).toBe(false);
});

test('MOVE command emits authoritative self-ack move to player', () => {
    const player = createTestPlayer(166);
    player.setPosition(5, 5);
    const entities = new Map<number, TestEntity>([[player.id, player]]);
    const { pipeline, delivered } = createPipelineFixture({
        player,
        entities,
        isValidPosition: () => true,
    });

    seedEntity(pipeline, player);
    pipeline.enqueue({
        type: 'MOVE',
        source: { connectionId: 'c', playerId: player.id },
        to: gridPos(6, 5),
    });

    pipeline.tick();

    const hasSelfMoveAck = delivered.some(
        (msg) =>
            Array.isArray(msg) && msg[0] === Types.Messages.MOVE && msg[1] === player.id && msg[2] === 6 && msg[3] === 5
    );
    expect(hasSelfMoveAck).toBe(true);
});

test('invalid MOVE command emits corrective self TELEPORT to authoritative player position', () => {
    const player = createTestPlayer(167);
    player.setPosition(5, 5);
    const entities = new Map<number, TestEntity>([[player.id, player]]);
    const { pipeline, delivered } = createPipelineFixture({
        player,
        entities,
        isValidPosition: (x, y) => x === 5 && y === 5,
    });

    seedEntity(pipeline, player);
    pipeline.enqueue({
        type: 'MOVE',
        source: { connectionId: 'c', playerId: player.id },
        to: gridPos(6, 5),
    });

    pipeline.tick();

    const hasCorrectionAck = delivered.some(
        (msg) =>
            Array.isArray(msg) &&
            msg[0] === Types.Messages.TELEPORT &&
            msg[1] === player.id &&
            msg[2] === 5 &&
            msg[3] === 5
    );
    expect(hasCorrectionAck).toBe(true);
    expect(pipeline.Position.store.get(player.id)).toEqual(gridPos(5, 5));
});

test('server queues adjacent MOVE intents and applies them at move cadence', () => {
    const player = createTestPlayer(170);
    player.setPosition(5, 5);
    const entities = new Map<number, TestEntity>([[player.id, player]]);

    const { pipeline, delivered } = createPipelineFixture({
        player,
        entities,
        ups: 50,
        isValidPosition: (x, y) => Number.isInteger(x) && Number.isInteger(y),
    });

    seedEntity(pipeline, player);
    pipeline.enqueue({
        type: 'MOVE',
        source: { connectionId: 'c', playerId: player.id },
        to: gridPos(6, 5),
    });
    pipeline.enqueue({
        type: 'MOVE',
        source: { connectionId: 'c', playerId: player.id },
        to: gridPos(7, 5),
    });

    for (let i = 0; i < 24; i += 1) {
        pipeline.tick();
        const pos = pipeline.Position.store.get(player.id);
        if (pos && pos.x === 6 && pos.y === 5) {
            break;
        }
    }
    expect(pipeline.Position.store.get(player.id)).toEqual(gridPos(6, 5));
    expect(
        delivered.some(
            (msg) =>
                Array.isArray(msg) &&
                msg[0] === Types.Messages.MOVE &&
                msg[1] === player.id &&
                msg[2] === 6 &&
                msg[3] === 5
        )
    ).toBe(true);

    for (let i = 0; i < 48; i += 1) {
        pipeline.tick();
        const pos = pipeline.Position.store.get(player.id);
        if (pos && pos.x === 7 && pos.y === 5) {
            break;
        }
    }
    expect(pipeline.Position.store.get(player.id)).toEqual(gridPos(7, 5));
    expect(
        delivered.some(
            (msg) =>
                Array.isArray(msg) &&
                msg[0] === Types.Messages.MOVE &&
                msg[1] === player.id &&
                msg[2] === 7 &&
                msg[3] === 5
        )
    ).toBe(true);
});

test('server-authoritative combat enforces cooldown between consecutive hits', () => {
    const player = createTestPlayer(105);
    player.setPosition(5, 5);
    player.weaponLevel = 1;

    const mobId = entityIdFromWire(12);
    const mob = new MobEntity(mobId, Types.Entities.RAT, 6, 5);
    mob.armorLevel = 0;
    mob.maxHitPoints = 100;
    mob.hitPoints = 100;

    const entities = new Map<number, TestEntity>([
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
    const hpAfterWindupStart = pipeline.combat.HitPoints.store.get(mob.id) ?? 0;
    expect(hpAfterWindupStart).toBe(100);

    for (let i = 0; i < 50; i += 1) {
        pipeline.tick();
        const hp = pipeline.combat.HitPoints.store.get(mob.id) ?? 0;
        if (hp < 100) {
            break;
        }
    }

    const hpAfterFirstHit = pipeline.combat.HitPoints.store.get(mob.id) ?? 0;
    expect(hpAfterFirstHit).toBeLessThan(100);

    const nextAttackTick = pipeline.combat.NextAttackTick.store.get(player.id) ?? 0;
    const hpAtCooldownStart = pipeline.combat.HitPoints.store.get(mob.id) ?? 0;
    while (pipeline.getTick() < nextAttackTick) {
        pipeline.tick();
        expect(pipeline.combat.HitPoints.store.get(mob.id) ?? 0).toBe(hpAtCooldownStart);
    }

    for (let i = 0; i < 100; i += 1) {
        pipeline.tick();
        const hp = pipeline.combat.HitPoints.store.get(mob.id) ?? 0;
        if (hp < hpAfterFirstHit) {
            break;
        }
    }

    const hpAfterCooldownExpires = pipeline.combat.HitPoints.store.get(mob.id) ?? 0;
    expect(hpAfterCooldownExpires).toBeLessThan(hpAfterFirstHit);
});

test('server-authoritative combat rejects out-of-range ATTACK damage', () => {
    const player = createTestPlayer(106);
    player.setPosition(0, 0);
    player.weaponLevel = 1;

    const mobId = entityIdFromWire(13);
    const mob = new MobEntity(mobId, Types.Entities.RAT, 10, 10);
    mob.armorLevel = 0;
    mob.maxHitPoints = 100;
    mob.hitPoints = 100;

    const entities = new Map<number, TestEntity>([
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
    const hateEntries = pipeline.mobAi.MobHate.store.get(mob.id)?.entries ?? [];
    expect(hateEntries.some((entry) => entry.id === player.id)).toBe(true);
});

test('server-authoritative combat allows extended line reach for large melee weapons', () => {
    const player = createTestPlayer(164);
    player.setPosition(0, 0);
    player.weaponLevel = 10;

    const mobId = entityIdFromWire(2165);
    const mob = new MobEntity(mobId, Types.Entities.RAT, 2, 0);
    mob.armorLevel = 0;
    mob.maxHitPoints = 100;
    mob.hitPoints = 100;

    const entities = new Map<number, TestEntity>([
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
    pipeline.state.world.addComponent(player.id, pipeline.replication.Weapon, Types.Entities.AXE);
    pipeline.enqueue({
        type: 'ATTACK',
        source: { connectionId: 'c', playerId: player.id },
        targetId: mob.id,
    });

    for (let i = 0; i < 50; i += 1) {
        pipeline.tick();
        const hp = pipeline.combat.HitPoints.store.get(mob.id) ?? 0;
        if (hp < 100) {
            break;
        }
    }
    const hpAfterAttack = pipeline.combat.HitPoints.store.get(mob.id) ?? 0;
    expect(hpAfterAttack).toBeLessThan(100);
});

test('extended melee reach stays directional (no diagonal hits)', () => {
    const player = createTestPlayer(165);
    player.setPosition(0, 0);
    player.weaponLevel = 10;

    const mobId = entityIdFromWire(2166);
    const mob = new MobEntity(mobId, Types.Entities.RAT, 1, 1);
    mob.armorLevel = 0;
    mob.maxHitPoints = 100;
    mob.hitPoints = 100;

    const entities = new Map<number, TestEntity>([
        [player.id, player],
        [mob.id, mob],
    ]);
    const { pipeline } = createPipelineFixture({
        player,
        entities,
        // Freeze the mob in place so the only way it can take damage is via an illegal diagonal hit.
        isValidPosition: () => false,
    });

    seedEntity(pipeline, player);
    seedEntity(pipeline, mob);
    pipeline.state.world.addComponent(player.id, pipeline.replication.Weapon, Types.Entities.AXE);
    pipeline.enqueue({
        type: 'ATTACK',
        source: { connectionId: 'c', playerId: player.id },
        targetId: mob.id,
    });

    for (let i = 0; i < 50; i += 1) {
        pipeline.tick();
    }
    const hpAfterAttack = pipeline.combat.HitPoints.store.get(mob.id) ?? 0;
    expect(hpAfterAttack).toBe(100);
});

test('server-authoritative combat rejects out-of-range mob damage', () => {
    const player = createTestPlayer(160);
    player.setPosition(0, 0);
    player.resetHitPoints(100);
    player.armorLevel = 1;

    const mobId = entityIdFromWire(2160);
    const mob = new MobEntity(mobId, Types.Entities.RAT, 10, 10);
    mob.weaponLevel = 5;

    const entities = new Map<number, TestEntity>([
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
    pipeline.state.world.addComponent(mob.id, pipeline.replication.Target, player.id);
    pipeline.state.world.addComponent(mob.id, pipeline.mobAi.MobHate, {
        entries: [{ id: player.id, hate: 5 }],
    });

    pipeline.tick();

    const hpAfterTick = pipeline.combat.HitPoints.store.get(player.id) ?? 0;
    expect(hpAfterTick).toBe(100);
});

test('mob stops dealing damage after player leaves adjacency', () => {
    const player = createTestPlayer(163);
    player.setPosition(0, 0);
    player.resetHitPoints(100);
    player.armorLevel = 1;

    const mobId = entityIdFromWire(2164);
    const mob = new MobEntity(mobId, Types.Entities.RAT, 1, 0);
    mob.weaponLevel = 5;

    const entities = new Map<number, TestEntity>([
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
    pipeline.state.world.addComponent(mob.id, pipeline.replication.Target, player.id);
    pipeline.state.world.addComponent(mob.id, pipeline.mobAi.MobHate, {
        entries: [{ id: player.id, hate: 5 }],
    });

    for (let i = 0; i < 50; i += 1) {
        pipeline.tick();
        const hp = pipeline.combat.HitPoints.store.get(player.id) ?? 0;
        if (hp < 100) {
            break;
        }
    }
    const hpAfterFirstHit = pipeline.combat.HitPoints.store.get(player.id) ?? 0;
    expect(hpAfterFirstHit).toBeLessThan(100);

    player.setPosition(20, 20);
    pipeline.state.world.addComponent(player.id, pipeline.Position, gridPos(20, 20));

    for (let i = 0; i < 8; i += 1) {
        pipeline.tick();
    }

    const hpAfterRetreat = pipeline.combat.HitPoints.store.get(player.id) ?? 0;
    expect(hpAfterRetreat).toBe(hpAfterFirstHit);
});

test('server-authoritative mob damage uses ECS adjacency only', () => {
    const player = createTestPlayer(161);
    player.setPosition(0, 0);
    player.resetHitPoints(100);
    player.armorLevel = 1;

    const mobId = entityIdFromWire(2161);
    const mob = new MobEntity(mobId, Types.Entities.RAT, 1, 0);
    mob.weaponLevel = 5;

    const entities = new Map<number, TestEntity>([
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
    pipeline.state.world.addComponent(mob.id, pipeline.replication.Target, player.id);
    pipeline.state.world.addComponent(mob.id, pipeline.mobAi.MobHate, {
        entries: [{ id: player.id, hate: 5 }],
    });

    player.setPosition(10, 10);
    pipeline.state.world.addComponent(player.id, pipeline.Position, gridPos(0, 0));

    for (let i = 0; i < 50; i += 1) {
        pipeline.tick();
        const hp = pipeline.combat.HitPoints.store.get(player.id) ?? 0;
        if (hp < 100) {
            break;
        }
    }

    const hpAfterTick = pipeline.combat.HitPoints.store.get(player.id) ?? 0;
    expect(hpAfterTick).toBeLessThan(100);
});

test('respawn task queue emits mob respawn event on schedule', () => {
    const player = createTestPlayer(107);
    const mobId = entityIdFromWire(14);
    const mob = new MobEntity(mobId, Types.Entities.RAT, 10, 10);
    const entities = new Map<number, TestEntity>([
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
    const mob = new MobEntity(mobId, Types.Entities.RAT, 6, 5);
    mob.armorLevel = 0;
    mob.maxHitPoints = 1;
    mob.hitPoints = 1;

    const entities = new Map<number, TestEntity>([
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

    for (let i = 0; i < 50 && pipeline.state.world.entities.isAlive(mob.id); i += 1) {
        pipeline.tick();
    }

    expect(pipeline.state.world.entities.isAlive(mob.id)).toBe(false);
    expect(pipeline.replication.Target.store.has(playerA.id)).toBe(false);
    expect(pipeline.replication.Target.store.has(playerB.id)).toBe(false);
});

test('player death clears all mob target links in the same tick', () => {
    const player = createTestPlayer(162);
    player.setPosition(0, 0);
    player.resetHitPoints(1);
    player.armorLevel = 1;

    const aggroMobId = entityIdFromWire(2162);
    const aggroMob = new MobEntity(aggroMobId, Types.Entities.RAT, 1, 0);
    aggroMob.weaponLevel = 5;

    const staleMobId = entityIdFromWire(2163);
    const staleMob = new MobEntity(staleMobId, Types.Entities.RAT, 0, 1);
    staleMob.weaponLevel = 5;

    const entities = new Map<number, TestEntity>([
        [player.id, player],
        [aggroMob.id, aggroMob],
        [staleMob.id, staleMob],
    ]);
    const { pipeline } = createPipelineFixture({
        player,
        entities,
        isValidPosition: () => true,
    });

    seedEntity(pipeline, player);
    seedEntity(pipeline, aggroMob);
    seedEntity(pipeline, staleMob);
    pipeline.state.world.addComponent(aggroMob.id, pipeline.replication.Target, player.id);
    pipeline.state.world.addComponent(aggroMob.id, pipeline.mobAi.MobHate, {
        entries: [{ id: player.id, hate: 5 }],
    });
    pipeline.state.world.addComponent(staleMob.id, pipeline.replication.Target, player.id);

    for (let i = 0; i < 50 && pipeline.state.world.entities.isAlive(player.id); i += 1) {
        pipeline.tick();
    }

    expect(pipeline.state.world.entities.isAlive(player.id)).toBe(false);
    expect(pipeline.replication.Target.store.has(aggroMob.id)).toBe(false);
    expect(pipeline.replication.Target.store.has(staleMob.id)).toBe(false);
});
