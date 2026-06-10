import { expect, test } from 'bun:test';
import Types from '../../../shared/gametypes-browser';
import Player from '../../../server/player';
import { gridPos } from '../../../shared/domain/positions';
import { tileToWorldPosCenter, TILE_SUBPX } from '../../../shared/world/worldpos';
import { WorldEcsCommandPipeline } from '../../../server/world/ecs-command-pipeline';
import { encodeMovePosIntentPayload, INTENT_MOVE_POS } from '../../../shared/protocol/intents';
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
    player.setPosition(4, 5);
    return player;
}

function createHost(player: Player, delivered: WorldMessage[], blockedTiles: ReadonlySet<string> = new Set()) {
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
        isValidPosition(x: number, y: number) {
            return !blockedTiles.has(`${x},${y}`);
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
}

function setupPipeline(player: Player, delivered: WorldMessage[], blockedTiles?: ReadonlySet<string>) {
    const pipeline = new WorldEcsCommandPipeline(createHost(player, delivered, blockedTiles) as never);
    pipeline.state.world.ensureEntity(player.id);
    pipeline.state.world.addComponent(player.id, pipeline.replication.Kind, Types.Entities.WARRIOR);
    pipeline.state.world.addComponent(player.id, pipeline.Position, gridPos(4, 5));
    pipeline.state.world.addComponent(player.id, pipeline.PositionSub, tileToWorldPosCenter(4, 5));
    pipeline.state.world.addComponent(player.id, pipeline.combat.HitPoints, 100);
    pipeline.state.world.addComponent(player.id, pipeline.combat.MaxHitPoints, 100);
    return pipeline;
}

function enqueueMovePos(
    pipeline: WorldEcsCommandPipeline,
    player: Player,
    seq: number,
    pos: { x: number; y: number },
    extras: { facing?: number; moving?: boolean } = {}
) {
    const payload = encodeMovePosIntentPayload({
        x: pos.x,
        y: pos.y,
        facing: extras.facing ?? Types.Orientations.RIGHT,
        moving: extras.moving ?? true,
    });
    if (!payload) {
        throw new Error('failed to encode move.pos payload');
    }
    pipeline.enqueue({
        type: 'INTENT',
        source: { connectionId: 'c', playerId: player.id },
        seq,
        intentTypeId: INTENT_MOVE_POS,
        payloadBytes: payload,
    });
}

test('move.pos within the speed envelope is accepted and updates authoritative position', () => {
    const player = createTestPlayer(41401);
    const delivered: WorldMessage[] = [];
    const pipeline = setupPipeline(player, delivered);

    const start = tileToWorldPosCenter(4, 5);
    // small nudge: a quarter tile right - far inside any sane envelope
    const next = { x: start.x + TILE_SUBPX / 4, y: start.y };
    enqueueMovePos(pipeline, player, 1, next);
    pipeline.tick();

    expect(pipeline.PositionSub.store.get(player.id)).toEqual(next);
    // accepted intents are ACKed, not rejected
    const acks = delivered.filter((m) => Array.isArray(m) && m[0] === Types.Messages.ACK);
    const rejects = delivered.filter((m) => Array.isArray(m) && m[0] === Types.Messages.REJECT);
    expect(acks.length).toBe(1);
    expect(rejects.length).toBe(0);
    // facing replicated for remote animation fidelity
    expect(pipeline.replication.Orientation.store.get(player.id)).toBe(Types.Orientations.RIGHT);
});

test('move.pos crossing a tile boundary updates the grid position', () => {
    const player = createTestPlayer(41402);
    const delivered: WorldMessage[] = [];
    const pipeline = setupPipeline(player, delivered);

    const next = tileToWorldPosCenter(5, 5);
    enqueueMovePos(pipeline, player, 1, next);
    pipeline.tick();

    expect(pipeline.Position.store.get(player.id)).toEqual(gridPos(5, 5));
});

test('move.pos teleport-sized jumps are rejected with a correction', () => {
    const player = createTestPlayer(41403);
    const delivered: WorldMessage[] = [];
    const pipeline = setupPipeline(player, delivered);

    const jump = tileToWorldPosCenter(40, 5); // 36 tiles in one update
    enqueueMovePos(pipeline, player, 1, jump);
    pipeline.tick();

    expect(pipeline.Position.store.get(player.id)).toEqual(gridPos(4, 5));
    const rejects = delivered.filter((m) => Array.isArray(m) && m[0] === Types.Messages.REJECT);
    expect(rejects.length).toBe(1);
});

test('move.pos into blocked geometry is rejected', () => {
    const player = createTestPlayer(41404);
    const delivered: WorldMessage[] = [];
    const pipeline = setupPipeline(player, delivered, new Set(['5,5']));

    const next = tileToWorldPosCenter(5, 5);
    enqueueMovePos(pipeline, player, 1, next);
    pipeline.tick();

    expect(pipeline.Position.store.get(player.id)).toEqual(gridPos(4, 5));
    const rejects = delivered.filter((m) => Array.isArray(m) && m[0] === Types.Messages.REJECT);
    expect(rejects.length).toBe(1);
});
