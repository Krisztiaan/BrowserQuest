import { expect, test } from 'bun:test';
import Types from '../../../shared/gametypes-browser';
import { entityIdFromWire } from '../../../shared/domain/ids';
import { gridPos } from '../../../shared/domain/positions';
import Player from '../../../server/player';
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

test('OPEN uses ECS chest loot table + ECS Position (not legacy fields)', () => {
    const player = createTestPlayer(100);
    const chest = {
        id: entityIdFromWire(900),
        kind: Types.Entities.CHEST,
        x: 10,
        y: 10,
        items: [Types.Entities.SWORD1],
    };

    const entities = new Map<number, unknown>([
        [player.id, player],
        [chest.id, chest],
    ]);

    const removed: number[] = [];
    const spawned: Array<{ kind: unknown; x: number; y: number }> = [];
    const despawnScheduled: unknown[] = [];

    const host: Record<string, unknown> = {
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
        handleItemDespawn(item: unknown) {
            despawnScheduled.push(item);
        },
        moveEntity() {},
        removeEntity() {},
        addItemFromChest(kind: unknown, x: number, y: number) {
            spawned.push({ kind, x, y });
            return { id: entityIdFromWire(901) };
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
    (host as { removeEntity: (entity: unknown) => void }).removeEntity = (entity: unknown) => {
        const id = (entity as { id: number }).id;
        removed.push(id);
        entities.delete(id);
        pipeline.removeEntity(id);
    };
    pipeline.syncSpawnReplicationEntity(player);
    pipeline.syncSpawnReplicationEntity(chest);

    // Ensure OPEN reads the drop from ECS state, not the legacy `items` field.
    pipeline.state.world.addComponent(chest.id, pipeline.chests.ChestLootTable, {
        items: [Types.Entities.AXE],
    });

    // Ensure OPEN reads the drop position from ECS Position, not the legacy `x/y` fields.
    pipeline.state.world.addComponent(chest.id, pipeline.Position, gridPos(5, 6));

    pipeline.enqueue({
        type: 'OPEN',
        source: { connectionId: String(player.id), playerId: player.id },
        chestId: chest.id,
    });
    pipeline.tick();

    expect(pipeline.state.world.entities.isAlive(chest.id)).toBe(false);
    expect(spawned).toEqual([{ kind: Types.Entities.AXE, x: 5, y: 6 }]);
    expect(despawnScheduled.length).toBe(1);
});
