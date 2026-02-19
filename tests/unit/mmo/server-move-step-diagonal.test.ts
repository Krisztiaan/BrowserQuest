import { expect, test } from 'bun:test';
import Types from '../../../shared/gametypes-browser';
import Player from '../../../server/player';
import { gridPos } from '../../../shared/domain/positions';
import { WorldEcsCommandPipeline } from '../../../server/world/ecs-command-pipeline';
import { encodeMoveStepIntentPayload } from '../../../shared/protocol/intents';
import { MOVE_STEP_REJECT_BLOCKED } from '../../../shared/world/movement-intents';
import type { WorldMessage } from '../../../server/world/contracts';

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

function makeHost({
    isValidPosition,
}: {
    isValidPosition: (x: number, y: number) => boolean;
}): {
    host: unknown;
    delivered: WorldMessage[];
    player: Player;
} {
    const player = createTestPlayer(24801);
    player.setPosition(1, 1);

    const delivered: WorldMessage[] = [];
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
        getEntityById() {
            return null;
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
    };

    return { host, delivered, player };
}

test('move.step accepts diagonal steps when corner tiles are walkable', () => {
    const { host, delivered, player } = makeHost({ isValidPosition: () => true });
    const pipeline = new WorldEcsCommandPipeline(host as never);
    pipeline.state.world.ensureEntity(player.id);
    pipeline.state.world.addComponent(player.id, pipeline.replication.Kind, Types.Entities.WARRIOR);
    pipeline.state.world.addComponent(player.id, pipeline.Position, gridPos(1, 1));
    pipeline.state.world.addComponent(player.id, pipeline.combat.HitPoints, 100);
    pipeline.state.world.addComponent(player.id, pipeline.combat.MaxHitPoints, 100);

    const payloadBytes = encodeMoveStepIntentPayload(gridPos(2, 2));
    expect(payloadBytes).toBeTruthy();
    if (!payloadBytes) {
        throw new Error('Failed to encode move.step');
    }

    pipeline.enqueue({
        type: 'INTENT',
        source: { connectionId: 'c', playerId: player.id },
        seq: 1,
        intentTypeId: 'move.step',
        payloadBytes,
    });
    pipeline.tick();

    expect(delivered.some((msg) => Array.isArray(msg) && msg[0] === Types.Messages.ACK && msg[1] === 1)).toBe(true);
    expect(delivered.some((msg) => Array.isArray(msg) && msg[0] === Types.Messages.MOVE && msg[2] === 2 && msg[3] === 2)).toBe(true);
});

test('move.step rejects diagonal corner-cut attempts (blocked orth neighbor)', () => {
    const blocked = new Set(['2,1']);
    const { host, delivered, player } = makeHost({
        isValidPosition: (x, y) => !blocked.has(`${x},${y}`),
    });
    const pipeline = new WorldEcsCommandPipeline(host as never);
    pipeline.state.world.ensureEntity(player.id);
    pipeline.state.world.addComponent(player.id, pipeline.replication.Kind, Types.Entities.WARRIOR);
    pipeline.state.world.addComponent(player.id, pipeline.Position, gridPos(1, 1));
    pipeline.state.world.addComponent(player.id, pipeline.combat.HitPoints, 100);
    pipeline.state.world.addComponent(player.id, pipeline.combat.MaxHitPoints, 100);

    const payloadBytes = encodeMoveStepIntentPayload(gridPos(2, 2));
    expect(payloadBytes).toBeTruthy();
    if (!payloadBytes) {
        throw new Error('Failed to encode move.step');
    }

    pipeline.enqueue({
        type: 'INTENT',
        source: { connectionId: 'c', playerId: player.id },
        seq: 1,
        intentTypeId: 'move.step',
        payloadBytes,
    });
    pipeline.tick();

    expect(delivered.some((msg) => Array.isArray(msg) && msg[0] === Types.Messages.MOVE && msg[2] === 2 && msg[3] === 2)).toBe(false);
    expect(
        delivered.some(
            (msg) =>
                Array.isArray(msg) &&
                msg[0] === Types.Messages.REJECT &&
                msg[1] === 1 &&
                msg[2] === 'move.step' &&
                msg[3] === MOVE_STEP_REJECT_BLOCKED
        )
    ).toBe(true);
});

test('diagonal steps cannot pass through occupied corner tiles (execution-time wait)', () => {
    const { host, delivered, player } = makeHost({ isValidPosition: () => true });
    const pipeline = new WorldEcsCommandPipeline(host as never);
    pipeline.state.world.ensureEntity(player.id);
    pipeline.state.world.addComponent(player.id, pipeline.replication.Kind, Types.Entities.WARRIOR);
    pipeline.state.world.addComponent(player.id, pipeline.Position, gridPos(1, 1));
    pipeline.state.world.addComponent(player.id, pipeline.combat.HitPoints, 100);
    pipeline.state.world.addComponent(player.id, pipeline.combat.MaxHitPoints, 100);

    // Occupy (2,1) so the diagonal (1,1)->(2,2) would "cut past" this tile.
    const mobId = pipeline.state.world.createEntity();
    pipeline.state.world.addComponent(mobId, pipeline.replication.Kind, Types.Entities.RAT);
    pipeline.state.world.addComponent(mobId, pipeline.Position, gridPos(2, 1));

    const payloadBytes = encodeMoveStepIntentPayload(gridPos(2, 2));
    expect(payloadBytes).toBeTruthy();
    if (!payloadBytes) {
        throw new Error('Failed to encode move.step');
    }

    pipeline.enqueue({
        type: 'INTENT',
        source: { connectionId: 'c', playerId: player.id },
        seq: 1,
        intentTypeId: 'move.step',
        payloadBytes,
    });
    pipeline.tick();

    // No MOVE should be emitted; the server should "wait" for occupancy to clear.
    expect(delivered.some((msg) => Array.isArray(msg) && msg[0] === Types.Messages.MOVE && msg[2] === 2 && msg[3] === 2)).toBe(false);

    // MOVE_SYNC with suppressed flag should be emitted (observability and client-side suppression).
    expect(
        delivered.some(
            (msg) =>
                Array.isArray(msg) &&
                msg[0] === Types.Messages.MOVE_SYNC &&
                msg[2] === 1 &&
                msg[3] === 1 &&
                msg[5] === 1
        )
    ).toBe(true);
});

