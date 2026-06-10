import { expect, test } from 'bun:test';
import { gidToTileId, tileIdToSourceRect } from '../../tools/content/terrain-visual-artifacts';

test('tile id maps to source rectangle in a 20-column 16px sheet', () => {
    expect(tileIdToSourceRect(21, { columns: 20, tileWidth: 16, tileHeight: 16, firstGid: 1 })).toEqual({
        x: 16,
        y: 16,
        width: 16,
        height: 16,
    });
});

test('gid maps to local tile id', () => {
    expect(gidToTileId(22, 1)).toBe(21);
});
