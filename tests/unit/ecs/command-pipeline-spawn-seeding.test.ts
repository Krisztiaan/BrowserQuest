import { expect, test } from 'bun:test';
import Types from '../../../shared/gametypes-browser';
import { entityIdFromWire } from '../../../shared/domain/ids';
import { gridPos } from '../../../shared/domain/positions';
import { WorldEcsCommandPipeline } from '../../../server/world/ecs-command-pipeline';
import { requireMobPrefab } from '../../../shared/content/prefabs';

function createPipelineFixture(): WorldEcsCommandPipeline {
    const host = {
        ups: 5,
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
        getConnectionPlayerById() {
            return null;
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
            return false;
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

    return new WorldEcsCommandPipeline(host as never);
}

test('seedItemFromSpawn sets replication Kind + Position', () => {
    const pipeline = createPipelineFixture();
    const itemId = entityIdFromWire(901);
    pipeline.seedItemFromSpawn({ id: itemId, kind: Types.Entities.AXE, x: 5, y: 6 });

    expect(pipeline.replication.Kind.store.get(itemId)).toBe(Types.Entities.AXE);
    expect(pipeline.Position.store.get(itemId)).toEqual(gridPos(5, 6));
});

test('seedMobFromPrefabSpawn sets replication, spawn pos, and combat stats from prefabs', () => {
    const pipeline = createPipelineFixture();
    const mobId = entityIdFromWire(701);
    pipeline.seedMobFromPrefabSpawn({
        id: mobId,
        kind: Types.Entities.SKELETON,
        x: 10,
        y: 11,
        spawnX: 1,
        spawnY: 2,
    });

    expect(pipeline.replication.Kind.store.get(mobId)).toBe(Types.Entities.SKELETON);
    expect(pipeline.Position.store.get(mobId)).toEqual(gridPos(10, 11));
    expect(pipeline.mobAi.MobSpawnPos.store.get(mobId)).toEqual(gridPos(1, 2));
    expect(typeof pipeline.replication.Orientation.store.get(mobId)).toBe('number');

    const prefab = requireMobPrefab(Types.Entities.SKELETON);
    expect(pipeline.combat.MaxHitPoints.store.get(mobId)).toBe(prefab.combat.maxHitPoints);
    expect(pipeline.combat.HitPoints.store.get(mobId)).toBe(prefab.combat.maxHitPoints);
    expect(pipeline.combat.ArmorLevel.store.get(mobId)).toBe(prefab.combat.armorLevel);
    expect(pipeline.combat.WeaponLevel.store.get(mobId)).toBe(prefab.combat.weaponLevel);
});
