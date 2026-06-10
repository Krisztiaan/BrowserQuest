import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Types from '../../../shared/gametypes-browser';
import { entityIdFromWire } from '../../../shared/domain/ids';
import { gridPos, type GridPos } from '../../../shared/domain/positions';
import type { EntityKind } from '../../../shared/entity-kind-domain';
import {
    encodeChestTransferIntentPayload,
    INTENT_CHEST_TRANSFER,
    OUTCOME_CHEST_TRANSFER,
} from '../../../shared/protocol/intents';
import { SqlitePlayerPersistence } from '../../../server/player-persistence';
import Player from '../../../server/player';
import { WorldEcsCommandPipeline } from '../../../server/world/ecs-command-pipeline';
import { CLAIMS_STORE_RESOURCE } from '../../../server/world/claims/claims-resource';

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
    player.name = 'Farmer';
    player.accountNameKey = 'farmer';
    player.resetHitPoints(100);
    player.isDead = false;
    player.setPosition(0, 0);
    return player;
}

function withFixture<T>(
    fn: (fixture: ReturnType<typeof createChestTransactionFixture>) => T,
    opts?: { playerPosition?: GridPos; chestPosition?: GridPos }
): T {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'bq-chest-transfer-'));
    try {
        const fixture = createChestTransactionFixture(path.join(dir, 'players.sqlite'), opts);
        try {
            return fn(fixture);
        } finally {
            fixture.persistence.close();
        }
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

function createChestTransactionFixture(
    dbPath: string,
    opts: { playerPosition?: GridPos; chestPosition?: GridPos } = {}
) {
    const persistence = new SqlitePlayerPersistence(dbPath);
    const claim = persistence.claimPlayerSession({ connectionId: 'conn-farmer', requestedName: 'Farmer' });
    expect(claim.accepted).toBe(true);

    const player = createTestPlayer(7001);
    const chestId = entityIdFromWire(100);
    const messages: unknown[][] = [];
    const playerPosition = opts.playerPosition ?? gridPos(5, 5);
    const chestPosition = opts.chestPosition ?? gridPos(5, 6);
    const chestKey = `world_01:${chestPosition.x},${chestPosition.y}`;
    player.setPosition(playerPosition.x, playerPosition.y);

    const host = {
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
        moveEntity() {},
        removeEntity() {},
        addItemFromChest() {
            return { id: entityIdFromWire(999) };
        },
        pushToPlayerId(_playerId: number, message: unknown[]) {
            messages.push(message);
        },
        persistPlayerEquipment() {},
        persistPlayerCheckpoint() {},
        persistPlayerAchievementUnlock() {},
        transferChestItem(args: Omit<Parameters<SqlitePlayerPersistence['transferChestItem']>[0], 'accountNameKey' | 'chestId'> & { playerIdentity: string; chestKey: string }) {
            return persistence.transferChestItem({
                accountNameKey: args.playerIdentity,
                chestId: args.chestKey,
                itemKind: args.itemKind,
                quantity: args.quantity,
                direction: args.direction,
            });
        },
        recordPlayerMobKill() {},
        recordPlayerDamageTaken() {},
        recordPlayerRevive() {},
    };

    const pipeline = new WorldEcsCommandPipeline(host as never);
    pipeline.state.world.ensureEntity(player.id);
    pipeline.state.world.addComponent(player.id, pipeline.replication.Kind, player.kind);
    pipeline.state.world.addComponent(player.id, pipeline.Position, playerPosition);
    pipeline.state.world.ensureEntity(chestId);
    pipeline.state.world.addComponent(chestId, pipeline.replication.Kind, Types.Entities.CHEST);
    pipeline.state.world.addComponent(chestId, pipeline.Position, chestPosition);

    return {
        persistence,
        pipeline,
        player,
        chestId,
        chestKey,
        messages,
        respawnChest(newWireId: number) {
            pipeline.removeEntity(chestId);
            const nextChestId = entityIdFromWire(newWireId);
            pipeline.state.world.ensureEntity(nextChestId);
            pipeline.state.world.addComponent(nextChestId, pipeline.replication.Kind, Types.Entities.CHEST);
            pipeline.state.world.addComponent(nextChestId, pipeline.Position, chestPosition);
            return nextChestId;
        },
        seedChest({ itemKind, quantity }: { itemKind: EntityKind; quantity: number }) {
            persistence.setChestInventoryItem({ chestId: chestKey, itemKind, quantity });
        },
        enqueueTransfer({
            itemKind,
            quantity,
            direction,
            chestWireId = 100,
        }: {
            itemKind: EntityKind;
            quantity: number;
            direction: 'chest_to_inventory' | 'inventory_to_chest';
            chestWireId?: number;
        }) {
            const payloadBytes = encodeChestTransferIntentPayload({
                chestId: chestWireId,
                itemKind,
                quantity,
                direction,
            });
            expect(payloadBytes).not.toBeNull();
            pipeline.enqueue({
                type: 'INTENT',
                source: { connectionId: 'conn-farmer', playerId: player.id },
                seq: 1,
                intentTypeId: INTENT_CHEST_TRANSFER,
                payloadBytes: payloadBytes ?? [],
            });
        },
        getInventoryQuantity(itemKind: EntityKind) {
            const inventory = persistence.getProfileByName('farmer')?.progression.inventory ?? [];
            return inventory.find((entry) => entry.itemKind === itemKind)?.quantity ?? 0;
        },
        getChestQuantity(itemKind: EntityKind) {
            return persistence.getChestInventoryQuantity(chestKey, itemKind);
        },
    };
}

test('chest transfer moves one stack atomically from chest to inventory', () => {
    withFixture((fixture) => {
        fixture.seedChest({ itemKind: Types.Entities.FLASK, quantity: 3 });

        fixture.enqueueTransfer({
            itemKind: Types.Entities.FLASK,
            quantity: 2,
            direction: 'chest_to_inventory',
        });
        fixture.pipeline.tick();

        expect(fixture.getInventoryQuantity(Types.Entities.FLASK)).toBe(2);
        expect(fixture.getChestQuantity(Types.Entities.FLASK)).toBe(1);
        expect(fixture.messages.some((message) => message[0] === Types.Messages.OUTCOME && message[2] === OUTCOME_CHEST_TRANSFER)).toBe(true);
    });
});

test('chest transfer persistence follows stable map-position key across chest respawn ids', () => {
    withFixture((fixture) => {
        fixture.seedChest({ itemKind: Types.Entities.FLASK, quantity: 3 });
        fixture.respawnChest(101);

        fixture.enqueueTransfer({
            chestWireId: 101,
            itemKind: Types.Entities.FLASK,
            quantity: 2,
            direction: 'chest_to_inventory',
        });
        fixture.pipeline.tick();

        expect(fixture.getInventoryQuantity(Types.Entities.FLASK)).toBe(2);
        expect(fixture.getChestQuantity(Types.Entities.FLASK)).toBe(1);
    });
});

test('chest transfer rejects out-of-range player without mutating state', () => {
    withFixture(
        (fixture) => {
            fixture.seedChest({ itemKind: Types.Entities.FLASK, quantity: 3 });

            fixture.enqueueTransfer({
                itemKind: Types.Entities.FLASK,
                quantity: 1,
                direction: 'chest_to_inventory',
            });
            fixture.pipeline.tick();

            expect(fixture.getInventoryQuantity(Types.Entities.FLASK)).toBe(0);
            expect(fixture.getChestQuantity(Types.Entities.FLASK)).toBe(3);
            expect(fixture.messages.some((message) => message[0] === Types.Messages.REJECT && message[3] === 'out_of_range')).toBe(true);
        },
        { playerPosition: gridPos(1, 1), chestPosition: gridPos(50, 50) }
    );
});

test('chest transfer rejects claimed chest without edit permission', () => {
    withFixture((fixture) => {
        fixture.seedChest({ itemKind: Types.Entities.FLASK, quantity: 3 });
        const claims = fixture.pipeline.state.resources.require(CLAIMS_STORE_RESOURCE);
        claims.createClaim({
            ownerName: 'other-player',
            x1: 5,
            y1: 6,
            x2: 5,
            y2: 6,
            nowMs: 1000,
        });

        fixture.enqueueTransfer({
            itemKind: Types.Entities.FLASK,
            quantity: 1,
            direction: 'chest_to_inventory',
        });
        fixture.pipeline.tick();

        expect(fixture.getInventoryQuantity(Types.Entities.FLASK)).toBe(0);
        expect(fixture.getChestQuantity(Types.Entities.FLASK)).toBe(3);
        expect(fixture.messages.some((message) => message[0] === Types.Messages.REJECT && message[3] === 'PERMISSION:claimed_no_access')).toBe(true);
    });
});
