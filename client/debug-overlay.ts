export type OverlayTileClass = 'blocked' | 'door' | 'checkpoint' | 'plateau' | 'walkable';

export type OverlayMapLike = Readonly<{
    isColliding(x: number, y: number): boolean;
    isDoor(x: number, y: number): boolean;
    isPlateau(x: number, y: number): boolean;
    isCheckpoint?(x: number, y: number): boolean;
}>;

export const OVERLAY_COLORS: Readonly<Record<OverlayTileClass, string>> = Object.freeze({
    blocked: 'rgba(220, 60, 60, 0.35)',
    door: 'rgba(170, 80, 230, 0.45)',
    checkpoint: 'rgba(240, 220, 80, 0.35)',
    plateau: 'rgba(80, 200, 220, 0.30)',
    walkable: 'rgba(80, 220, 100, 0.18)',
});

/**
 * Authoring/debug classification of a tile for the passability overlay.
 * Door/checkpoint markers win over blocked so trigger tiles stay visible.
 */
export function classifyTileForOverlay(map: OverlayMapLike, x: number, y: number): OverlayTileClass {
    if (map.isDoor(x, y)) {
        return 'door';
    }
    if (map.isCheckpoint?.(x, y)) {
        return 'checkpoint';
    }
    if (map.isColliding(x, y)) {
        return 'blocked';
    }
    if (map.isPlateau(x, y)) {
        return 'plateau';
    }
    return 'walkable';
}

type OverlayGlobals = typeof globalThis & { __BQ_DEBUG_OVERLAY__?: boolean };

function readInitialState(): boolean {
    const globals = globalThis as OverlayGlobals;
    if (globals.__BQ_DEBUG_OVERLAY__ === true) {
        return true;
    }
    try {
        const href = (globalThis as { location?: { href?: string } }).location?.href;
        if (typeof href !== 'string') {
            return false;
        }
        return new URL(href).searchParams.get('debug') === 'overlay';
    } catch (_) {
        return false;
    }
}

let overlayEnabled = readInitialState();

export function isDebugOverlayEnabled(): boolean {
    return overlayEnabled;
}

export function toggleDebugOverlay(): boolean {
    overlayEnabled = !overlayEnabled;
    return overlayEnabled;
}
