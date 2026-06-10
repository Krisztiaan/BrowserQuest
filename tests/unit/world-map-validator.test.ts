import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { expect, test } from 'bun:test';
import { LEGACY_LAYER_PATH_ALLOWLIST, isKnownLayerPath } from '../../shared/maps/layer-contract';

type ValidatorJsonOutput = Readonly<{
    summary: Readonly<{ errors: number; warns: number; infos: number }>;
    diagnostics: ReadonlyArray<Readonly<{ level: string; code: string; message: string }>>;
}>;

function writeMapWithLayerPath(filePath: string, layerPath: string): void {
    const pathSegments = layerPath.split('/');
    const leafName = pathSegments.at(-1);
    if (!leafName) {
        throw new Error(`Invalid layer path: ${layerPath}`);
    }

    let layer: Record<string, unknown> = {
        id: 1,
        name: leafName,
        type: 'tilelayer',
        visible: true,
        width: 1,
        height: 1,
        data: [0],
    };

    for (let index = pathSegments.length - 2; index >= 0; index -= 1) {
        layer = {
            id: index + 2,
            name: pathSegments[index],
            type: 'group',
            visible: true,
            layers: [layer],
        };
    }

    writeFileSync(
        filePath,
        JSON.stringify(
            {
                compressionlevel: -1,
                height: 1,
                width: 1,
                infinite: false,
                layers: [layer],
                nextlayerid: 10,
                nextobjectid: 1,
                orientation: 'orthogonal',
                renderorder: 'right-down',
                tiledversion: '1.11.2',
                tileheight: 16,
                tilesets: [],
                tilewidth: 16,
                type: 'map',
                version: '1.10',
            },
            null,
            2
        )
    );
}

test('world-map validator reports unknown recursive layer paths', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'bq-world-map-validator-'));
    try {
        const mapPath = path.join(dir, 'unknown-layer.json');
        writeMapWithLayerPath(mapPath, 'render_world/untracked_biome/mystery_tiles');

        const result = spawnSync(
            process.execPath,
            ['tools/content/world-map-validator.ts', '--map', mapPath, '--profile', 'legacy', '--json'],
            { cwd: process.cwd(), encoding: 'utf8' }
        );

        expect(result.status).toBe(1);
        const output = JSON.parse(result.stdout) as ValidatorJsonOutput;
        expect(output.summary.errors).toBe(1);
        const diagnostic = output.diagnostics.find((entry) => entry.code === 'UNKNOWN_LAYER_PATH');
        expect(diagnostic?.level).toBe('error');
        expect(diagnostic?.message).toContain('render_world/untracked_biome/mystery_tiles');
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test('layer contract keeps known legacy layer debt explicit', () => {
    expect(LEGACY_LAYER_PATH_ALLOWLIST).toContain('render_world/village_biome/village_boundaries_level_2');
    expect(LEGACY_LAYER_PATH_ALLOWLIST).toContain('render_world/deadlands_biome/dry_ground_2');
    expect(LEGACY_LAYER_PATH_ALLOWLIST).toContain('render_world/badlands_biome/cliffs_2');
    expect(LEGACY_LAYER_PATH_ALLOWLIST).toContain('render_world/foreground_overlays');

    for (const layerPath of LEGACY_LAYER_PATH_ALLOWLIST) {
        expect(isKnownLayerPath(layerPath)).toBe(true);
    }
});
