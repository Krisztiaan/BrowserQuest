import { expect, test } from 'bun:test';
import {
    buildPrototypeManifest,
    buildPrototypeTileset,
    maskDrawForShape,
    shorelinePrototypeEntries,
} from '../../tools/content/terrain-transition-prototype';

const grammar = {
    transitionPairs: [
        {
            id: 'shoreline',
            requiredShapes: ['edge_n', 'outer_ne', 'inner_sw', 'island', 'channel_v'],
        },
    ],
};

test('shoreline prototype entries follow grammar shape order', () => {
    const entries = shorelinePrototypeEntries(grammar);

    expect(entries.map((entry) => entry.shape)).toEqual(['edge_n', 'outer_ne', 'inner_sw', 'island', 'channel_v']);
    expect(entries[0]).toMatchObject({
        pair: 'shoreline',
        outputTileId: 0,
        base: { family: 'sand', gid: 140, tileId: 139 },
        overlay: { family: 'water', gid: 405, tileId: 404 },
        mask: 'edge_n.mask',
    });
});

test('prototype masks are named deterministic draw commands', () => {
    expect(maskDrawForShape('edge_n')).toBe('rectangle 0,0 15,7');
    expect(maskDrawForShape('channel_v')).toBe('rectangle 6,0 9,15');
    expect(() => maskDrawForShape('unknown')).toThrow('Unsupported prototype transition shape');
});

test('prototype manifest and tileset record source provenance', () => {
    const manifest = buildPrototypeManifest(shorelinePrototypeEntries(grammar));
    const tileset = buildPrototypeTileset(manifest);

    expect(manifest.entries).toHaveLength(5);
    expect(tileset).toMatchObject({
        columns: 5,
        image: 'terrain-transitions.prototype.png',
        imageheight: 16,
        imagewidth: 80,
        tilecount: 5,
    });
    expect(JSON.stringify(tileset)).toContain('source_overlay_tile_id');
});
