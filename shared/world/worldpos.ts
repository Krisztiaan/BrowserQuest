import { gridPos, type GridPos } from '../domain/positions';

// Canonical units:
// - tiles: integer grid coordinates
// - pixels: TILE_PX per tile (render space)
// - subpixels: fixed-point pixels with SUBPIXELS fractional resolution (physics/net space)
export const TILE_PX = 16 as const;
export const SUBPIXELS = 256 as const;
export const TILE_SUBPX = TILE_PX * SUBPIXELS;
export const HALF_TILE_SUBPX = TILE_SUBPX / 2;

// Sub-tile world position in subpixels (fixed-point). Origin is map top-left.
export type WorldPos = Readonly<{
    // Subpixel coordinates (fixed-point pixels).
    x: number;
    y: number;
}>;

export type WorldDelta = Readonly<{ dx: number; dy: number }>;

export function worldPos(x: number, y: number): WorldPos {
    return { x, y };
}

export function worldDelta(dx: number, dy: number): WorldDelta {
    return { dx, dy };
}

export function worldPosFromPixels(px: number, py: number): WorldPos {
    return worldPos(px * SUBPIXELS, py * SUBPIXELS);
}

export function worldPosToPixels(pos: WorldPos): { x: number; y: number } {
    // Truncate toward -inf so negatives are consistent with tile conversion.
    return { x: Math.floor(pos.x / SUBPIXELS), y: Math.floor(pos.y / SUBPIXELS) };
}

export function tileToWorldPosTopLeft(tileX: number, tileY: number): WorldPos {
    return worldPos(tileX * TILE_SUBPX, tileY * TILE_SUBPX);
}

export function tileToWorldPosCenter(tileX: number, tileY: number): WorldPos {
    return worldPos(tileX * TILE_SUBPX + HALF_TILE_SUBPX, tileY * TILE_SUBPX + HALF_TILE_SUBPX);
}

export function worldPosToTile(pos: WorldPos): GridPos {
    return gridPos(Math.floor(pos.x / TILE_SUBPX), Math.floor(pos.y / TILE_SUBPX));
}

export function worldPosAdd(pos: WorldPos, delta: WorldDelta): WorldPos {
    return worldPos(pos.x + delta.dx, pos.y + delta.dy);
}

export function worldPosSub(a: WorldPos, b: WorldPos): WorldDelta {
    return worldDelta(a.x - b.x, a.y - b.y);
}

export function worldPosClamp(pos: WorldPos, min: WorldPos, max: WorldPos): WorldPos {
    return worldPos(Math.min(max.x, Math.max(min.x, pos.x)), Math.min(max.y, Math.max(min.y, pos.y)));
}

export function worldPosDistanceSq(a: WorldPos, b: WorldPos): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
}

export function worldPosEquals(a: WorldPos, b: WorldPos): boolean {
    return a.x === b.x && a.y === b.y;
}

export function worldPosIsFinite(pos: WorldPos): boolean {
    return Number.isFinite(pos.x) && Number.isFinite(pos.y);
}
