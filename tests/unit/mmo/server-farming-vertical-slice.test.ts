import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Types from '../../../shared/gametypes-browser';
import Player from '../../../server/player';
import { gridPos } from '../../../shared/domain/positions';
import { WorldEcsCommandPipeline } from '../../../server/world/ecs-command-pipeline';
import { CLAIMS_STORE_RESOURCE } from '../../../server/world/claims/claims-resource';
import type { RectClaim } from '../../../server/world/claims/claims-store';
import { SqliteClaimsPersistence } from '../../../server/world/claims/claims-persistence';
import { SqliteChunkOverlayPersistence } from '../../../server/world/chunks/chunk-overlay-persistence';
import {
    INTENT_CLAIM_CREATE,
    INTENT_TILE_EDIT,
    encodeClaimCreateIntentPayload,
    encodeTileEditIntentPayload,
} from '../../../shared/protocol/intents';
import type { WorldMessage } from '../../../server/world/contracts';

type Harness = {
    players: { alice: Player; bob: Player };
    pipeline: WorldEcsCommandPipeline;
    deliveredByPlayerId: Map<number, WorldMessage[]>;
    close: () => void;
    flushDirtyChunks: () => void;
};

function withTempDataPaths<T>(fn: (paths: { claimsDbPath: string; chunkDbPath: string }) => T): T {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'bq-farming-'));
    const claimsDbPath = path.join(dir, 'claims.sqlite');
    const chunkDbPath = path.join(dir, 'chunks.sqlite');
    try {
        return fn({ claimsDbPath, chunkDbPath });
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

function createPlayer(wireId: string, name: string, x: number, y: number): Player {
    const connection = {
        id: wireId,
        listen() {},
        onClose() {},
        send() {},
        sendUTF8() {},
        close() {},
    };
    const player = new Player(connection as never, null);
    player.resetHitPoints(100);
    player.isDead = false;
    player.name = name;
    player.accountNameKey = name;
    player.setPosition(x, y);
    return player;
}

function createHarness({ claimsDbPath, chunkDbPath }: { claimsDbPath: string; chunkDbPath: string }): Harness {
    const alice = createPlayer('26101', 'alice', 10, 10);
    const bob = createPlayer('26102', 'bob', 11, 10);
    const players = new Map<number, Player>([
        [alice.id, alice],
        [bob.id, bob],
    ]);

    const deliveredByPlayerId = new Map<number, WorldMessage[]>([
        [alice.id, []],
        [bob.id, []],
    ]);

    const claimsPersistence = new SqliteClaimsPersistence(claimsDbPath);
    const chunkPersistence = new SqliteChunkOverlayPersistence(chunkDbPath);

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
            return players.get(id) ?? null;
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
        moveEntity(entity: { setPosition: (nextX: number, nextY: number) => void }, x: number, y: number) {
            entity.setPosition(x, y);
        },
        removeEntity() {},
        addItemFromChest() {
            return null;
        },
        pushToPlayerId(playerId: number, message: WorldMessage) {
            const queue = deliveredByPlayerId.get(playerId);
            if (queue) {
                queue.push(message);
            }
        },
        persistPlayerEquipment() {},
        persistPlayerCheckpoint() {},
        persistPlayerAchievementUnlock() {},
        recordPlayerMobKill() {},
        recordPlayerDamageTaken() {},
        recordPlayerRevive() {},
        persistClaimUpsert(claim: RectClaim) {
            claimsPersistence.upsertClaim(claim);
        },
        persistClaimDelete(claimId: number) {
            claimsPersistence.deleteClaim(claimId);
        },
        ensureChunkOverlayLoadedForTile(x: number, y: number) {
            const chunkSize = pipeline.chunkOverlays.chunkSize;
            return chunkPersistence.loadChunkIntoStore(pipeline.chunkOverlays, Math.floor(x / chunkSize), Math.floor(y / chunkSize)).loaded;
        },
    };

    const pipeline = new WorldEcsCommandPipeline(host as never);
    for (const player of players.values()) {
        pipeline.state.world.ensureEntity(player.id);
        pipeline.state.world.addComponent(player.id, pipeline.replication.Kind, Types.Entities.WARRIOR);
        pipeline.state.world.addComponent(player.id, pipeline.Position, gridPos(player.x, player.y));
        pipeline.state.world.addComponent(player.id, pipeline.combat.HitPoints, 100);
        pipeline.state.world.addComponent(player.id, pipeline.combat.MaxHitPoints, 100);
    }

    const claimsStore = pipeline.state.resources.require(CLAIMS_STORE_RESOURCE);
    claimsStore.loadClaims(claimsPersistence.loadAllClaims());
    chunkPersistence.loadRecentIntoStore(pipeline.chunkOverlays, { limitChunks: 1024 });

    return {
        players: { alice, bob },
        pipeline,
        deliveredByPlayerId,
        flushDirtyChunks() {
            chunkPersistence.flushDirtyChunks(pipeline.chunkOverlays);
        },
        close() {
            claimsPersistence.close();
            chunkPersistence.close();
        },
    };
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
    payload: unknown;
}): void {
    const payloadBytes = (() => {
        switch (intentTypeId) {
            case INTENT_CLAIM_CREATE:
                return encodeClaimCreateIntentPayload(payload as never);
            case INTENT_TILE_EDIT:
                return encodeTileEditIntentPayload(payload as never);
            default:
                return null;
        }
    })();
    if (!payloadBytes) {
        throw new Error(`enqueueIntent: unsupported/invalid payload for intentTypeId=${intentTypeId}`);
    }
    pipeline.enqueue({
        type: 'INTENT',
        source: { connectionId: `conn-${player.id}`, playerId: player.id },
        seq,
        intentTypeId,
        payloadBytes,
    });
}

function hasAck(messages: WorldMessage[] | undefined, seq: number): boolean {
    if (!messages) {
        return false;
    }
    return messages.some((message) => Array.isArray(message) && message[0] === Types.Messages.ACK && message[1] === seq);
}

test('farming vertical slice: delegated claim edits persist and survive restart', () => {
    withTempDataPaths(({ claimsDbPath, chunkDbPath }) => {
        const first = createHarness({ claimsDbPath, chunkDbPath });
        try {
            enqueueIntent({
                pipeline: first.pipeline,
                player: first.players.alice,
                seq: 1,
                intentTypeId: 'claim.create',
                payload: { x1: 10, y1: 10, x2: 12, y2: 12, editors: ['bob'] },
            });
            first.pipeline.tick();

            enqueueIntent({
                pipeline: first.pipeline,
                player: first.players.bob,
                seq: 1,
                intentTypeId: 'tile.edit',
                payload: { x: 10, y: 10, value: 7001 },
            });
            first.pipeline.tick();

            enqueueIntent({
                pipeline: first.pipeline,
                player: first.players.alice,
                seq: 2,
                intentTypeId: 'tile.edit',
                payload: { x: 11, y: 10, value: 7002 },
            });
            first.pipeline.tick();

            expect(hasAck(first.deliveredByPlayerId.get(first.players.alice.id), 1)).toBe(true);
            expect(hasAck(first.deliveredByPlayerId.get(first.players.alice.id), 2)).toBe(true);
            expect(hasAck(first.deliveredByPlayerId.get(first.players.bob.id), 1)).toBe(true);
            expect(first.pipeline.chunkOverlays.getGlobal(10, 10)).toBe(7001);
            expect(first.pipeline.chunkOverlays.getGlobal(11, 10)).toBe(7002);

            first.flushDirtyChunks();
        } finally {
            first.close();
        }

        const second = createHarness({ claimsDbPath, chunkDbPath });
        try {
            const claims = second.pipeline.state.resources.require(CLAIMS_STORE_RESOURCE);
            const claim = claims.getClaimAt(10, 10);
            expect(claim).toBeTruthy();
            expect(claim?.ownerName).toBe('alice');
            expect(claim?.editorNameKeys).toContain('bob');
            expect(second.pipeline.chunkOverlays.getGlobal(10, 10)).toBe(7001);
            expect(second.pipeline.chunkOverlays.getGlobal(11, 10)).toBe(7002);

            enqueueIntent({
                pipeline: second.pipeline,
                player: second.players.bob,
                seq: 1,
                intentTypeId: 'tile.edit',
                payload: { x: 10, y: 10, value: 7003 },
            });
            second.pipeline.tick();

            expect(hasAck(second.deliveredByPlayerId.get(second.players.bob.id), 1)).toBe(true);
            expect(second.pipeline.chunkOverlays.getGlobal(10, 10)).toBe(7003);
        } finally {
            second.close();
        }
    });
});
