import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from 'bun:test';
import { applyRepairPlan, createRepairPlan, main } from '../../tools/content/world-authoring-repair';

function tileLayer(name: string, data: number[], width = 3): Record<string, unknown> {
    return {
        name,
        type: 'tilelayer',
        width,
        height: Math.ceil(data.length / width),
        opacity: 1,
        data: [...data],
    };
}

function fixtureWorld(layers: unknown[]): Record<string, unknown> {
    return {
        width: 3,
        height: 3,
        layers: [
            {
                name: 'render_world',
                type: 'group',
                layers,
            },
        ],
    };
}

const fixtureGrammar = {
    version: 1,
    mapPropertiesRequired: ['map_id'],
};

test('dry run does not mutate the map object', () => {
    const world = fixtureWorld([tileLayer('ground', [7, 0, 0]), tileLayer('overlay', [7, 0, 0])]);
    const before = JSON.stringify(world);

    const plan = createRepairPlan({ world, grammar: fixtureGrammar, generatedAt: '2026-06-10T00:00:00.000Z' });

    expect(plan.changes.some((change) => change.kind === 'remove_duplicate_covered_paint')).toBe(true);
    expect(JSON.stringify(world)).toBe(before);
});

test('duplicate covered paint repair clears only the lower layer cell', () => {
    const lower = tileLayer('ground', [7, 2, 0]);
    const higher = tileLayer('overlay', [7, 0, 0]);
    const world = fixtureWorld([lower, higher]);
    const plan = createRepairPlan({ world, grammar: { mapPropertiesRequired: [] }, generatedAt: '2026-06-10T00:00:00.000Z' });

    applyRepairPlan(world, plan);

    expect(lower.data).toEqual([0, 2, 0]);
    expect(higher.data).toEqual([7, 0, 0]);
});

test('tiny component repair does not remove visible gameplay or collision layers', () => {
    const gameplayLayer = tileLayer('collision', [9, 0, 0]);
    const visibleLayer = tileLayer('ground', [5, 0, 0]);
    const world = {
        width: 3,
        height: 1,
        layers: [
            {
                name: 'render_world',
                type: 'group',
                layers: [visibleLayer],
            },
            {
                name: 'gameplay_markup',
                type: 'group',
                layers: [gameplayLayer],
            },
        ],
    };

    const plan = createRepairPlan({ world, grammar: { mapPropertiesRequired: [] }, generatedAt: '2026-06-10T00:00:00.000Z' });

    expect(plan.changes.some((change) => change.kind === 'remove_accidental_tiny_component')).toBe(false);
    applyRepairPlan(world, plan);
    expect(visibleLayer.data).toEqual([5, 0, 0]);
    expect(gameplayLayer.data).toEqual([9, 0, 0]);
});

test('write mode requires explicit --write', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'bq-world-repair-'));
    try {
        const worldPath = path.join(tempDir, 'world.json');
        const grammarPath = path.join(tempDir, 'terrain-authoring.json');
        const world = fixtureWorld([tileLayer('ground', [7, 0, 0]), tileLayer('overlay', [7, 0, 0])]);
        await writeFile(worldPath, `${JSON.stringify(world, null, 2)}\n`);
        await writeFile(grammarPath, `${JSON.stringify({ mapPropertiesRequired: [] }, null, 2)}\n`);

        await main(['--world', worldPath, '--grammar', grammarPath, '--out-dir', tempDir]);

        const after = JSON.parse(await readFile(worldPath, 'utf8')) as Record<string, unknown>;
        expect(after).toEqual(world);
        expect(await readFile(path.join(tempDir, 'world-authoring-repair-plan.json'), 'utf8')).toContain(
            'remove_duplicate_covered_paint'
        );
    } finally {
        await rm(tempDir, { recursive: true, force: true });
    }
});
