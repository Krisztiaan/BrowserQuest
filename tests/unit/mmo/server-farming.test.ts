import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
    decodeCropHarvestIntentPayload,
    decodeCropPlantIntentPayload,
    decodeToolUseIntentPayload,
    encodeCropHarvestIntentPayload,
    encodeCropPlantIntentPayload,
    encodeToolUseIntentPayload,
    INTENT_CROP_HARVEST,
    INTENT_CROP_PLANT,
    INTENT_TOOL_USE,
} from '../../../shared/protocol/intents';
import { createResourceKey } from '../../../server/ecs/resources';
import { createCoreServerModuleRegistry } from '../../../server/world/ecs-command-pipeline/core-module-registry';
import type { ChunkOverlayStore } from '../../../server/world/chunks/chunk-overlay-store';
import { SqliteCropPersistence } from '../../../server/world/farming/crop-persistence';
import type { CropDefinitions } from '../../../server/world/farming/crop-state';

const cropDefinitions: CropDefinitions = Object.freeze({
    turnip: Object.freeze({
        seedItem: 'turnip_seed',
        harvestItem: 'turnip',
        growthDays: 3,
        regrows: false,
    }),
});

function withCropPersistence<T>(fn: (persistence: SqliteCropPersistence) => T): T {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'bq-crops-'));
    const dbPath = path.join(dir, 'crops.sqlite');
    const persistence = new SqliteCropPersistence(dbPath, cropDefinitions);
    try {
        return fn(persistence);
    } finally {
        persistence.close();
        rmSync(dir, { recursive: true, force: true });
    }
}

test('farming intent ids and codecs are stable', () => {
    expect(INTENT_TOOL_USE).toBe('tool.use');
    expect(INTENT_CROP_PLANT).toBe('crop.plant');
    expect(INTENT_CROP_HARVEST).toBe('crop.harvest');

    const toolBytes = encodeToolUseIntentPayload({ tool: 'hoe', x: 10, y: 10 });
    expect(decodeToolUseIntentPayload(toolBytes ?? [])).toEqual({ tool: 'hoe', x: 10, y: 10 });
    expect(encodeToolUseIntentPayload({ tool: 'watering_can', x: 10, y: 10 })).not.toBeNull();
    expect(decodeToolUseIntentPayload(encodeToolUseIntentPayload({ tool: 'watering_can', x: 1, y: 2 }) ?? [])).toEqual({
        tool: 'watering_can',
        x: 1,
        y: 2,
    });

    const plantBytes = encodeCropPlantIntentPayload({ cropId: 'turnip', seedItemId: 'turnip_seed', x: 10, y: 10 });
    expect(decodeCropPlantIntentPayload(plantBytes ?? [])).toEqual({ cropId: 'turnip', seedItemId: 'turnip_seed', x: 10, y: 10 });
    const harvestBytes = encodeCropHarvestIntentPayload({ x: 10, y: 10 });
    expect(decodeCropHarvestIntentPayload(harvestBytes ?? [])).toEqual({ x: 10, y: 10 });
});

test('farming intent handlers are registered in the core module registry', () => {
    const modules = createCoreServerModuleRegistry({
        chunkOverlayStoreResource: createResourceKey<ChunkOverlayStore>('test.chunk_overlays'),
        resolvePlayerIdentityKey: () => null,
        applyMoveIntentCommand: () => undefined,
        applyMoveToIntentCommand: () => undefined,
        applyMoveInputIntentCommand: () => undefined,
        applyTeleportOutcome: () => undefined,
    });

    expect(modules.getIntentHandler(INTENT_TOOL_USE)).toBeDefined();
    expect(modules.getIntentHandler(INTENT_CROP_PLANT)).toBeDefined();
    expect(modules.getIntentHandler(INTENT_CROP_HARVEST)).toBeDefined();
});

test('crop tile loop persists till plant water grow and harvest state', () => {
    withCropPersistence((persistence) => {
        expect(persistence.tillTile({ mapId: 'world_01', x: 10, y: 10, farmable: true })).toEqual({ accepted: true });
        expect(persistence.getCropTile('world_01', 10, 10)).toMatchObject({
            mapId: 'world_01',
            x: 10,
            y: 10,
            cropId: null,
            tilled: true,
            wateredToday: false,
            growth: 0,
        });

        expect(
            persistence.plantCrop({
                mapId: 'world_01',
                x: 10,
                y: 10,
                cropId: 'turnip',
                seedItemId: 'turnip_seed',
            })
        ).toEqual({ accepted: true });
        expect(persistence.getCropTile('world_01', 10, 10)).toMatchObject({
            tilled: true,
            cropId: 'turnip',
            wateredToday: false,
            growth: 0,
        });

        for (let i = 0; i < 3; i += 1) {
            expect(persistence.waterTile({ mapId: 'world_01', x: 10, y: 10 })).toEqual({ accepted: true });
            expect(persistence.advanceDay()).toEqual({ advanced: 1 });
        }

        expect(persistence.getCropTile('world_01', 10, 10)).toMatchObject({
            cropId: 'turnip',
            wateredToday: false,
            growth: 3,
        });
        expect(persistence.harvest({ mapId: 'world_01', x: 10, y: 10 })).toEqual({
            accepted: true,
            itemId: 'turnip',
            quantity: 1,
        });
        expect(persistence.getCropTile('world_01', 10, 10)).toMatchObject({
            tilled: true,
            cropId: null,
            growth: 0,
        });
    });
});

test('crop tile loop rejects unfarmable tilling and planting without seed', () => {
    withCropPersistence((persistence) => {
        expect(persistence.tillTile({ mapId: 'world_01', x: 1, y: 1, farmable: false })).toEqual({
            accepted: false,
            reason: 'unfarmable_tile',
        });
        expect(persistence.getCropTile('world_01', 1, 1)).toBeNull();

        expect(persistence.tillTile({ mapId: 'world_01', x: 2, y: 2, farmable: true })).toEqual({ accepted: true });
        expect(
            persistence.plantCrop({
                mapId: 'world_01',
                x: 2,
                y: 2,
                cropId: 'turnip',
                seedItemId: null,
            })
        ).toEqual({ accepted: false, reason: 'missing_seed' });
        expect(persistence.getCropTile('world_01', 2, 2)).toMatchObject({
            tilled: true,
            cropId: null,
            growth: 0,
        });
    });
});
