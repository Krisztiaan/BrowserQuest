import { expect, test } from 'bun:test';
import Types from '../../../shared/gametypes-browser';
import { entityIdFromWire } from '../../../shared/domain/ids';
import { gridPos } from '../../../shared/domain/positions';
import { WorldEcsCommandPipeline } from '../../../server/world/ecs-command-pipeline';

test('mob→player damage is suppressed when attacker leaves player interest groups during windup', () => {
    const playerId = entityIdFromWire(7001);
    const mobId = entityIdFromWire(8001);

    let includeMobGroup = true;
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
            getGroupIdFromPosition(_x: number, _y: number) {
                return 'player';
            },
            forEachAdjacentGroup(_groupId: string | null | undefined, cb: (groupId: string) => void) {
                cb('player');
                if (includeMobGroup) {
                    cb('mob');
                }
            },
        },
        getConnectionPlayerById() {
            return null;
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

    pipeline.state.world.ensureEntity(playerId);
    pipeline.state.world.addComponent(playerId, pipeline.replication.Kind, Types.Entities.WARRIOR);
    pipeline.state.world.addComponent(playerId, pipeline.Position, gridPos(0, 0));
    pipeline.state.world.addComponent(playerId, pipeline.combat.ArmorLevel, 1);
    pipeline.state.world.addComponent(playerId, pipeline.combat.HitPoints, 100);
    pipeline.state.world.addComponent(playerId, pipeline.combat.MaxHitPoints, 100);

    pipeline.state.world.ensureEntity(mobId);
    pipeline.state.world.addComponent(mobId, pipeline.replication.Kind, Types.Entities.RAT);
    pipeline.state.world.addComponent(mobId, pipeline.Position, gridPos(1, 0));
    pipeline.state.world.addComponent(mobId, pipeline.combat.WeaponLevel, 10);
    pipeline.state.world.addComponent(mobId, pipeline.replication.Target, playerId);
    pipeline.state.world.addComponent(mobId, pipeline.mobAi.MobHate, {
        entries: [{ id: playerId, hate: 5 }],
    });

    // Make group ids differ for visibility checks (player group excludes mob group once includeMobGroup flips).
    host.map.getGroupIdFromPosition = (x: number) => (x === 0 ? 'player' : 'mob');

    pipeline.tick(); // windup should start while visible
    expect(pipeline.combat.AttackWindup.store.has(mobId)).toBe(true);

    includeMobGroup = false; // simulate attacker leaving interest groups during windup
    const hitPointsBefore = pipeline.combat.HitPoints.store.get(playerId) ?? 0;

    for (let i = 0; i < 50; i += 1) {
        pipeline.tick();
    }

    const hitPointsAfter = pipeline.combat.HitPoints.store.get(playerId) ?? 0;
    expect(hitPointsAfter).toBe(hitPointsBefore);
});
