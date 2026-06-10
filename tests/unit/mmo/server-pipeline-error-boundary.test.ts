import { expect, test } from 'bun:test';
import Types from '../../../shared/gametypes-browser';
import Player from '../../../server/player';
import { gridPos } from '../../../shared/domain/positions';
import { tileToWorldPosCenter } from '../../../shared/world/worldpos';
import { WorldEcsCommandPipeline } from '../../../server/world/ecs-command-pipeline';
import { Scheduler } from '../../../server/ecs/scheduler';
import { WorldState } from '../../../server/ecs/world-state';

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
    player.setPosition(4, 5);
    return player;
}

function createHost(player: Player, overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
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
        pushToPlayerId() {},
        persistPlayerEquipment() {},
        persistPlayerCheckpoint() {},
        persistPlayerAchievementUnlock() {},
        recordPlayerMobKill() {},
        recordPlayerDamageTaken() {},
        recordPlayerRevive() {},
        ...overrides,
    };
}

test('a throwing command handler is isolated: the world keeps processing later commands', () => {
    const player = createTestPlayer(31301);
    const host = createHost(player, {
        pushSpawnsToPlayerId() {
            throw new Error('boom: poisoned WHO handler');
        },
    });

    const pipeline = new WorldEcsCommandPipeline(host as never);
    pipeline.state.world.ensureEntity(player.id);
    pipeline.state.world.addComponent(player.id, pipeline.replication.Kind, Types.Entities.WARRIOR);
    pipeline.state.world.addComponent(player.id, pipeline.Position, gridPos(4, 5));
    pipeline.state.world.addComponent(player.id, pipeline.PositionSub, tileToWorldPosCenter(4, 5));
    pipeline.state.world.addComponent(player.id, pipeline.combat.HitPoints, 100);
    pipeline.state.world.addComponent(player.id, pipeline.combat.MaxHitPoints, 100);

    // WHO triggers the poisoned host method; the MOVE after it must still apply.
    pipeline.enqueue({ type: 'WHO', source: { connectionId: 'c', playerId: player.id }, entityIds: [player.id] });
    pipeline.enqueue({ type: 'MOVE', source: { connectionId: 'c', playerId: player.id }, to: gridPos(5, 5) });

    expect(() => {
        pipeline.tick();
        for (let i = 0; i < 12; i += 1) {
            pipeline.tick();
        }
    }).not.toThrow();
    expect(pipeline.Position.store.get(player.id)).toEqual(gridPos(5, 5));
});

test('a throwing system is isolated per tick and later systems still run', () => {
    const scheduler = new Scheduler<never, never>();
    const calls: string[] = [];
    const errors: Array<{ name: string; error: unknown }> = [];
    const schedulerWithHook = new Scheduler<never, never>({
        hooks: {
            onSystemError(_stage, name, error) {
                errors.push({ name, error });
            },
        },
    });
    schedulerWithHook.register('sim', 'explodes', () => {
        calls.push('explodes');
        throw new Error('system boom');
    });
    schedulerWithHook.register('sim', 'survives', () => {
        calls.push('survives');
    });

    const state = new WorldState<never, never>();
    expect(() => schedulerWithHook.tick(state, 1)).not.toThrow();
    expect(calls).toEqual(['explodes', 'survives']);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.name).toBe('explodes');

    // default behavior (no hook) also isolates
    scheduler.register('sim', 'explodes', () => {
        throw new Error('system boom');
    });
    expect(() => scheduler.tick(state, 1)).not.toThrow();
});
