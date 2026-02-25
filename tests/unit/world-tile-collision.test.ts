import { expect, test } from 'bun:test';
import { SUBPIXELS, TILE_SUBPX, tileToWorldPosCenter, worldDelta } from '../../shared/world/worldpos';
import {
    clampWorldPosInsideMap,
    resolveSubTileMotionAgainstTiles,
    worldPosOverlapsBlockedTiles,
} from '../../shared/world/collision/tile-collision';

function makeBlocked(tiles: Array<{ x: number; y: number }>): (x: number, y: number) => boolean {
    const key = (x: number, y: number) => `${x},${y}`;
    const set = new Set<string>(tiles.map((t) => key(t.x, t.y)));
    return (x, y) => set.has(key(x, y));
}

test('tile collision clamps x and slides along a wall (axis-resolved)', () => {
    const isBlocked = makeBlocked([{ x: 1, y: 0 }]);
    const halfExtents = { hx: 6 * SUBPIXELS, hy: 6 * SUBPIXELS };
    const start = tileToWorldPosCenter(0, 0);

    const res = resolveSubTileMotionAgainstTiles({
        pos: start,
        delta: worldDelta(1000, 1000),
        halfExtents,
        isBlockedTile: isBlocked,
    });

    // Hit the wall at tile x=1 and slide down.
    expect(res.blockedX).toBe(true);
    expect(res.blockedY).toBe(false);
    expect(res.pos.x).toBe(1 * TILE_SUBPX - halfExtents.hx);
    expect(res.pos.y).toBe(start.y + 1000);
});

test('tile collision clamps both axes when moving into a blocked corner', () => {
    const isBlocked = makeBlocked([
        { x: 1, y: 0 },
        { x: 0, y: 1 },
    ]);
    const halfExtents = { hx: 6 * SUBPIXELS, hy: 6 * SUBPIXELS };
    const start = tileToWorldPosCenter(0, 0);

    const res = resolveSubTileMotionAgainstTiles({
        pos: start,
        delta: worldDelta(1000, 1000),
        halfExtents,
        isBlockedTile: isBlocked,
    });

    expect(res.blockedX).toBe(true);
    expect(res.blockedY).toBe(true);
    expect(res.pos.x).toBe(1 * TILE_SUBPX - halfExtents.hx);
    expect(res.pos.y).toBe(1 * TILE_SUBPX - halfExtents.hy);
});

test('tile collision does not tunnel through thin walls for large deltas (sub-stepped)', () => {
    const isBlocked = makeBlocked([{ x: 1, y: 0 }]);
    const halfExtents = { hx: 6 * SUBPIXELS, hy: 6 * SUBPIXELS };
    const start = tileToWorldPosCenter(0, 0);

    const res = resolveSubTileMotionAgainstTiles({
        pos: start,
        delta: worldDelta(2 * TILE_SUBPX, 0),
        halfExtents,
        isBlockedTile: isBlocked,
    });

    expect(res.blockedX).toBe(true);
    expect(res.pos.x).toBe(1 * TILE_SUBPX - halfExtents.hx);
    expect(res.pos.y).toBe(start.y);
});

test('clampWorldPosInsideMap keeps world position inside map extents', () => {
    const halfExtents = { hx: 6 * SUBPIXELS, hy: 6 * SUBPIXELS };
    const clamped = clampWorldPosInsideMap({
        pos: { x: -999, y: 999999 },
        halfExtents,
        mapWidthTiles: 4,
        mapHeightTiles: 3,
    });

    expect(clamped.x).toBe(halfExtents.hx);
    expect(clamped.y).toBe(3 * TILE_SUBPX - halfExtents.hy);
});

test('clampWorldPosInsideMap is a no-op when map dimensions are invalid', () => {
    const halfExtents = { hx: 6 * SUBPIXELS, hy: 6 * SUBPIXELS };
    const unchanged = clampWorldPosInsideMap({
        pos: { x: -123, y: 456 },
        halfExtents,
        mapWidthTiles: 0,
        mapHeightTiles: 0,
    });

    expect(unchanged).toEqual({ x: -123, y: 456 });
});

test('worldPosOverlapsBlockedTiles detects overlaps for a sub-tile AABB', () => {
    const isBlocked = makeBlocked([{ x: 1, y: 1 }]);
    const halfExtents = { hx: 6 * SUBPIXELS, hy: 6 * SUBPIXELS };

    expect(worldPosOverlapsBlockedTiles({
        pos: tileToWorldPosCenter(1, 1),
        halfExtents,
        isBlockedTile: isBlocked,
    })).toBe(true);

    expect(worldPosOverlapsBlockedTiles({
        pos: tileToWorldPosCenter(0, 0),
        halfExtents,
        isBlockedTile: isBlocked,
    })).toBe(false);
});
