import { TILE_SUBPX, worldPos, type WorldDelta, type WorldPos } from '../worldpos';

export type AabbHalfExtents = Readonly<{ hx: number; hy: number }>;
export type TileBlockQuery = (tileX: number, tileY: number) => boolean;

export type TileCollisionResult = Readonly<{
    pos: WorldPos;
    blockedX: boolean;
    blockedY: boolean;
}>;

export function clampWorldPosInsideMap({
    pos,
    halfExtents,
    mapWidthTiles,
    mapHeightTiles,
}: {
    pos: WorldPos;
    halfExtents: AabbHalfExtents;
    mapWidthTiles: number;
    mapHeightTiles: number;
}): WorldPos {
    if (!Number.isFinite(mapWidthTiles) || !Number.isFinite(mapHeightTiles) || mapWidthTiles <= 0 || mapHeightTiles <= 0) {
        return pos;
    }

    const widthSubpx = Math.floor(mapWidthTiles) * TILE_SUBPX;
    const heightSubpx = Math.floor(mapHeightTiles) * TILE_SUBPX;
    const minX = halfExtents.hx;
    const minY = halfExtents.hy;
    const maxX = Math.max(minX, widthSubpx - halfExtents.hx);
    const maxY = Math.max(minY, heightSubpx - halfExtents.hy);

    return worldPos(
        Math.min(maxX, Math.max(minX, pos.x)),
        Math.min(maxY, Math.max(minY, pos.y))
    );
}

function floorDiv(n: number, d: number): number {
    // JS `/` is float; keep deterministic floor division for negative values.
    return Math.floor(n / d);
}

function tileRangeForAabb(minEdge: number, maxEdgeExclusive: number): { min: number; max: number } {
    // Convert an inclusive/exclusive edge range into an inclusive tile index range.
    // If maxEdgeExclusive lies exactly on a tile boundary, we should not include that tile.
    const min = floorDiv(minEdge, TILE_SUBPX);
    const max = floorDiv(maxEdgeExclusive - 1, TILE_SUBPX);
    return { min, max };
}

function aabbOverlapsAnyBlockedTile({
    cx,
    cy,
    halfExtents,
    isBlockedTile,
    ignoreTiles,
}: {
    cx: number;
    cy: number;
    halfExtents: AabbHalfExtents;
    isBlockedTile: TileBlockQuery;
    ignoreTiles?: ReadonlyArray<{ x: number; y: number }>;
}): boolean {
    const left = cx - halfExtents.hx;
    const rightExclusive = cx + halfExtents.hx;
    const top = cy - halfExtents.hy;
    const bottomExclusive = cy + halfExtents.hy;

    const xRange = tileRangeForAabb(left, rightExclusive);
    const yRange = tileRangeForAabb(top, bottomExclusive);

    for (let ty = yRange.min; ty <= yRange.max; ty += 1) {
        for (let tx = xRange.min; tx <= xRange.max; tx += 1) {
            if (isBlockedTile(tx, ty)) {
                if (ignoreTiles?.some((tile) => tile.x === tx && tile.y === ty)) {
                    continue;
                }
                return true;
            }
        }
    }
    return false;
}

export function worldPosOverlapsBlockedTiles({
    pos,
    halfExtents,
    isBlockedTile,
    ignoreTiles,
}: {
    pos: WorldPos;
    halfExtents: AabbHalfExtents;
    isBlockedTile: TileBlockQuery;
    ignoreTiles?: ReadonlyArray<{ x: number; y: number }>;
}): boolean {
    return aabbOverlapsAnyBlockedTile({
        cx: pos.x,
        cy: pos.y,
        halfExtents,
        isBlockedTile,
        ignoreTiles,
    });
}

function resolveAxis({
    pos,
    delta,
    axis,
    halfExtents,
    isBlockedTile,
}: {
    pos: WorldPos;
    delta: number;
    axis: 'x' | 'y';
    halfExtents: AabbHalfExtents;
    isBlockedTile: TileBlockQuery;
}): { next: WorldPos; blocked: boolean } {
    if (delta === 0) {
        return { next: pos, blocked: false };
    }

    const next = axis === 'x' ? worldPos(pos.x + delta, pos.y) : worldPos(pos.x, pos.y + delta);
    if (!aabbOverlapsAnyBlockedTile({ cx: next.x, cy: next.y, halfExtents, isBlockedTile })) {
        return { next, blocked: false };
    }

    // Collision: clamp to the nearest blocking tile boundary for this axis.
    const sign = delta > 0 ? 1 : -1;
    let clamped = axis === 'x' ? next.x : next.y;

    const cx = next.x;
    const cy = next.y;
    const left = cx - halfExtents.hx;
    const rightExclusive = cx + halfExtents.hx;
    const top = cy - halfExtents.hy;
    const bottomExclusive = cy + halfExtents.hy;

    const xRange = tileRangeForAabb(left, rightExclusive);
    const yRange = tileRangeForAabb(top, bottomExclusive);

    if (axis === 'x') {
        if (sign > 0) {
            // Moving right: clamp right edge to the left boundary of the earliest blocking tile.
            let best = Number.POSITIVE_INFINITY;
            for (let ty = yRange.min; ty <= yRange.max; ty += 1) {
                for (let tx = xRange.min; tx <= xRange.max; tx += 1) {
                    if (!isBlockedTile(tx, ty)) continue;
                    const boundary = tx * TILE_SUBPX - halfExtents.hx;
                    if (boundary < best) best = boundary;
                }
            }
            if (best !== Number.POSITIVE_INFINITY) {
                clamped = Math.min(clamped, best);
            }
        } else {
            // Moving left: clamp left edge to the right boundary of the latest blocking tile.
            let best = Number.NEGATIVE_INFINITY;
            for (let ty = yRange.min; ty <= yRange.max; ty += 1) {
                for (let tx = xRange.min; tx <= xRange.max; tx += 1) {
                    if (!isBlockedTile(tx, ty)) continue;
                    const boundary = (tx + 1) * TILE_SUBPX + halfExtents.hx;
                    if (boundary > best) best = boundary;
                }
            }
            if (best !== Number.NEGATIVE_INFINITY) {
                clamped = Math.max(clamped, best);
            }
        }
        const resolved = worldPos(clamped, pos.y);
        return { next: resolved, blocked: true };
    }

    if (sign > 0) {
        // Moving down: clamp bottom edge to the top boundary of the earliest blocking tile.
        let best = Number.POSITIVE_INFINITY;
        for (let ty = yRange.min; ty <= yRange.max; ty += 1) {
            for (let tx = xRange.min; tx <= xRange.max; tx += 1) {
                if (!isBlockedTile(tx, ty)) continue;
                const boundary = ty * TILE_SUBPX - halfExtents.hy;
                if (boundary < best) best = boundary;
            }
        }
        if (best !== Number.POSITIVE_INFINITY) {
            clamped = Math.min(clamped, best);
        }
    } else {
        // Moving up: clamp top edge to the bottom boundary of the latest blocking tile.
        let best = Number.NEGATIVE_INFINITY;
        for (let ty = yRange.min; ty <= yRange.max; ty += 1) {
            for (let tx = xRange.min; tx <= xRange.max; tx += 1) {
                if (!isBlockedTile(tx, ty)) continue;
                const boundary = (ty + 1) * TILE_SUBPX + halfExtents.hy;
                if (boundary > best) best = boundary;
            }
        }
        if (best !== Number.NEGATIVE_INFINITY) {
            clamped = Math.max(clamped, best);
        }
    }

    const resolved = worldPos(pos.x, clamped);
    return { next: resolved, blocked: true };
}

function splitDelta(total: number, steps: number): number[] {
    if (steps <= 1) return [total];
    const base = Math.trunc(total / steps);
    const remainder = total - base * steps;
    const sign = remainder > 0 ? 1 : remainder < 0 ? -1 : 0;
    const absRem = Math.abs(remainder);
    const out = new Array<number>(steps);
    for (let i = 0; i < steps; i += 1) {
        out[i] = base + (i < absRem ? sign : 0);
    }
    return out;
}

export function resolveSubTileMotionAgainstTiles({
    pos,
    delta,
    halfExtents,
    isBlockedTile,
    maxStepSubpx = TILE_SUBPX / 4,
}: {
    pos: WorldPos;
    delta: WorldDelta;
    halfExtents: AabbHalfExtents;
    isBlockedTile: TileBlockQuery;
    maxStepSubpx?: number;
}): TileCollisionResult {
    const maxAxis = Math.max(Math.abs(delta.dx), Math.abs(delta.dy));
    const steps = Math.max(1, Math.ceil(maxAxis / Math.max(1, maxStepSubpx)));
    const dxParts = splitDelta(delta.dx, steps);
    const dyParts = splitDelta(delta.dy, steps);

    let current = pos;
    let blockedX = false;
    let blockedY = false;

    for (let i = 0; i < steps; i += 1) {
        const dx = dxParts[i] ?? 0;
        const dy = dyParts[i] ?? 0;

        const xResolved = resolveAxis({ pos: current, delta: dx, axis: 'x', halfExtents, isBlockedTile });
        current = xResolved.next;
        blockedX ||= xResolved.blocked;

        const yResolved = resolveAxis({ pos: current, delta: dy, axis: 'y', halfExtents, isBlockedTile });
        current = yResolved.next;
        blockedY ||= yResolved.blocked;
    }

    return { pos: current, blockedX, blockedY };
}
