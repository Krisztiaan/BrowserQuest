import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createResourceKey } from '../../../server/ecs/resources';
import WorldServer from '../../../server/world-server';
import type { ChunkOverlayStore } from '../../../server/world/chunks/chunk-overlay-store';
import { createCoreServerModuleRegistry, INTENT_RESOURCE_HARVEST } from '../../../server/world/ecs-command-pipeline/core-module-registry';
import { SqliteResourcePersistence } from '../../../server/world/resources/resource-persistence';
import type { ResourceDefinitions } from '../../../server/world/resources/resource-state';
import {
    decodeResourceHarvestIntentPayload,
    encodeResourceHarvestIntentPayload,
} from '../../../shared/protocol/intents';

const resourceDefinitions: ResourceDefinitions = Object.freeze({
    tree_oak_small: Object.freeze({
        tool: 'axe',
        drops: Object.freeze([{ item: 'wood', quantity: 3 }]),
        respawnDays: 3,
    }),
    rock_small: Object.freeze({
        tool: 'pickaxe',
        drops: Object.freeze([{ item: 'stone', quantity: 2 }]),
        respawnDays: 2,
    }),
});

function withResourcePersistence<T>(fn: (persistence: SqliteResourcePersistence) => T): T {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'bq-resources-'));
    const dbPath = path.join(dir, 'resources.sqlite');
    const persistence = new SqliteResourcePersistence(dbPath, resourceDefinitions);
    try {
        return fn(persistence);
    } finally {
        persistence.close();
        rmSync(dir, { recursive: true, force: true });
    }
}

test('resource harvest intent id and codec are stable', () => {
    expect(INTENT_RESOURCE_HARVEST).toBe('resource.harvest');
    const bytes = encodeResourceHarvestIntentPayload({ nodeId: 'oak_1', tool: 'axe' });
    expect(decodeResourceHarvestIntentPayload(bytes ?? [])).toEqual({ nodeId: 'oak_1', tool: 'axe' });
    expect(encodeResourceHarvestIntentPayload({ nodeId: 'rock_1', tool: 'pickaxe' })).not.toBeNull();
    expect(encodeResourceHarvestIntentPayload({ nodeId: 'weed_1', tool: 'scythe' })).not.toBeNull();
});

test('resource harvest intent handler is registered in the core module registry', () => {
    const modules = createCoreServerModuleRegistry({
        chunkOverlayStoreResource: createResourceKey<ChunkOverlayStore>('test.chunk_overlays'),
        resolvePlayerIdentityKey: () => null,
        applyMoveIntentCommand: () => undefined,
        applyMoveToIntentCommand: () => undefined,
        applyMoveInputIntentCommand: () => undefined,
        applyTeleportOutcome: () => undefined,
    });

    expect(modules.getIntentHandler(INTENT_RESOURCE_HARVEST)).toBeDefined();
});

test('resource node harvest persists depletion and respawns after configured days', () => {
    withResourcePersistence((persistence) => {
        expect(
            persistence.upsertResourceNode({
                id: 'oak_1',
                mapId: 'world_01',
                x: 10,
                y: 10,
                kind: 'tree_oak_small',
            })
        ).toEqual({ accepted: true });
        expect(persistence.getResourceNode('oak_1')).toMatchObject({
            id: 'oak_1',
            mapId: 'world_01',
            x: 10,
            y: 10,
            kind: 'tree_oak_small',
            depleted: false,
            respawnDay: null,
        });

        expect(
            persistence.harvestResourceNode({
                nodeId: 'oak_1',
                tool: 'axe',
                playerMapId: 'world_01',
                playerX: 10,
                playerY: 11,
                currentDay: 7,
            })
        ).toEqual({ accepted: true, drops: [{ item: 'wood', quantity: 3 }] });
        expect(persistence.getResourceNode('oak_1')).toMatchObject({
            depleted: true,
            respawnDay: 10,
        });
        expect(
            persistence.harvestResourceNode({
                nodeId: 'oak_1',
                tool: 'axe',
                playerMapId: 'world_01',
                playerX: 10,
                playerY: 11,
                currentDay: 10,
            })
        ).toEqual({ accepted: true, drops: [{ item: 'wood', quantity: 3 }] });
        expect(persistence.getResourceNode('oak_1')).toMatchObject({
            depleted: true,
            respawnDay: 13,
        });
        expect(
            persistence.harvestResourceNode({
                nodeId: 'oak_1',
                tool: 'axe',
                playerMapId: 'world_01',
                playerX: 10,
                playerY: 11,
                currentDay: 11,
            })
        ).toEqual({ accepted: false, reason: 'depleted' });

        expect(persistence.advanceDay(12)).toEqual({ respawned: 0 });
        expect(persistence.getResourceNode('oak_1')?.depleted).toBe(true);
        expect(persistence.advanceDay(13)).toEqual({ respawned: 1 });
        expect(persistence.getResourceNode('oak_1')).toMatchObject({
            depleted: false,
            respawnDay: null,
        });
    });
});

test('resource node restore undepletes after external grant failure', () => {
    withResourcePersistence((persistence) => {
        expect(
            persistence.upsertResourceNode({
                id: 'rock_2',
                mapId: 'world_01',
                x: 4,
                y: 4,
                kind: 'rock_small',
            })
        ).toEqual({ accepted: true });
        expect(
            persistence.harvestResourceNode({
                nodeId: 'rock_2',
                tool: 'pickaxe',
                playerMapId: 'world_01',
                playerX: 4,
                playerY: 4,
                currentDay: 2,
            })
        ).toEqual({ accepted: true, drops: [{ item: 'stone', quantity: 2 }] });
        expect(persistence.getResourceNode('rock_2')).toMatchObject({
            depleted: true,
            respawnDay: 4,
        });
        expect(persistence.restoreResourceNode('rock_2')).toEqual({ accepted: true });
        expect(persistence.getResourceNode('rock_2')).toMatchObject({
            depleted: false,
            respawnDay: null,
        });
    });
});

test('resource nodes with the same id are isolated by map id', () => {
    withResourcePersistence((persistence) => {
        expect(
            persistence.upsertResourceNode({
                id: 'shared_rock',
                mapId: 'mine_a',
                x: 4,
                y: 4,
                kind: 'rock_small',
            })
        ).toEqual({ accepted: true });
        expect(
            persistence.upsertResourceNode({
                id: 'shared_rock',
                mapId: 'mine_b',
                x: 20,
                y: 20,
                kind: 'rock_small',
            })
        ).toEqual({ accepted: true });

        expect(
            persistence.harvestResourceNode({
                nodeId: 'shared_rock',
                tool: 'pickaxe',
                playerMapId: 'mine_a',
                playerX: 4,
                playerY: 4,
                currentDay: 1,
            })
        ).toEqual({ accepted: true, drops: [{ item: 'stone', quantity: 2 }] });
        expect(persistence.getResourceNode('shared_rock', 'mine_a')).toMatchObject({ depleted: true });
        expect(persistence.getResourceNode('shared_rock', 'mine_b')).toMatchObject({ depleted: false });
        expect(
            persistence.harvestResourceNode({
                nodeId: 'shared_rock',
                tool: 'pickaxe',
                playerMapId: 'mine_b',
                playerX: 20,
                playerY: 20,
                currentDay: 1,
            })
        ).toEqual({ accepted: true, drops: [{ item: 'stone', quantity: 2 }] });
    });
});

test('world harvest restores resource node when inventory grant fails', () => {
    const world = new WorldServer('resource-grant-failure-test', 2000, {
        getConnection() {
            return undefined;
        },
    });
    const restoredNodes: string[] = [];
    world.setPlayerPersistence({
        claimPlayerSession() {
            return { accepted: false, reason: 'invalid_name' };
        },
        releasePlayerSession() {},
        persistEquipment() {},
        persistCheckpoint() {},
        persistAchievementUnlock() {},
        transferChestItem() {
            return { accepted: false, reason: 'invalid_chest' };
        },
        buyShopItem() {
            return { accepted: false, reason: 'unknown_shop' };
        },
        sellShopItem() {
            return { accepted: false, reason: 'unknown_shop' };
        },
        grantInventoryItems() {
            return { accepted: false, reason: 'inventory_full' };
        },
        incrementAchievementCounters() {},
        getAchievementProgressByName() {
            return null;
        },
    });
    world.resourcePersistence = {
        harvestResourceNode() {
            return { accepted: true, drops: [{ item: 'stone', quantity: 2 }] };
        },
        restoreResourceNode(nodeId: string, mapId?: string) {
            restoredNodes.push(`${mapId ?? 'unknown'}:${nodeId}`);
            return { accepted: true };
        },
    } as never;

    expect(
        world.harvestResourceNode({
            playerIdentity: 'Farmer',
            nodeId: 'rock_1',
            tool: 'pickaxe',
            playerMapId: 'world_01',
            playerX: 4,
            playerY: 4,
        })
    ).toEqual({ accepted: false, reason: 'inventory_full' });
    expect(restoredNodes).toEqual(['world_01:rock_1']);
});

test('resource node harvest rejects wrong tools and out-of-range players without depleting', () => {
    withResourcePersistence((persistence) => {
        expect(
            persistence.upsertResourceNode({
                id: 'rock_1',
                mapId: 'world_01',
                x: 4,
                y: 4,
                kind: 'rock_small',
            })
        ).toEqual({ accepted: true });

        expect(
            persistence.harvestResourceNode({
                nodeId: 'rock_1',
                tool: 'axe',
                playerMapId: 'world_01',
                playerX: 4,
                playerY: 4,
                currentDay: 2,
            })
        ).toEqual({ accepted: false, reason: 'wrong_tool' });
        expect(
            persistence.harvestResourceNode({
                nodeId: 'rock_1',
                tool: 'pickaxe',
                playerMapId: 'world_01',
                playerX: 8,
                playerY: 4,
                currentDay: 2,
            })
        ).toEqual({ accepted: false, reason: 'out_of_range' });
        expect(persistence.getResourceNode('rock_1')).toMatchObject({
            depleted: false,
            respawnDay: null,
        });
    });
});
