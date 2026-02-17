import { expect, test } from 'bun:test';
import Types from '../../../shared/gametypes-browser';
import Player from '../../../server/player';
import { gridPos } from '../../../shared/domain/positions';
import { WorldEcsCommandPipeline } from '../../../server/world/ecs-command-pipeline';
import { CLAIMS_STORE_RESOURCE } from '../../../server/world/claims/claims-resource';
import type { RectClaim } from '../../../server/world/claims/claims-store';
import type { WorldMessage } from '../../../server/world/contracts';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

function createTestPlayer(wireId: number, name: string): Player {
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
    player.name = name;
    player.accountNameKey = name.trim().toLowerCase();
    return player;
}

function createPipelineHarness({
    wireId,
    playerName,
    position = gridPos(0, 0),
    ensureChunkOverlayLoadedForTile,
    isValidPosition,
}: {
    wireId: number;
    playerName: string;
    position?: { x: number; y: number };
    ensureChunkOverlayLoadedForTile?: (x: number, y: number) => boolean;
    isValidPosition?: (x: number, y: number) => boolean;
}): {
    player: Player;
    pipeline: WorldEcsCommandPipeline;
    delivered: WorldMessage[];
    persistedClaimUpserts: RectClaim[];
    persistedClaimDeletes: number[];
} {
    const player = createTestPlayer(wireId, playerName);
    player.setPosition(position.x, position.y);

    const delivered: WorldMessage[] = [];
    const persistedClaimUpserts: RectClaim[] = [];
    const persistedClaimDeletes: number[] = [];

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
        isValidPosition(x: number, y: number) {
            if (typeof isValidPosition === 'function') {
                return isValidPosition(x, y);
            }
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
        persistClaimUpsert(claim: RectClaim) {
            persistedClaimUpserts.push(claim);
        },
        persistClaimDelete(claimId: number) {
            persistedClaimDeletes.push(claimId);
        },
        ensureChunkOverlayLoadedForTile(x: number, y: number) {
            if (typeof ensureChunkOverlayLoadedForTile === 'function') {
                return ensureChunkOverlayLoadedForTile(x, y);
            }
            return false;
        },
    };

    const pipeline = new WorldEcsCommandPipeline(host as never);
    pipeline.state.world.ensureEntity(player.id);
    pipeline.state.world.addComponent(player.id, pipeline.replication.Kind, Types.Entities.WARRIOR);
    pipeline.state.world.addComponent(player.id, pipeline.Position, gridPos(position.x, position.y));
    pipeline.state.world.addComponent(player.id, pipeline.combat.HitPoints, 100);
    pipeline.state.world.addComponent(player.id, pipeline.combat.MaxHitPoints, 100);

    return { player, pipeline, delivered, persistedClaimUpserts, persistedClaimDeletes };
}

function enqueueIntent({
    pipeline,
    player,
    seq,
    intentTypeId,
    payload,
}: {
    pipeline: WorldEcsCommandPipeline;
    player: Player;
    seq: number;
    intentTypeId: string;
    payload: JsonValue;
}): void {
    pipeline.enqueue({
        type: 'INTENT',
        source: { connectionId: 'c', playerId: player.id },
        seq,
        intentTypeId,
        payloadJson: JSON.stringify(payload),
    });
}

function findRejectMessage(delivered: WorldMessage[]): [number, number, string, string] | undefined {
    return delivered.find((msg) => Array.isArray(msg) && msg[0] === Types.Messages.REJECT) as [number, number, string, string] | undefined;
}

test('unauthorized tile edit intent is rejected with a clear reason code', () => {
    const harness = createPipelineHarness({ wireId: 24101, playerName: 'bob', position: gridPos(1, 1) });
    const claims = harness.pipeline.state.resources.require(CLAIMS_STORE_RESOURCE);
    claims.createClaim({ ownerName: 'alice', x1: 1, y1: 1, x2: 1, y2: 1, nowMs: 1000 });

    enqueueIntent({
        pipeline: harness.pipeline,
        player: harness.player,
        seq: 0,
        intentTypeId: 'tile.edit',
        payload: { x: 1, y: 1, value: 123 },
    });

    harness.pipeline.tick();

    expect(harness.delivered.some((msg) => Array.isArray(msg) && msg[0] === Types.Messages.ACK)).toBe(false);
    const reject = findRejectMessage(harness.delivered);
    expect(reject).toBeTruthy();
    expect(reject?.[1]).toBe(0);
    expect(reject?.[2]).toBe('tile.edit');
    expect(reject?.[3]).toContain('PERMISSION:claimed_no_access');
});

test('delegated editor can edit tiles inside another players claim', () => {
    const harness = createPipelineHarness({ wireId: 24102, playerName: 'bob', position: gridPos(2, 2) });
    const claims = harness.pipeline.state.resources.require(CLAIMS_STORE_RESOURCE);
    claims.createClaim({ ownerName: 'alice', editorNameKeys: ['bob'], x1: 2, y1: 2, x2: 2, y2: 2, nowMs: 1000 });

    enqueueIntent({
        pipeline: harness.pipeline,
        player: harness.player,
        seq: 0,
        intentTypeId: 'tile.edit',
        payload: { x: 2, y: 2, value: 7 },
    });

    harness.pipeline.tick();

    expect(harness.delivered.some((msg) => Array.isArray(msg) && msg[0] === Types.Messages.ACK && msg[1] === 0)).toBe(true);
    expect(harness.pipeline.chunkOverlays.getGlobal(2, 2)).toBe(7);
});

test('unclaimed tile edit intent is accepted and mutates chunk overlays', () => {
    const harness = createPipelineHarness({ wireId: 24103, playerName: 'bob' });

    enqueueIntent({
        pipeline: harness.pipeline,
        player: harness.player,
        seq: 0,
        intentTypeId: 'tile.edit',
        payload: { x: 10, y: 10, value: 7 },
    });

    harness.pipeline.tick();

    expect(harness.delivered.some((msg) => Array.isArray(msg) && msg[0] === Types.Messages.ACK && msg[1] === 0)).toBe(true);
    expect(harness.pipeline.chunkOverlays.getGlobal(10, 10)).toBe(7);
});

test('tile edit intent can preserve existing chunk state by lazy-loading chunk data first', () => {
    let pipeline: WorldEcsCommandPipeline | null = null;
    let ensureCalls = 0;
    const harness = createPipelineHarness({
        wireId: 24104,
        playerName: 'bob',
        ensureChunkOverlayLoadedForTile(x: number, y: number) {
            ensureCalls += 1;
            if (!pipeline || x !== 11 || y !== 10) {
                return false;
            }
            if (pipeline.chunkOverlays.getChunk(0, 0)) {
                return false;
            }
            const chunk = pipeline.chunkOverlays.getOrCreateChunk(0, 0);
            const idx = 10 * chunk.size + 10;
            chunk.present[idx] = 1;
            chunk.values[idx] = 55;
            chunk.version = 7;
            chunk.dirty = false;
            pipeline.chunkOverlays.markChunkClean(0, 0);
            return true;
        },
    });
    pipeline = harness.pipeline;

    enqueueIntent({
        pipeline: harness.pipeline,
        player: harness.player,
        seq: 0,
        intentTypeId: 'tile.edit',
        payload: { x: 11, y: 10, value: 9 },
    });

    harness.pipeline.tick();

    expect(ensureCalls).toBeGreaterThan(0);
    expect(harness.delivered.some((msg) => Array.isArray(msg) && msg[0] === Types.Messages.ACK && msg[1] === 0)).toBe(true);
    expect(harness.pipeline.chunkOverlays.getGlobal(10, 10)).toBe(55);
    expect(harness.pipeline.chunkOverlays.getGlobal(11, 10)).toBe(9);
});

test('claim create/update/delete intents mutate claim store and call persistence hooks', () => {
    const harness = createPipelineHarness({ wireId: 24105, playerName: 'alice' });

    enqueueIntent({
        pipeline: harness.pipeline,
        player: harness.player,
        seq: 0,
        intentTypeId: 'claim.create',
        payload: { x1: 5, y1: 5, x2: 6, y2: 6, editors: ['bob'] },
    });
    harness.pipeline.tick();

    const claims = harness.pipeline.state.resources.require(CLAIMS_STORE_RESOURCE);
    const created = claims.listClaims();
    expect(created.length).toBe(1);
    const createdClaim = created[0];
    expect(createdClaim).toBeTruthy();
    if (!createdClaim) {
        throw new Error('Expected created claim.');
    }
    expect(createdClaim.ownerName).toBe('alice');
    expect(createdClaim.editorNameKeys).toEqual(['bob']);
    expect(harness.persistedClaimUpserts.length).toBe(1);

    enqueueIntent({
        pipeline: harness.pipeline,
        player: harness.player,
        seq: 1,
        intentTypeId: 'claim.update',
        payload: { id: createdClaim.id, x1: 5, y1: 5, x2: 7, y2: 7, editors: ['bob', 'charlie'] },
    });
    harness.pipeline.tick();

    const updated = claims.getClaimById(createdClaim.id);
    expect(updated).toBeTruthy();
    expect(updated?.x2).toBe(7);
    expect(updated?.editorNameKeys).toEqual(['bob', 'charlie']);
    expect(harness.persistedClaimUpserts.length).toBe(2);

    enqueueIntent({
        pipeline: harness.pipeline,
        player: harness.player,
        seq: 2,
        intentTypeId: 'claim.delete',
        payload: { id: createdClaim.id },
    });
    harness.pipeline.tick();

    expect(claims.getClaimById(createdClaim.id)).toBeNull();
    expect(harness.persistedClaimDeletes).toEqual([createdClaim.id]);
    expect(
        harness.delivered.filter((msg) => Array.isArray(msg) && msg[0] === Types.Messages.ACK).map((msg) => (msg as [number, number])[1])
    ).toEqual([0, 1, 2]);
});

test('delegated editor can update claim bounds but cannot modify claim ACL', () => {
    const harness = createPipelineHarness({ wireId: 24106, playerName: 'bob' });
    const claims = harness.pipeline.state.resources.require(CLAIMS_STORE_RESOURCE);
    const claim = claims.createClaim({ ownerName: 'alice', editorNameKeys: ['bob'], x1: 8, y1: 8, x2: 9, y2: 9, nowMs: 1000 });

    enqueueIntent({
        pipeline: harness.pipeline,
        player: harness.player,
        seq: 0,
        intentTypeId: 'claim.update',
        payload: { id: claim.id, x1: 8, y1: 8, x2: 10, y2: 10 },
    });
    harness.pipeline.tick();

    expect(claims.getClaimById(claim.id)?.x2).toBe(10);
    expect(harness.delivered.some((msg) => Array.isArray(msg) && msg[0] === Types.Messages.ACK && msg[1] === 0)).toBe(true);

    enqueueIntent({
        pipeline: harness.pipeline,
        player: harness.player,
        seq: 1,
        intentTypeId: 'claim.update',
        payload: { id: claim.id, x1: 8, y1: 8, x2: 10, y2: 10, editors: ['eve'] },
    });
    harness.pipeline.tick();

    const reject = findRejectMessage(harness.delivered);
    expect(reject).toBeTruthy();
    expect(reject?.[1]).toBe(1);
    expect(reject?.[2]).toBe('claim.update');
    expect(reject?.[3]).toContain('PERMISSION:claimed_not_owner');
    expect(claims.getClaimById(claim.id)?.editorNameKeys).toEqual(['bob']);
});
