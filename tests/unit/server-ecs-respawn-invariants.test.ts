import { expect, test } from 'bun:test';
import { entityIdFromWire } from '../../shared/domain/ids';
import { gridPos } from '../../shared/domain/positions';
import Types from '../../shared/gametypes-browser';
import { WorldEcsCommandPipeline } from '../../server/world/ecs-command-pipeline';

function createPlayerLike(playerId: number) {
    const player = {
        id: entityIdFromWire(playerId),
        x: 1,
        y: 1,
        kind: Types.Entities.WARRIOR,
        name: 'test',
        orientation: Types.Orientations.DOWN,
        armor: Types.Entities.CLOTHARMOR,
        weapon: Types.Entities.SWORD1,
        armorLevel: 1,
        weaponLevel: 1,
        maxHitPoints: 100,
        hitPoints: 50,
        hasEnteredGame: true,
        isDead: false,
        lastCheckpoint: null,
        updatePosition() {},
        setPosition(x: number, y: number) {
            player.x = x;
            player.y = y;
        },
        setTarget(_entity: { id: number }) {},
        clearTarget() {},
        emit(_eventName: 'zone' | 'move' | 'lootMove', _x?: number, _y?: number) {},
    };
    return player;
}

function createWorldHostStub() {
    const scheduled = {
        mobs: [] as Array<{ mobId: number; kind: number; spawn: { x: number; y: number } }>,
        items: [] as Array<{ itemId: number; kind: number; spawn: { x: number; y: number }; tickNow?: number }>,
    };
    const pushed: unknown[] = [];
    const player = createPlayerLike(7001);

    const world = {
        ups: 50,
        map: {
            getCheckpoint(_id: string | number) {
                return null;
            },
            isDoor() {
                return false;
            },
            getDoorDestination() {
                return null;
            },
            getGroupIdFromPosition(_x: number, _y: number) {
                return '0-0';
            },
            forEachAdjacentGroup(_groupId: string | null | undefined, callback: (groupId: string) => void) {
                callback('0-0');
            },
        },
        getConnectionPlayerById(id: number) {
            return id === player.id ? player : null;
        },
        removeEntityFromAreas() {},
        scheduleMobRespawn(params: { mobId: number; kind: number; spawn: { x: number; y: number } }) {
            scheduled.mobs.push(params);
        },
        scheduleStaticItemRespawn(params: {
            itemId: number;
            kind: number;
            spawn: { x: number; y: number };
            tickNow?: number;
        }) {
            scheduled.items.push(params);
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
        pushToPlayerId(_playerId: number, message: unknown) {
            pushed.push(message);
        },
        persistPlayerEquipment() {},
        persistPlayerCheckpoint() {},
        persistPlayerAchievementUnlock() {},
        recordPlayerMobKill() {},
        recordPlayerDamageTaken() {},
        recordPlayerRevive() {},
    };

    return { world, player, scheduled, pushed };
}

test('LOOT of a static item schedules respawn and destroys the item entity', () => {
    const { world, player, scheduled } = createWorldHostStub();
    const pipeline = new WorldEcsCommandPipeline(world as unknown as never);

    pipeline.state.world.ensureEntity(player.id);
    pipeline.state.world.addComponent(player.id, pipeline.replication.Kind, player.kind);
    pipeline.state.world.addComponent(player.id, pipeline.Position, gridPos(1, 1));
    pipeline.state.world.addComponent(player.id, pipeline.combat.MaxHitPoints, player.maxHitPoints);
    pipeline.state.world.addComponent(player.id, pipeline.combat.HitPoints, player.hitPoints);

    const itemId = entityIdFromWire(9001);
    pipeline.state.world.ensureEntity(itemId);
    pipeline.state.world.addComponent(itemId, pipeline.replication.Kind, Types.Entities.FLASK);
    pipeline.state.world.addComponent(itemId, pipeline.Position, gridPos(5, 5));
    pipeline.state.world.addComponent(itemId, pipeline.items.StaticSpawnPos, gridPos(5, 5));

    pipeline.enqueue({
        type: 'LOOT',
        source: { connectionId: 'conn', playerId: player.id },
        droppedItemId: itemId,
    });

    pipeline.tick();

    expect(scheduled.items.length).toBe(1);
    expect(scheduled.items[0]?.itemId).toBe(itemId);
    expect(pipeline.state.world.entities.isAlive(itemId)).toBe(false);
});

test('mob death schedules ECS respawn without legacy entity lookup', () => {
    const { world, player, scheduled } = createWorldHostStub();
    const pipeline = new WorldEcsCommandPipeline(world as unknown as never);

    pipeline.state.world.ensureEntity(player.id);
    pipeline.state.world.addComponent(player.id, pipeline.replication.Kind, player.kind);
    pipeline.state.world.addComponent(player.id, pipeline.Position, gridPos(1, 1));
    pipeline.state.world.addComponent(player.id, pipeline.replication.Weapon, Types.Entities.SWORD1);
    pipeline.state.world.addComponent(player.id, pipeline.combat.WeaponLevel, 50);
    pipeline.state.world.addComponent(player.id, pipeline.combat.HitPoints, 100);
    pipeline.state.world.addComponent(player.id, pipeline.combat.MaxHitPoints, 100);

    const mobId = entityIdFromWire(710);
    pipeline.state.world.ensureEntity(mobId);
    pipeline.state.world.addComponent(mobId, pipeline.replication.Kind, Types.Entities.RAT);
    pipeline.state.world.addComponent(mobId, pipeline.Position, gridPos(2, 1));
    pipeline.state.world.addComponent(mobId, pipeline.combat.ArmorLevel, 1);
    pipeline.state.world.addComponent(mobId, pipeline.combat.HitPoints, 1);
    pipeline.state.world.addComponent(mobId, pipeline.combat.MaxHitPoints, 1);

    pipeline.state.world.addComponent(player.id, pipeline.replication.Target, mobId);

    for (let i = 0; i < 50 && scheduled.mobs.length === 0; i += 1) {
        pipeline.tick();
    }

    expect(scheduled.mobs.length).toBe(1);
    expect(scheduled.mobs[0]?.mobId).toBe(mobId);
    expect(pipeline.state.world.entities.isAlive(mobId)).toBe(false);
});
