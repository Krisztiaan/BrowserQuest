import { expect, test } from 'bun:test';
import Types from '../../../shared/gametypes-browser';
import Player from '../../../server/player';
import { gridPos } from '../../../shared/domain/positions';
import { WorldEcsCommandPipeline } from '../../../server/world/ecs-command-pipeline';
import { INTENT_SEQ_STATE_RESOURCE } from '../../../server/ecs/intent-seq';
import type { WorldMessage } from '../../../server/world/contracts';
import type { ServerToClientProtocolAction } from '../../../shared/protocol/types';

function createTestPlayer(wireId: number): Player {
    const connection = {
        id: String(wireId),
        listen() {},
        onClose() {},
        send() {},
        sendUTF8() {},
        close() {},
    };
    const player = new Player(connection, null);
    player.resetHitPoints(100);
    player.isDead = false;
    player.setPosition(0, 0);
    return player;
}

function toSerializedAction(message: WorldMessage): ServerToClientProtocolAction {
    return Array.isArray(message) ? message : message.serialize();
}

function hasAction(
    delivered: readonly WorldMessage[],
    matches: (action: ServerToClientProtocolAction) => boolean
): boolean {
    return delivered.some((message) => matches(toSerializedAction(message)));
}

function createPipelineFixture(player: Player): {
    pipeline: WorldEcsCommandPipeline;
    delivered: WorldMessage[];
} {
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
        isValidPosition() {
            return true;
        },
        getDroppedItem() {
            return null;
        },
        handleItemDespawn() {},
        moveEntity(entity: Player, x: number, y: number) {
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

    const pipeline = new WorldEcsCommandPipeline(host as never);
    return { pipeline, delivered };
}

function seedPlayerEntity(pipeline: WorldEcsCommandPipeline, player: Player): void {
    pipeline.state.world.ensureEntity(player.id);
    pipeline.state.world.addComponent(player.id, pipeline.replication.Kind, Types.Entities.WARRIOR);
    pipeline.state.world.addComponent(player.id, pipeline.Position, gridPos(0, 0));
    pipeline.state.world.addComponent(player.id, pipeline.combat.HitPoints, 100);
    pipeline.state.world.addComponent(player.id, pipeline.combat.MaxHitPoints, 100);
}

test('server ignores duplicate seq INTENT movement (idempotent) and acks', () => {
    const player = createTestPlayer(22101);
    player.setPosition(0, 0);
    const { pipeline, delivered } = createPipelineFixture(player);
    seedPlayerEntity(pipeline, player);

    pipeline.enqueue({
        type: 'INTENT',
        source: { connectionId: 'c', playerId: player.id },
        seq: 1,
        intentTypeId: 'move.step',
        payloadJson: JSON.stringify({ x: 1, y: 0 }),
    });
    pipeline.tick();
    expect(pipeline.Position.store.get(player.id)).toEqual(gridPos(1, 0));

    delivered.length = 0;
    pipeline.enqueue({
        type: 'INTENT',
        source: { connectionId: 'c', playerId: player.id },
        seq: 1,
        intentTypeId: 'move.step',
        payloadJson: JSON.stringify({ x: 2, y: 0 }),
    });
    pipeline.tick();

    expect(pipeline.Position.store.get(player.id)).toEqual(gridPos(1, 0));
    expect(hasAction(delivered, (action) => action[0] === Types.Messages.ACK && action[1] === 1)).toBe(true);
});

test('server rejects stale seq and emits a correction', () => {
    const player = createTestPlayer(22102);
    player.setPosition(0, 0);
    const { pipeline, delivered } = createPipelineFixture(player);
    seedPlayerEntity(pipeline, player);

    pipeline.enqueue({
        type: 'INTENT',
        source: { connectionId: 'c', playerId: player.id },
        seq: 2,
        intentTypeId: 'move.step',
        payloadJson: JSON.stringify({ x: 1, y: 0 }),
    });
    pipeline.tick();
    expect(pipeline.Position.store.get(player.id)).toEqual(gridPos(1, 0));

    delivered.length = 0;
    pipeline.enqueue({
        type: 'INTENT',
        source: { connectionId: 'c', playerId: player.id },
        seq: 1,
        intentTypeId: 'move.step',
        payloadJson: JSON.stringify({ x: 0, y: 0 }),
    });
    pipeline.tick();

    expect(hasAction(delivered, (action) => action[0] === Types.Messages.REJECT && action[1] === 1)).toBe(true);
    expect(
        hasAction(
            delivered,
            (action) =>
                action[0] === Types.Messages.CORRECTION
                && action[1] === 1
                && action[2] === 1
                && action[3] === 0
        )
    ).toBe(true);
});

test('server rejects invalid move.step (non-adjacent) and emits CORRECTION (no ACK/TELEPORT)', () => {
    const player = createTestPlayer(22103);
    player.setPosition(0, 0);
    const { pipeline, delivered } = createPipelineFixture(player);
    seedPlayerEntity(pipeline, player);

    pipeline.enqueue({
        type: 'INTENT',
        source: { connectionId: 'c', playerId: player.id },
        seq: 1,
        intentTypeId: 'move.step',
        payloadJson: JSON.stringify({ x: 2, y: 0 }),
    });
    pipeline.tick();

    expect(hasAction(delivered, (action) => action[0] === Types.Messages.REJECT && action[1] === 1)).toBe(true);
    expect(
        hasAction(
            delivered,
            (action) =>
                action[0] === Types.Messages.CORRECTION
                && action[1] === 1
                && action[2] === 0
                && action[3] === 0
        )
    ).toBe(true);
    expect(hasAction(delivered, (action) => action[0] === Types.Messages.ACK && action[1] === 1)).toBe(false);
    expect(hasAction(delivered, (action) => action[0] === Types.Messages.TELEPORT)).toBe(false);

    delivered.length = 0;
    pipeline.enqueue({
        type: 'INTENT',
        source: { connectionId: 'c', playerId: player.id },
        seq: 1,
        intentTypeId: 'move.step',
        payloadJson: JSON.stringify({ x: 2, y: 0 }),
    });
    pipeline.tick();

    expect(hasAction(delivered, (action) => action[0] === Types.Messages.REJECT && action[1] === 1)).toBe(true);
    expect(hasAction(delivered, (action) => action[0] === Types.Messages.ACK && action[1] === 1)).toBe(false);
});

test('server clears per-player seq state when entity is removed', () => {
    const player = createTestPlayer(22104);
    const { pipeline } = createPipelineFixture(player);
    pipeline.state.world.ensureEntity(player.id);

    const seqState = pipeline.state.resources.require(INTENT_SEQ_STATE_RESOURCE);
    seqState.lastAcceptedByPlayerId.set(player.id, 99);
    expect(seqState.lastAcceptedByPlayerId.get(player.id)).toBe(99);

    pipeline.removeEntity(player.id);
    expect(seqState.lastAcceptedByPlayerId.has(player.id)).toBe(false);
});
