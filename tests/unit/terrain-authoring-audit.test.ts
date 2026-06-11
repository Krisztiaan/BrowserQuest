import { expect, test } from 'bun:test';
import { findMapPropertyFindings, findWangTilesetFindings, summarize } from '../../tools/content/terrain-authoring-audit';

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
