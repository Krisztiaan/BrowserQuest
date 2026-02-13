import { expect, test } from 'bun:test';
import { shouldDrawTerrainTile } from '../../client/renderer';

test('shouldDrawTerrainTile excludes only high tiles', () => {
    const map = {
        isHighTile(id: number) {
            return id === 99;
        },
    };

    expect(shouldDrawTerrainTile(map, 12)).toBe(true);
    expect(shouldDrawTerrainTile(map, 99)).toBe(false);
});
