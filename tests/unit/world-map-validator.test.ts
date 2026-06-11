import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { expect, test } from 'bun:test';
import {
    LAYER_ROLE_VALUES,
    LEGACY_LAYER_PATH_ALLOWLIST,
    REQUIRED_SEMANTIC_LAYER_PROPERTIES,
    SEMANTIC_LAYER_ENUM_PROPERTY_TYPES,
    SEMANTIC_LAYER_PHASE_ORDER,
    SEMANTIC_LAYER_STRUCTURE_RULES,
    getSemanticLayerPhaseOrder,
    getSemanticLayerStructureRule,
    isCollisionSource,
    isKnownLayerPath,
    isLayerRole,
    isOcclusionMode,
} from '../../shared/maps/layer-contract';

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

function runValidator(mapPath: string): ValidatorJsonOutput & { status: number | null } {
    const result = spawnSync(
        process.execPath,
        ['tools/content/world-map-validator.ts', '--map', mapPath, '--profile', 'target', '--json'],
        { cwd: process.cwd(), encoding: 'utf8' }
    );
    return {
        ...(JSON.parse(result.stdout) as ValidatorJsonOutput),
        status: result.status,
    };
}

function writeWorldMapWithDoorPatch(
    filePath: string,
    doorName: string,
    patch: (door: { properties?: Array<{ name: string; type?: string; value: string | number | boolean }> }) => void
): void {
    const map = JSON.parse(readFileSync('assets/maps/tiled/world.json', 'utf8')) as {
        layers: Array<{ name?: string; layers?: Array<{ name?: string; objects?: unknown[] }> }>;
    };
    const gameplay = map.layers.find((layer) => layer.name === 'gameplay_markup');
    const doors = gameplay?.layers?.find((layer) => layer.name === 'doors');
    const door = doors?.objects?.find((entry) => {
        return (
            typeof entry === 'object' &&
            entry !== null &&
            'name' in entry &&
            (entry as { name?: unknown }).name === doorName
        );
    }) as { properties?: Array<{ name: string; type?: string; value: string | number | boolean }> } | undefined;
    if (!door) {
        throw new Error(`Missing door ${doorName}`);
    }
    patch(door);
    writeFileSync(filePath, JSON.stringify(map, null, 2));
}

function writeWorldMapWithLayerPatch(
    filePath: string,
    layerPath: string,
    patch: (layer: { properties?: Array<{ name: string; type?: string; propertytype?: string; value: string | number | boolean }> }) => void
): void {
    const map = JSON.parse(readFileSync('assets/maps/tiled/world.json', 'utf8')) as {
        layers: Array<Record<string, unknown>>;
    };
    const pathSegments = layerPath.split('/');

    function findLayer(layers: Array<Record<string, unknown>>, index: number): Record<string, unknown> | undefined {
        const segment = pathSegments[index];
        const layer = layers.find((entry) => entry.name === segment);
        if (!layer || index === pathSegments.length - 1) {
            return layer;
        }
        return findLayer((layer.layers as Array<Record<string, unknown>> | undefined) ?? [], index + 1);
    }

    const layer = findLayer(map.layers, 0) as
        | { properties?: Array<{ name: string; type?: string; propertytype?: string; value: string | number | boolean }> }
        | undefined;
    if (!layer) {
        throw new Error(`Missing layer ${layerPath}`);
    }
    patch(layer);
    writeFileSync(filePath, JSON.stringify(map, null, 2));
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

test('world-map validator requires target layer semantic properties', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'bq-world-map-validator-'));
    try {
        const mapPath = path.join(dir, 'missing-layer-semantics.json');
        writeWorldMapWithLayerPatch(mapPath, 'render_world/beach_biome/sand', (layer) => {
            layer.properties = layer.properties?.filter((property) => property.name !== 'layer_role');
        });

        const output = runValidator(mapPath);

        expect(output.status).toBe(1);
        const diagnostic = output.diagnostics.find((entry) => entry.code === 'LAYER_SEMANTIC_PROPERTY_MISSING');
        expect(diagnostic?.level).toBe('error');
        expect(diagnostic?.message).toContain('sand');
        expect(diagnostic?.message).toContain('layer_role');
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test('world-map validator rejects invalid target layer semantic enum values', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'bq-world-map-validator-'));
    try {
        const mapPath = path.join(dir, 'invalid-layer-semantics.json');
        writeWorldMapWithLayerPatch(mapPath, 'render_world/beach_biome/sand', (layer) => {
            const role = layer.properties?.find((property) => property.name === 'layer_role');
            if (!role) {
                throw new Error('Expected layer_role on sand layer');
            }
            role.value = 'terrainish';
        });

        const output = runValidator(mapPath);

        expect(output.status).toBe(1);
        const diagnostic = output.diagnostics.find((entry) => entry.code === 'LAYER_SEMANTIC_PROPERTY_INVALID');
        expect(diagnostic?.level).toBe('error');
        expect(diagnostic?.message).toContain('terrainish');
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test('world-map validator requires Tiled enum typing on target layer semantic enum properties', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'bq-world-map-validator-'));
    try {
        const mapPath = path.join(dir, 'untyped-layer-semantics.json');
        writeWorldMapWithLayerPatch(mapPath, 'render_world/beach_biome/sand', (layer) => {
            const role = layer.properties?.find((property) => property.name === 'layer_role');
            if (!role) {
                throw new Error('Expected layer_role on sand layer');
            }
            delete role.propertytype;
        });

        const output = runValidator(mapPath);

        expect(output.status).toBe(1);
        const diagnostic = output.diagnostics.find((entry) => entry.code === 'LAYER_SEMANTIC_PROPERTY_UNTYPED');
        expect(diagnostic?.level).toBe('error');
        expect(diagnostic?.message).toContain('layer_role');
        expect(diagnostic?.message).toContain('LayerRole');
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test('world-map validator rejects target layer semantic role structure mismatches', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'bq-world-map-validator-'));
    try {
        const mapPath = path.join(dir, 'invalid-layer-structure.json');
        writeWorldMapWithLayerPatch(mapPath, 'render_world/beach_biome/beach_props', (layer) => {
            const role = layer.properties?.find((property) => property.name === 'layer_role');
            if (!role) {
                throw new Error('Expected layer_role on beach_props layer');
            }
            role.value = 'base';
        });

        const output = runValidator(mapPath);

        expect(output.status).toBe(1);
        const diagnostic = output.diagnostics.find((entry) => entry.code === 'LAYER_SEMANTIC_STRUCTURE_INVALID');
        expect(diagnostic?.level).toBe('error');
        expect(diagnostic?.message).toContain('beach_props');
        expect(diagnostic?.message).toContain('base');
        expect(diagnostic?.message).toContain('objectgroup');
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test('world-map validator rejects hidden render layers by semantic role', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'bq-world-map-validator-'));
    try {
        const mapPath = path.join(dir, 'hidden-render-layer.json');
        writeWorldMapWithLayerPatch(mapPath, 'render_world/beach_biome/sand', (layer) => {
            (layer as { visible?: boolean }).visible = false;
        });

        const output = runValidator(mapPath);

        expect(output.status).toBe(1);
        const diagnostic = output.diagnostics.find((entry) => entry.code === 'LAYER_SEMANTIC_STRUCTURE_INVALID');
        expect(diagnostic?.level).toBe('error');
        expect(diagnostic?.message).toContain('visible=true');
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test('world-map validator rejects semantic phase order regressions', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'bq-world-map-validator-'));
    try {
        const mapPath = path.join(dir, 'invalid-layer-phase-order.json');
        writeWorldMapWithLayerPatch(mapPath, 'render_world/foreground_overlays/cliffs_foreground', (layer) => {
            const role = layer.properties?.find((property) => property.name === 'layer_role');
            if (!role) {
                throw new Error('Expected layer_role on cliffs_foreground layer');
            }
            role.value = 'gameplay';
        });

        const output = runValidator(mapPath);

        expect(output.status).toBe(1);
        const diagnostic = output.diagnostics.find((entry) => entry.code === 'LAYER_SEMANTIC_PHASE_ORDER_INVALID');
        expect(diagnostic?.level).toBe('error');
        expect(diagnostic?.message).toContain('cave_walls_foreground');
        expect(diagnostic?.message).toContain('cliffs_foreground');
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test('semantic layer contract exposes shared domains for validators and docs', () => {
    expect(REQUIRED_SEMANTIC_LAYER_PROPERTIES).toEqual([
        'layer_role',
        'collision_source',
        'occlusion',
        'material',
        'biome',
        'area_id',
    ]);
    expect(SEMANTIC_LAYER_ENUM_PROPERTY_TYPES).toEqual({
        layer_role: 'LayerRole',
        collision_source: 'CollisionSource',
        occlusion: 'OcclusionMode',
    });
    expect(SEMANTIC_LAYER_STRUCTURE_RULES.object_depth.requiredClass).toBe('DepthSorted');
    expect(getSemanticLayerStructureRule('gameplay')).toMatchObject({
        allowedTypes: ['objectgroup'],
        allowedCollisionSources: ['none'],
        allowedOcclusionModes: ['none'],
        requiredVisible: false,
    });
    expect(SEMANTIC_LAYER_PHASE_ORDER).toMatchObject({
        base: 0,
        foreground: 1,
        gameplay: 2,
    });
    expect(getSemanticLayerPhaseOrder('structure')).toBeLessThan(getSemanticLayerPhaseOrder('foreground'));
    expect(getSemanticLayerPhaseOrder('foreground')).toBeLessThan(getSemanticLayerPhaseOrder('gameplay'));
    expect(LAYER_ROLE_VALUES).toContain('object_depth');
    expect(isLayerRole('hazard')).toBe(true);
    expect(isLayerRole('terrainish')).toBe(false);
    expect(isCollisionSource('explicit')).toBe(true);
    expect(isCollisionSource('blocked')).toBe(false);
    expect(isOcclusionMode('always_front')).toBe(true);
    expect(isOcclusionMode('opaque')).toBe(false);
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

test('world-map validator allows graph-linked doors without raw target coordinates', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'bq-world-map-validator-'));
    try {
        const mapPath = path.join(dir, 'graph-door.json');
        writeWorldMapWithDoorPatch(mapPath, 'world_house_03_entry', (door) => {
            door.properties = door.properties?.filter(
                (property) => property.name !== 'target_tx' && property.name !== 'target_ty'
            );
        });

        const output = runValidator(mapPath);

        expect(output.status).toBe(0);
        expect(output.summary.errors).toBe(0);
        expect(output.diagnostics.some((entry) => entry.code === 'DOOR_PROPERTY_MISSING')).toBe(false);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test('world-map validator still requires target coordinates for plain coordinate doors', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'bq-world-map-validator-'));
    try {
        const mapPath = path.join(dir, 'plain-door.json');
        writeWorldMapWithDoorPatch(mapPath, 'forest_maze_tp_127_190_to_74_145', (door) => {
            door.properties = door.properties?.filter(
                (property) => property.name !== 'target_tx' && property.name !== 'target_ty'
            );
        });

        const output = runValidator(mapPath);

        expect(output.status).toBe(1);
        const missing = output.diagnostics.filter((entry) => entry.code === 'DOOR_PROPERTY_MISSING');
        expect(missing.map((entry) => entry.message).join('\n')).toContain('target_tx');
        expect(missing.map((entry) => entry.message).join('\n')).toContain('target_ty');
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test('world-map validator rejects redundant target coordinates on graph-linked doors', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'bq-world-map-validator-'));
    try {
        const mapPath = path.join(dir, 'redundant-graph-door.json');
        writeWorldMapWithDoorPatch(mapPath, 'world_house_03_entry', (door) => {
            door.properties = [
                ...(door.properties ?? []),
                { name: 'target_tx', type: 'int', value: 6 },
                { name: 'target_ty', type: 'int', value: 7 },
            ];
        });

        const output = runValidator(mapPath);

        expect(output.status).toBe(1);
        const diagnostic = output.diagnostics.find((entry) => entry.code === 'DOOR_GRAPH_COORDINATE_REDUNDANT');
        expect(diagnostic?.level).toBe('error');
        expect(diagnostic?.message).toContain('target_tx');
        expect(diagnostic?.message).toContain('target_ty');
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
