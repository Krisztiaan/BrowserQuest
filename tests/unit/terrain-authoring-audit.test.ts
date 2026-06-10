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
