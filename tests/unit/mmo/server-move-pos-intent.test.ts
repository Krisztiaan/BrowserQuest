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

test('move.pos final moving=false update forces MOVE_SYNC and entity state past the cadence window', () => {
    const player = createTestPlayer(41405);
    const delivered: WorldMessage[] = [];
    const pipeline = setupPipeline(player, delivered);

    const start = tileToWorldPosCenter(4, 5);
    const mid = { x: start.x + TILE_SUBPX / 4, y: start.y };
    const stop = { x: start.x + TILE_SUBPX / 2, y: start.y };

    enqueueMovePos(pipeline, player, 1, mid, { moving: true });
    pipeline.tick();
    // One tick later - well inside the 6-tick MOVE_SYNC cadence window.
    enqueueMovePos(pipeline, player, 2, stop, { moving: false });
    pipeline.tick();

    expect(pipeline.PositionSub.store.get(player.id)).toEqual(stop);
    const syncs = delivered.filter((m) => Array.isArray(m) && m[0] === Types.Messages.MOVE_SYNC);
    const last = syncs[syncs.length - 1] as number[];
    expect(last[2]).toBe(stop.x);
    expect(last[3]).toBe(stop.y);
});

test('move.pos jitter burst of legal-speed updates in one tick drains the budget instead of rejecting', () => {
    const player = createTestPlayer(41406);
    const delivered: WorldMessage[] = [];
    const pipeline = setupPipeline(player, delivered);

    const start = tileToWorldPosCenter(4, 5);
    // Three ~50ms-cadence updates delivered in the same tick (network jitter).
    for (let i = 1; i <= 3; i += 1) {
        enqueueMovePos(pipeline, player, i, { x: start.x + (i * TILE_SUBPX) / 4, y: start.y });
    }
    pipeline.tick();

    expect(pipeline.PositionSub.store.get(player.id)).toEqual({ x: start.x + (3 * TILE_SUBPX) / 4, y: start.y });
    const rejects = delivered.filter((m) => Array.isArray(m) && m[0] === Types.Messages.REJECT);
    expect(rejects.length).toBe(0);
});

test('move.pos sustained over-speed streaming is rejected once the budget drains', () => {
    const player = createTestPlayer(41407);
    const delivered: WorldMessage[] = [];
    const pipeline = setupPipeline(player, delivered);

    const start = tileToWorldPosCenter(4, 5);
    // 1 tile per tick is 10x profile speed at 50 UPS; the initial allowance
    // absorbs a few, then the bucket runs dry and the stream gets vetoed.
    let rejected = 0;
    for (let i = 1; i <= 12; i += 1) {
        enqueueMovePos(pipeline, player, i, { x: start.x + i * TILE_SUBPX, y: start.y });
        pipeline.tick();
        rejected = delivered.filter((m) => Array.isArray(m) && m[0] === Types.Messages.REJECT).length;
        if (rejected > 0) {
            break;
        }
    }
    expect(rejected).toBeGreaterThan(0);
});
