import { expect, test } from 'bun:test';
import Types from '../../../shared/gametypes-browser';
import Player from '../../../server/player';
import { gridPos } from '../../../shared/domain/positions';
import { WorldEcsCommandPipeline } from '../../../server/world/ecs-command-pipeline';
import { INTENT_SEQ_STATE_RESOURCE } from '../../../server/ecs/intent-seq';
import type { WorldMessage } from '../../../server/world/contracts';
import type { ServerToClientProtocolAction } from '../../../shared/protocol/types';
import { encodeMoveStepIntentPayload } from '../../../shared/protocol/intents';
import { tileToWorldPosCenter } from '../../../shared/world/worldpos';

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
    pipeline.state.world.addComponent(player.id, pipeline.PositionSub, tileToWorldPosCenter(0, 0));
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
        payloadBytes: encodeMoveStepIntentPayload(gridPos(1, 0)) ?? [],
    });
    pipeline.tick();
    for (let i = 0; i < 12; i += 1) {
        pipeline.tick();
    }
    expect(pipeline.Position.store.get(player.id)).toEqual(gridPos(1, 0));

    delivered.length = 0;
    pipeline.enqueue({
        type: 'INTENT',
        source: { connectionId: 'c', playerId: player.id },
        seq: 1,
        intentTypeId: 'move.step',
        payloadBytes: encodeMoveStepIntentPayload(gridPos(2, 0)) ?? [],
    });
    pipeline.tick();
    for (let i = 0; i < 12; i += 1) {
        pipeline.tick();
    }

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
        payloadBytes: encodeMoveStepIntentPayload(gridPos(1, 0)) ?? [],
    });
    pipeline.tick();
    for (let i = 0; i < 12; i += 1) {
        pipeline.tick();
    }
    expect(pipeline.Position.store.get(player.id)).toEqual(gridPos(1, 0));

    delivered.length = 0;
    pipeline.enqueue({
        type: 'INTENT',
        source: { connectionId: 'c', playerId: player.id },
        seq: 1,
        intentTypeId: 'move.step',
        payloadBytes: encodeMoveStepIntentPayload(gridPos(0, 0)) ?? [],
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
        payloadBytes: encodeMoveStepIntentPayload(gridPos(2, 0)) ?? [],
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
        payloadBytes: encodeMoveStepIntentPayload(gridPos(2, 0)) ?? [],
    });
    pipeline.tick();

    expect(hasAction(delivered, (action) => action[0] === Types.Messages.REJECT && action[1] === 1)).toBe(true);
    expect(hasAction(delivered, (action) => action[0] === Types.Messages.ACK && action[1] === 1)).toBe(false);
});

test('server accepts move.step adjacent to current tile by pruning a stale queued baseline', () => {
    const player = createTestPlayer(221031);
    player.setPosition(0, 0);
    const { pipeline, delivered } = createPipelineFixture(player);
    seedPlayerEntity(pipeline, player);

    pipeline.state.world.addComponent(player.id, pipeline.movement.MoveQueue, {
        entries: [gridPos(1, 0), gridPos(2, 0)],
    });

    pipeline.enqueue({
        type: 'INTENT',
        source: { connectionId: 'c', playerId: player.id },
        seq: 1,
        intentTypeId: 'move.step',
        payloadBytes: encodeMoveStepIntentPayload(gridPos(0, 1)) ?? [],
    });
    pipeline.tick();
    for (let i = 0; i < 12; i += 1) {
        pipeline.tick();
    }

    expect(hasAction(delivered, (action) => action[0] === Types.Messages.ACK && action[1] === 1)).toBe(true);
    expect(hasAction(delivered, (action) => action[0] === Types.Messages.REJECT && action[1] === 1)).toBe(false);
    expect(pipeline.Position.store.get(player.id)).toEqual(gridPos(0, 1));
});

test('server treats already-queued move.step targets as idempotent instead of rejecting', () => {
    const player = createTestPlayer(221032);
    player.setPosition(0, 0);
    const { pipeline, delivered } = createPipelineFixture(player);
    seedPlayerEntity(pipeline, player);

    pipeline.state.world.addComponent(player.id, pipeline.movement.MoveQueue, {
        entries: [gridPos(1, 0), gridPos(2, 0)],
    });

    pipeline.enqueue({
        type: 'INTENT',
        source: { connectionId: 'c', playerId: player.id },
        seq: 1,
        intentTypeId: 'move.step',
        payloadBytes: encodeMoveStepIntentPayload(gridPos(1, 0)) ?? [],
    });
    pipeline.tick();

    expect(hasAction(delivered, (action) => action[0] === Types.Messages.ACK && action[1] === 1)).toBe(true);
    expect(hasAction(delivered, (action) => action[0] === Types.Messages.REJECT && action[1] === 1)).toBe(false);
    expect(pipeline.movement.MoveQueue.store.get(player.id)?.entries).toEqual([gridPos(1, 0), gridPos(2, 0)]);
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
