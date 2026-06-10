import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import npcDefinitionsJson from '../../../assets/content/npcs.json';
import shopDefinitionsJson from '../../../assets/content/shops.json';
import Types from '../../../shared/gametypes-browser';
import { createResourceKey } from '../../../server/ecs/resources';
import { SqlitePlayerPersistence } from '../../../server/player-persistence';
import type { ChunkOverlayStore } from '../../../server/world/chunks/chunk-overlay-store';
import {
    createCoreServerModuleRegistry,
    INTENT_NPC_TALK,
    INTENT_SHOP_BUY,
    INTENT_SHOP_SELL,
} from '../../../server/world/ecs-command-pipeline/core-module-registry';
import { resolveNpcDialogue } from '../../../server/world/shops/shop-service';
import type { NpcDefinitions, ShopDefinitions } from '../../../server/world/shops/shop-state';
import {
    decodeNpcTalkIntentPayload,
    decodeShopBuyIntentPayload,
    decodeShopSellIntentPayload,
    encodeNpcTalkIntentPayload,
    encodeShopBuyIntentPayload,
    encodeShopSellIntentPayload,
} from '../../../shared/protocol/intents';

const npcDefinitions = npcDefinitionsJson as NpcDefinitions;
const shopDefinitions = shopDefinitionsJson as ShopDefinitions;

function withShopFixture<T>(fn: (fixture: ReturnType<typeof createShopFixture>) => T, opts: { gold?: number } = {}): T {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'bq-shop-'));
    const persistence = new SqlitePlayerPersistence(path.join(dir, 'players.sqlite'));
    try {
        const fixture = createShopFixture(persistence, opts);
        return fn(fixture);
    } finally {
        persistence.close();
        rmSync(dir, { recursive: true, force: true });
    }
}

function createShopFixture(persistence: SqlitePlayerPersistence, opts: { gold?: number } = {}) {
    const claim = persistence.claimPlayerSession({ connectionId: 'conn-farmer', requestedName: 'Farmer' });
    expect(claim.accepted).toBe(true);
    persistence.persistProgression({
        playerName: 'farmer',
        progression: {
            gold: opts.gold ?? 0,
        },
    });

    return {
        persistence,
        buy({ shopId, item, quantity }: { shopId: string; item: string; quantity: number }) {
            return persistence.buyShopItem({
                accountNameKey: 'farmer',
                shopId,
                item,
                quantity,
                shopDefinitions,
            });
        },
        sell({ shopId, item, quantity }: { shopId: string; item: string; quantity: number }) {
            return persistence.sellShopItem({
                accountNameKey: 'farmer',
                shopId,
                item,
                quantity,
                shopDefinitions,
            });
        },
        seedInventory(itemKind: number, quantity: number) {
            const profile = persistence.getProfileByName('farmer');
            expect(profile).not.toBeNull();
            persistence.persistProgression({
                playerName: 'farmer',
                progression: {
                    inventory: [{ itemKind, quantity }],
                },
            });
        },
        seedFullInventory() {
            const entries: Array<{ itemKind: number; quantity: number }> = [];
            Types.forEachKind((itemKind) => {
                if (Types.isItem(itemKind) && itemKind !== Types.Entities.TURNIP_SEED && entries.length < 16) {
                    entries.push({ itemKind, quantity: 1 });
                }
            });
            expect(entries.length).toBe(16);
            persistence.persistProgression({
                playerName: 'farmer',
                progression: {
                    inventory: entries,
                },
            });
        },
        get profile() {
            const profile = persistence.getProfileByName('farmer');
            expect(profile).not.toBeNull();
            return profile?.progression ?? { gold: 0, farmingLevel: 1, farmingXp: 0, homePlotClaimId: null, inventory: [] };
        },
        inventoryQuantity(itemKind: number) {
            const profile = persistence.getProfileByName('farmer');
            expect(profile).not.toBeNull();
            return profile?.progression.inventory.find((entry) => entry.itemKind === itemKind)?.quantity ?? 0;
        },
    };
}

test('npc and shop intent ids and codecs are stable', () => {
    expect(INTENT_NPC_TALK).toBe('npc.talk');
    expect(INTENT_SHOP_BUY).toBe('shop.buy');
    expect(INTENT_SHOP_SELL).toBe('shop.sell');

    const talkBytes = encodeNpcTalkIntentPayload({ npcId: 'shopkeeper_general' });
    expect(decodeNpcTalkIntentPayload(talkBytes ?? [])).toEqual({ npcId: 'shopkeeper_general' });

    const buyBytes = encodeShopBuyIntentPayload({ shopId: 'general_store', item: 'turnip_seed', quantity: 1 });
    expect(decodeShopBuyIntentPayload(buyBytes ?? [])).toEqual({ shopId: 'general_store', item: 'turnip_seed', quantity: 1 });
    expect(encodeShopBuyIntentPayload({ shopId: 'general_store', item: 'turnip_seed', quantity: 0 })).toBeNull();

    const sellBytes = encodeShopSellIntentPayload({ shopId: 'general_store', item: 'turnip', quantity: 2 });
    expect(decodeShopSellIntentPayload(sellBytes ?? [])).toEqual({ shopId: 'general_store', item: 'turnip', quantity: 2 });
    expect(encodeShopSellIntentPayload({ shopId: 'general_store', item: 'turnip', quantity: -1 })).toBeNull();
});

test('npc and shop intent handlers are registered in the core module registry', () => {
    const modules = createCoreServerModuleRegistry({
        chunkOverlayStoreResource: createResourceKey<ChunkOverlayStore>('test.chunk_overlays'),
        resolvePlayerIdentityKey: () => null,
        applyMoveIntentCommand: () => undefined,
        applyMoveToIntentCommand: () => undefined,
        applyMoveInputIntentCommand: () => undefined,
        applyTeleportOutcome: () => undefined,
    });

    expect(modules.getIntentHandler(INTENT_NPC_TALK)).toBeDefined();
    expect(modules.getIntentHandler(INTENT_SHOP_BUY)).toBeDefined();
    expect(modules.getIntentHandler(INTENT_SHOP_SELL)).toBeDefined();
});

test('npc interaction returns configured dialogue', () => {
    expect(resolveNpcDialogue(npcDefinitions, 'shopkeeper_general')).toEqual({
        accepted: true,
        npcId: 'shopkeeper_general',
        displayName: 'Mara',
        text: 'Need supplies?',
    });
    expect(resolveNpcDialogue(npcDefinitions, 'missing_npc')).toEqual({ accepted: false, reason: 'unknown_npc' });
});

test('shop buy spends gold and adds item', () => {
    withShopFixture((fixture) => {
        const result = fixture.buy({ shopId: 'general_store', item: 'turnip_seed', quantity: 1 });
        expect(result).toEqual({ accepted: true });
        expect(fixture.profile.gold).toBe(5);
        expect(fixture.inventoryQuantity(Types.Entities.TURNIP_SEED)).toBe(1);
    }, { gold: 10 });
});

test('shop sell removes owned item and grants gold', () => {
    withShopFixture((fixture) => {
        fixture.seedInventory(Types.Entities.WOOD, 2);
        expect(fixture.sell({ shopId: 'general_store', item: 'wood', quantity: 2 })).toEqual({ accepted: true });
        expect(fixture.profile.gold).toBe(2);
        expect(fixture.inventoryQuantity(Types.Entities.WOOD)).toBe(0);
    }, { gold: 0 });
});

test('shop transactions reject invalid requests without mutating progression', () => {
    withShopFixture((fixture) => {
        expect(fixture.buy({ shopId: 'missing_store', item: 'turnip_seed', quantity: 1 })).toEqual({
            accepted: false,
            reason: 'unknown_shop',
        });
        expect(fixture.buy({ shopId: 'general_store', item: 'unknown_item', quantity: 1 })).toEqual({
            accepted: false,
            reason: 'unknown_item',
        });
        expect(fixture.buy({ shopId: 'general_store', item: 'turnip_seed', quantity: 3 })).toEqual({
            accepted: false,
            reason: 'insufficient_gold',
        });
        expect(fixture.sell({ shopId: 'general_store', item: 'stone', quantity: 1 })).toEqual({
            accepted: false,
            reason: 'missing_inventory_item',
        });
        expect(fixture.profile.gold).toBe(5);
        expect(fixture.profile.inventory).toEqual([]);
    }, { gold: 5 });
});

test('shop buy rejects when adding a new stack would exceed inventory capacity', () => {
    withShopFixture((fixture) => {
        fixture.seedFullInventory();
        expect(fixture.buy({ shopId: 'general_store', item: 'turnip_seed', quantity: 1 })).toEqual({
            accepted: false,
            reason: 'inventory_full',
        });
        expect(fixture.profile.gold).toBe(100);
        expect(fixture.inventoryQuantity(Types.Entities.TURNIP_SEED)).toBe(0);
    }, { gold: 100 });
});
