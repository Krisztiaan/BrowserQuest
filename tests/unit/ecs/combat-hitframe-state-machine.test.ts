import { expect, test } from 'bun:test';
import Types from '../../../shared/gametypes-browser';
import { entityIdFromWire } from '../../../shared/domain/ids';
import { gridPos } from '../../../shared/domain/positions';
import { WorldEcsCommandPipeline } from '../../../server/world/ecs-command-pipeline';

function createPipelineFixture() {
    const player = {
        id: entityIdFromWire(7001),
        x: 0,
        y: 0,
        kind: Types.Entities.WARRIOR,
        name: 'test',
        armor: Types.Entities.CLOTHARMOR,
        weapon: Types.Entities.SWORD1,
        emit() {},
        setPosition(x: number, y: number) {
            player.x = x;
            player.y = y;
        },
        setTarget(_entity: { id: number }) {},
        clearTarget() {},
    };

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
    pipeline.state.world.addComponent(player.id, pipeline.replication.Kind, player.kind);
    pipeline.state.world.addComponent(player.id, pipeline.Position, gridPos(0, 0));
    pipeline.state.world.addComponent(player.id, pipeline.combat.WeaponLevel, 10);

    return { pipeline, player };
}

test('combat applies damage at hit-frame (not on windup start)', () => {
    const { pipeline, player } = createPipelineFixture();

    const mobId = entityIdFromWire(9001);
    pipeline.state.world.ensureEntity(mobId);
    pipeline.state.world.addComponent(mobId, pipeline.replication.Kind, Types.Entities.RAT);
    pipeline.state.world.addComponent(mobId, pipeline.Position, gridPos(1, 0));
    pipeline.state.world.addComponent(mobId, pipeline.combat.ArmorLevel, 1);
    pipeline.state.world.addComponent(mobId, pipeline.combat.HitPoints, 1000);

    pipeline.state.world.addComponent(player.id, pipeline.replication.Target, mobId);

    pipeline.tick(); // schedules windup

    expect(pipeline.combat.HitPoints.store.get(mobId)).toBe(1000);
    const windup = pipeline.combat.AttackWindup.store.get(player.id);
    expect(windup).toBeDefined();

    const hitAtTick = windup?.hitAtTick ?? 0;
    while (pipeline.getTick() <= hitAtTick) {
        pipeline.tick();
    }

    expect(pipeline.combat.HitPoints.store.get(mobId) ?? 0).toBeLessThan(1000);
});

test('combat cancels pending swing if target leaves range during windup', () => {
    const { pipeline, player } = createPipelineFixture();

    const mobId = entityIdFromWire(9002);
    pipeline.state.world.ensureEntity(mobId);
    pipeline.state.world.addComponent(mobId, pipeline.replication.Kind, Types.Entities.RAT);
    pipeline.state.world.addComponent(mobId, pipeline.Position, gridPos(1, 0));
    pipeline.state.world.addComponent(mobId, pipeline.combat.ArmorLevel, 1);
    pipeline.state.world.addComponent(mobId, pipeline.combat.HitPoints, 1000);

    pipeline.state.world.addComponent(player.id, pipeline.replication.Target, mobId);

    pipeline.tick(); // schedules windup
    const windup = pipeline.combat.AttackWindup.store.get(player.id);
    expect(windup).toBeDefined();
    const hitAtTick = windup?.hitAtTick ?? 0;

    pipeline.state.world.addComponent(mobId, pipeline.Position, gridPos(10, 10));
    pipeline.tick(); // out-of-range during windup -> cancel
    expect(pipeline.combat.AttackWindup.store.has(player.id)).toBe(false);

    while (pipeline.getTick() <= hitAtTick + 2) {
        pipeline.tick();
    }

    expect(pipeline.combat.HitPoints.store.get(mobId)).toBe(1000);
});

test('combat clears pending swing if target dies/despawns during windup', () => {
    const { pipeline, player } = createPipelineFixture();

    const mobId = entityIdFromWire(9003);
    pipeline.state.world.ensureEntity(mobId);
    pipeline.state.world.addComponent(mobId, pipeline.replication.Kind, Types.Entities.RAT);
    pipeline.state.world.addComponent(mobId, pipeline.Position, gridPos(1, 0));
    pipeline.state.world.addComponent(mobId, pipeline.combat.ArmorLevel, 1);
    pipeline.state.world.addComponent(mobId, pipeline.combat.HitPoints, 1000);

    pipeline.state.world.addComponent(player.id, pipeline.replication.Target, mobId);

    pipeline.tick(); // schedules windup
    expect(pipeline.combat.AttackWindup.store.has(player.id)).toBe(true);

    pipeline.state.world.destroyEntity(mobId);
    pipeline.tick();

    expect(pipeline.combat.AttackWindup.store.has(player.id)).toBe(false);
    expect(pipeline.replication.Target.store.has(player.id)).toBe(false);
});

test('ATTACK commands drive server-authoritative hit-frame combat', () => {
    const { pipeline, player } = createPipelineFixture();

    const mobId = entityIdFromWire(9004);
    pipeline.state.world.ensureEntity(mobId);
    pipeline.state.world.addComponent(mobId, pipeline.replication.Kind, Types.Entities.RAT);
    pipeline.state.world.addComponent(mobId, pipeline.Position, gridPos(1, 0));
    pipeline.state.world.addComponent(mobId, pipeline.combat.ArmorLevel, 1);
    pipeline.state.world.addComponent(mobId, pipeline.combat.HitPoints, 1000);

    pipeline.enqueue({
        type: 'ATTACK',
        source: { connectionId: 'test', playerId: player.id },
        targetId: mobId,
    });

    pipeline.tick(); // apply ATTACK -> Target + windup (no damage yet)
    expect(pipeline.replication.Target.store.get(player.id)).toBe(mobId);
    expect(pipeline.combat.HitPoints.store.get(mobId)).toBe(1000);

    const windup = pipeline.combat.AttackWindup.store.get(player.id);
    expect(windup).toBeDefined();

    const hitAtTick = windup?.hitAtTick ?? 0;
    while (pipeline.getTick() <= hitAtTick) {
        pipeline.tick();
    }

    expect(pipeline.combat.HitPoints.store.get(mobId) ?? 0).toBeLessThan(1000);
});
