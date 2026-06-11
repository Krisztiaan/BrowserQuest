import { expect, test } from 'bun:test';
import {
    findMapPropertyFindings,
    findTilesetCollisionShapeFindings,
    findTilesetTileSemanticFindings,
    findWangTilesetFindings,
    summarize,
} from '../../tools/content/terrain-authoring-audit';

test('terrain authoring audit classifies a pair set with no mixed transitions as high confidence debt', () => {
    const findings = findWangTilesetFindings(
        {
            image: 'tilesheet.png',
            wangsets: [
                {
                    name: 'water_grass_pair',
                    colors: [{ name: 'water' }, { name: 'grass' }],
                    wangtiles: [
                        { tileid: 1, wangid: [1, 1, 1, 1, 1, 1, 1, 1] },
                        { tileid: 2, wangid: [2, 2, 2, 2, 2, 2, 2, 2] },
                    ],
                },
            ],
        },
        'fixture.tsj'
    );

    const finding = findings.find((entry) => entry.id === 'WANG_PAIR_HAS_NO_MIXED_TRANSITIONS');
    expect(finding?.severity).toBe('high');
});

test('terrain authoring audit reports missing Wang color terrain metadata', () => {
    const findings = findWangTilesetFindings(
        {
            image: 'tilesheet.png',
            wangsets: [
                {
                    name: 'terrain',
                    colors: [{ name: 'water' }],
                    wangtiles: [],
                },
            ],
        },
        'fixture.tsj'
    );

    const finding = findings.find((entry) => entry.id === 'WANG_COLOR_METADATA_MISSING');
    expect(finding?.severity).toBe('medium');
    expect(finding?.evidence.join(';')).toContain('missing=material,terrain_family,terrain_kind,passability');
});

test('terrain authoring audit accepts Wang color metadata matching terrain grammar', () => {
    const findings = findWangTilesetFindings(
        {
            image: 'tilesheet.png',
            wangsets: [
                {
                    name: 'terrain',
                    colors: [
                        {
                            name: 'water',
                            properties: [
                                { name: 'material', value: 'water' },
                                { name: 'terrain_family', value: 'water' },
                                { name: 'terrain_kind', value: 'liquid' },
                                { name: 'passability', value: 'blocked' },
                            ],
                        },
                    ],
                    wangtiles: [],
                },
            ],
        },
        'fixture.tsj',
        {
            families: [{ id: 'water', kind: 'liquid', passability: 'blocked' }],
        }
    );

    expect(findings.some((entry) => entry.id === 'WANG_COLOR_METADATA_MISSING')).toBe(false);
    expect(findings.some((entry) => entry.id === 'WANG_COLOR_FAMILY_UNKNOWN')).toBe(false);
    expect(findings.some((entry) => entry.id === 'WANG_COLOR_METADATA_MISMATCH')).toBe(false);
});

test('terrain authoring audit rejects Wang color metadata that disagrees with terrain grammar', () => {
    const findings = findWangTilesetFindings(
        {
            image: 'tilesheet.png',
            wangsets: [
                {
                    name: 'terrain',
                    colors: [
                        {
                            name: 'water',
                            properties: [
                                { name: 'material', value: 'water' },
                                { name: 'terrain_family', value: 'water' },
                                { name: 'terrain_kind', value: 'base' },
                                { name: 'passability', value: 'walkable' },
                            ],
                        },
                    ],
                    wangtiles: [],
                },
            ],
        },
        'fixture.tsj',
        {
            families: [{ id: 'water', kind: 'liquid', passability: 'blocked' }],
        }
    );

    const finding = findings.find((entry) => entry.id === 'WANG_COLOR_METADATA_MISMATCH');
    expect(finding?.severity).toBe('medium');
    expect(finding?.evidence.join(';')).toContain('expected_kind=liquid');
    expect(finding?.evidence.join(';')).toContain('expected_passability=blocked');
});

test('terrain authoring audit reports collision shapes without semantic metadata', () => {
    const findings = findTilesetCollisionShapeFindings(
        {
            tiles: [
                {
                    id: 12,
                    objectgroup: {
                        objects: [{ id: 1, width: 16, height: 16 }],
                    },
                },
            ],
        },
        'fixture.tsj'
    );

    const finding = findings.find((entry) => entry.id === 'COLLISION_SHAPE_METADATA_MISSING');
    expect(finding?.severity).toBe('medium');
    expect(finding?.evidence.join(';')).toContain('class=<none>');
    expect(finding?.evidence.join(';')).toContain('missing=collision_kind,blocks_player,blocks_mobs,blocks_projectiles');
});

test('terrain authoring audit accepts typed collision shape metadata matching passability', () => {
    const findings = findTilesetCollisionShapeFindings(
        {
            tiles: [
                {
                    id: 12,
                    objectgroup: {
                        objects: [
                            {
                                id: 1,
                                class: 'CollisionShape',
                                properties: [
                                    { name: 'collision_kind', propertytype: 'CollisionKind', value: 'solid' },
                                    { name: 'blocks_player', value: true },
                                    { name: 'blocks_mobs', value: true },
                                    { name: 'blocks_projectiles', value: true },
                                ],
                            },
                        ],
                    },
                },
                {
                    id: 13,
                    properties: [{ name: 'passable', value: true }],
                    objectgroup: {
                        objects: [
                            {
                                id: 1,
                                class: 'CollisionShape',
                                properties: [
                                    { name: 'collision_kind', propertytype: 'CollisionKind', value: 'passable_carve' },
                                    { name: 'blocks_player', value: false },
                                    { name: 'blocks_mobs', value: false },
                                    { name: 'blocks_projectiles', value: false },
                                ],
                            },
                        ],
                    },
                },
            ],
        },
        'fixture.tsj'
    );

    expect(findings).toEqual([]);
});

test('terrain authoring audit rejects untyped or inconsistent collision shape metadata', () => {
    const findings = findTilesetCollisionShapeFindings(
        {
            tiles: [
                {
                    id: 12,
                    objectgroup: {
                        objects: [
                            {
                                id: 1,
                                class: 'CollisionShape',
                                properties: [
                                    { name: 'collision_kind', value: 'solid' },
                                    { name: 'blocks_player', value: false },
                                    { name: 'blocks_mobs', value: true },
                                    { name: 'blocks_projectiles', value: true },
                                ],
                            },
                        ],
                    },
                },
            ],
        },
        'fixture.tsj'
    );

    expect(findings.find((entry) => entry.id === 'COLLISION_SHAPE_KIND_UNTYPED')?.severity).toBe('medium');
    const mismatch = findings.find((entry) => entry.id === 'COLLISION_SHAPE_BLOCKING_MISMATCH');
    expect(mismatch?.severity).toBe('medium');
    expect(mismatch?.evidence.join(';')).toContain('mismatch=blocks_player');
});

test('terrain authoring audit reports prop tiles without semantic metadata', () => {
    const findings = findTilesetTileSemanticFindings(
        {
            tiles: [{ id: 7, class: 'PropTile', type: 'tree_1' }],
        },
        'fixture.tsj'
    );

    const finding = findings.find((entry) => entry.id === 'TILE_SEMANTIC_METADATA_MISSING');
    expect(finding?.severity).toBe('medium');
    expect(finding?.evidence.join(';')).toContain('missing=asset_family,asset_part,tile_kind,occlusion_kind,render_height');
});

test('terrain authoring audit reports transition tiles without transition metadata', () => {
    const findings = findTilesetTileSemanticFindings(
        {
            tiles: [{ id: 1833, class: 'TransitionTile', type: 'ladder_hole_1' }],
        },
        'fixture.tsj'
    );

    const finding = findings.find((entry) => entry.id === 'TILE_SEMANTIC_METADATA_MISSING');
    expect(finding?.severity).toBe('medium');
    expect(finding?.evidence.join(';')).toContain('missing=asset_family,asset_part,tile_kind,occlusion_kind,render_height,transition_kind');
});

test('terrain authoring audit accepts typed prop, structure, and transition tile metadata', () => {
    const findings = findTilesetTileSemanticFindings(
        {
            tiles: [
                {
                    id: 7,
                    class: 'PropTile',
                    type: 'tree_1',
                    properties: [
                        { name: 'asset_family', value: 'tree_1' },
                        { name: 'asset_part', value: 'canopy_top' },
                        { name: 'tile_kind', propertytype: 'TileKind', value: 'prop' },
                        { name: 'occlusion_kind', propertytype: 'TileOcclusionKind', value: 'canopy' },
                        { name: 'render_height', value: 5 },
                    ],
                },
                {
                    id: 8,
                    class: 'StructureTile',
                    type: 'house_blue_2',
                    properties: [
                        { name: 'asset_family', value: 'house_blue_2' },
                        { name: 'asset_part', value: 'roof_top' },
                        { name: 'tile_kind', propertytype: 'TileKind', value: 'structure' },
                        { name: 'occlusion_kind', propertytype: 'TileOcclusionKind', value: 'roof' },
                        { name: 'render_height', value: 6 },
                    ],
                },
                {
                    id: 1833,
                    class: 'TransitionTile',
                    type: 'ladder_hole_1',
                    properties: [
                        { name: 'asset_family', value: 'ladder_hole_1' },
                        { name: 'asset_part', value: 'ladder_top_rim' },
                        { name: 'tile_kind', propertytype: 'TileKind', value: 'transition' },
                        { name: 'occlusion_kind', propertytype: 'TileOcclusionKind', value: 'none' },
                        { name: 'transition_kind', propertytype: 'TransitionKind', value: 'ladder' },
                        { name: 'render_height', value: 1 },
                    ],
                },
            ],
        },
        'fixture.tsj'
    );

    expect(findings).toEqual([]);
});

test('terrain authoring audit rejects prop tile enum and family mismatches', () => {
    const findings = findTilesetTileSemanticFindings(
        {
            tiles: [
                {
                    id: 7,
                    class: 'PropTile',
                    type: 'tree_1',
                    properties: [
                        { name: 'asset_family', value: 'tree_2' },
                        { name: 'asset_part', value: 'canopy_top' },
                        { name: 'tile_kind', value: 'prop' },
                        { name: 'occlusion_kind', value: 'canopy' },
                        { name: 'render_height', value: -1 },
                    ],
                },
            ],
        },
        'fixture.tsj'
    );

    expect(findings.find((entry) => entry.id === 'TILE_SEMANTIC_ASSET_FAMILY_MISMATCH')?.severity).toBe('medium');
    expect(findings.find((entry) => entry.id === 'TILE_SEMANTIC_ENUM_UNTYPED')?.severity).toBe('medium');
    expect(findings.find((entry) => entry.id === 'TILE_SEMANTIC_RENDER_HEIGHT_INVALID')?.severity).toBe('medium');
});

test('terrain authoring audit rejects tile kind that disagrees with semantic tile class', () => {
    const findings = findTilesetTileSemanticFindings(
        {
            tiles: [
                {
                    id: 8,
                    class: 'StructureTile',
                    type: 'house_blue_2',
                    properties: [
                        { name: 'asset_family', value: 'house_blue_2' },
                        { name: 'asset_part', value: 'roof_top' },
                        { name: 'tile_kind', propertytype: 'TileKind', value: 'prop' },
                        { name: 'occlusion_kind', propertytype: 'TileOcclusionKind', value: 'roof' },
                        { name: 'render_height', value: 6 },
                    ],
                },
            ],
        },
        'fixture.tsj'
    );

    const finding = findings.find((entry) => entry.id === 'TILE_SEMANTIC_KIND_MISMATCH');
    expect(finding?.severity).toBe('medium');
    expect(finding?.evidence.join(';')).toContain('expected=structure');
});

test('terrain authoring audit rejects untyped transition tile enum metadata', () => {
    const findings = findTilesetTileSemanticFindings(
        {
            tiles: [
                {
                    id: 1833,
                    class: 'TransitionTile',
                    type: 'ladder_hole_1',
                    properties: [
                        { name: 'asset_family', value: 'ladder_hole_1' },
                        { name: 'asset_part', value: 'ladder_top_rim' },
                        { name: 'tile_kind', propertytype: 'TileKind', value: 'transition' },
                        { name: 'occlusion_kind', propertytype: 'TileOcclusionKind', value: 'none' },
                        { name: 'transition_kind', value: 'ladder' },
                        { name: 'render_height', value: 1 },
                    ],
                },
            ],
        },
        'fixture.tsj'
    );

    const finding = findings.find((entry) => entry.id === 'TILE_SEMANTIC_ENUM_UNTYPED');
    expect(finding?.severity).toBe('medium');
    expect(finding?.evidence.join(';')).toContain('transition_kind_propertytype=<none>');
});

test('terrain authoring audit requires map-level authoring properties', () => {
    const findings = findMapPropertyFindings({ layers: [] }, 'fixture.json');

    const finding = findings.find((entry) => entry.id === 'MAP_PROPERTIES_EMPTY');
    expect(finding?.severity).toBe('high');
});

test('terrain authoring audit summary includes zero-count categories', () => {
    const summary = summarize([]);

    expect(summary.map_properties).toBe(0);
    expect(summary.wang_tileset).toBe(0);
    expect(summary.terrain_paint).toBe(0);
});
