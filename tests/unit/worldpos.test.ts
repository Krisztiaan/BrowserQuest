import { expect, test } from 'bun:test';
import {
    HALF_TILE_SUBPX,
    SUBPIXELS,
    TILE_PX,
    TILE_SUBPX,
    tileToWorldPosCenter,
    tileToWorldPosTopLeft,
    worldPos,
    worldPosAdd,
    worldDelta,
    worldPosClamp,
    worldPosDistanceSq,
    worldPosEquals,
    worldPosFromPixels,
    worldPosToPixels,
    worldPosToTile,
} from '../../shared/world/worldpos';

test('WorldPos constants are internally consistent', () => {
    expect(TILE_PX).toBe(16);
    expect(SUBPIXELS).toBe(256);
    expect(TILE_SUBPX).toBe(TILE_PX * SUBPIXELS);
    expect(HALF_TILE_SUBPX).toBe(TILE_SUBPX / 2);
});

test('tileToWorldPosTopLeft and worldPosToTile round trip for top-left and center', () => {
    const topLeft = tileToWorldPosTopLeft(3, 4);
    expect(topLeft).toEqual(worldPos(3 * TILE_SUBPX, 4 * TILE_SUBPX));
    expect(worldPosToTile(topLeft)).toEqual({ x: 3, y: 4 });

    const center = tileToWorldPosCenter(3, 4);
    expect(center).toEqual(worldPos(3 * TILE_SUBPX + HALF_TILE_SUBPX, 4 * TILE_SUBPX + HALF_TILE_SUBPX));
    expect(worldPosToTile(center)).toEqual({ x: 3, y: 4 });
});

test('worldPosToTile floors at tile boundaries', () => {
    const tile0 = worldPosToTile(worldPos(0, 0));
    expect(tile0).toEqual({ x: 0, y: 0 });

    const lastIn0 = worldPosToTile(worldPos(TILE_SUBPX - 1, TILE_SUBPX - 1));
    expect(lastIn0).toEqual({ x: 0, y: 0 });

    const firstIn1 = worldPosToTile(worldPos(TILE_SUBPX, TILE_SUBPX));
    expect(firstIn1).toEqual({ x: 1, y: 1 });
});

test('worldPosFromPixels and worldPosToPixels are consistent (flooring)', () => {
    const p = worldPosFromPixels(10, 20);
    expect(p).toEqual(worldPos(10 * SUBPIXELS, 20 * SUBPIXELS));
    expect(worldPosToPixels(p)).toEqual({ x: 10, y: 20 });

    // Subpixel fractional: floor toward -inf.
    const frac = worldPos(10 * SUBPIXELS + 1, 20 * SUBPIXELS + (SUBPIXELS - 1));
    expect(worldPosToPixels(frac)).toEqual({ x: 10, y: 20 });
});

test('WorldPos math helpers are deterministic', () => {
    const a = worldPos(100, 200);
    const b = worldPosAdd(a, worldDelta(-3, 7));
    expect(b).toEqual(worldPos(97, 207));

    expect(worldPosClamp(worldPos(5, 15), worldPos(10, 10), worldPos(20, 20))).toEqual(worldPos(10, 15));
    expect(worldPosDistanceSq(worldPos(0, 0), worldPos(3, 4))).toBe(25);
    expect(worldPosEquals(worldPos(1, 2), worldPos(1, 2))).toBe(true);
    expect(worldPosEquals(worldPos(1, 2), worldPos(2, 1))).toBe(false);
});

