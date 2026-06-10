import Types from '../../shared/gametypes-browser';
import type { VisualDivergenceClass, VisualMoveMode } from '../visual-character-state';
import { worldCenterToPixelTopLeft } from '../visual-character-state';
import { isSnapVisualDivergenceClass, resolveVisualMoveModeForDivergenceClass } from './visual-movement-divergence';

type VisualBridgeCharacterLike = {
    orientation: number;
    setVisualFacing(orientation: number): void;
    walk(orientation?: number): void;
    idle(orientation?: number): void;
    setVisualDivergenceClass(divergenceClass: VisualDivergenceClass): void;
    setVisualRenderTarget(x: number, y: number, mode?: VisualMoveMode): void;
    setVisualRenderPosition(
        x: number,
        y: number,
        options?: { velocityX?: number; velocityY?: number; mode?: VisualMoveMode }
    ): void;
};

type VisualBridgeEntityLike = {
    x: number;
    y: number;
    setDirty(): void;
};

/**
 * Ticket 768:
 * This module is the first dedicated gameplay -> visual bridge surface.
 * New ordinary movement render writes should land here instead of being scattered across systems.
 *
 * Remaining post-cycle residue:
 * - ordinary movement-facing/locomotion ownership now enters through the bridge, but combat/interaction explicit
 *   turns still bypass ordinary movement ownership intentionally.
 * - teleports/discontinuities still enter through explicit discontinuity classes or `teleportEntity`.
 */

function isHorizontalOrientation(orientation: number): boolean {
    return orientation === Types.Orientations.LEFT || orientation === Types.Orientations.RIGHT;
}

function isVerticalOrientation(orientation: number): boolean {
    return orientation === Types.Orientations.UP || orientation === Types.Orientations.DOWN;
}

function resolveStickyMovementFacing(
    currentFacing: number,
    dx: number,
    dy: number,
    nextDx: number,
    nextDy: number
): number {
    const combinedDx = Math.max(-1, Math.min(1, dx + nextDx));
    const combinedDy = Math.max(-1, Math.min(1, dy + nextDy));
    const hasDiagonalTrend = combinedDx !== 0 && combinedDy !== 0;

    if (!hasDiagonalTrend) {
        if (dx === -1 && dy === 0) {
            return Types.Orientations.LEFT;
        }
        if (dx === 1 && dy === 0) {
            return Types.Orientations.RIGHT;
        }
        if (dx === 0 && dy === -1) {
            return Types.Orientations.UP;
        }
        if (dx === 0 && dy === 1) {
            return Types.Orientations.DOWN;
        }
        if (combinedDx < 0) {
            return Types.Orientations.LEFT;
        }
        if (combinedDx > 0) {
            return Types.Orientations.RIGHT;
        }
        if (combinedDy < 0) {
            return Types.Orientations.UP;
        }
        return Types.Orientations.DOWN;
    }

    if (isHorizontalOrientation(currentFacing)) {
        return combinedDx < 0 ? Types.Orientations.LEFT : Types.Orientations.RIGHT;
    }
    if (isVerticalOrientation(currentFacing)) {
        return combinedDy < 0 ? Types.Orientations.UP : Types.Orientations.DOWN;
    }

    return combinedDx < 0 ? Types.Orientations.LEFT : Types.Orientations.RIGHT;
}

/**
 * Single entry point for non-character (item/chest/projectile-like) render position writes.
 * Deliberately thin: the value is that ALL render-position writes flow through this module.
 */
export function bridgeEntityRenderPosition(entity: VisualBridgeEntityLike, { x, y }: { x: number; y: number }): void {
    entity.x = x;
    entity.y = y;
    entity.setDirty();
}

export function bridgeCharacterRenderTarget(
    character: VisualBridgeCharacterLike,
    {
        x,
        y,
        mode,
    }: {
        x: number;
        y: number;
        mode: VisualMoveMode;
    }
): void {
    character.setVisualRenderTarget(x, y, mode);
}

export function bridgeCharacterRenderPosition(
    character: VisualBridgeCharacterLike,
    {
        x,
        y,
        velocityX,
        velocityY,
        mode,
    }: {
        x: number;
        y: number;
        velocityX: number;
        velocityY: number;
        mode: VisualMoveMode;
    }
): void {
    character.setVisualRenderPosition(x, y, { velocityX, velocityY, mode });
}

export function bridgeCharacterRenderTargetWorld(
    character: VisualBridgeCharacterLike,
    {
        worldX,
        worldY,
        mode,
    }: {
        worldX: number;
        worldY: number;
        mode: VisualMoveMode;
    }
): void {
    const pixel = worldCenterToPixelTopLeft(worldX, worldY);
    bridgeCharacterRenderTarget(character, { x: pixel.x, y: pixel.y, mode });
}

export function bridgeCharacterRenderSnapWorld(
    character: VisualBridgeCharacterLike,
    {
        worldX,
        worldY,
        mode,
    }: {
        worldX: number;
        worldY: number;
        mode: VisualMoveMode;
    }
): void {
    const pixel = worldCenterToPixelTopLeft(worldX, worldY);
    bridgeCharacterRenderPosition(character, {
        x: pixel.x,
        y: pixel.y,
        velocityX: 0,
        velocityY: 0,
        mode,
    });
    bridgeCharacterRenderTarget(character, { x: pixel.x, y: pixel.y, mode });
}

export function bridgeCharacterWorldUpdate(
    character: VisualBridgeCharacterLike,
    {
        worldX,
        worldY,
        divergenceClass,
    }: {
        worldX: number;
        worldY: number;
        divergenceClass: VisualDivergenceClass;
    }
): void {
    const mode = resolveVisualMoveModeForDivergenceClass(divergenceClass);
    character.setVisualDivergenceClass(divergenceClass);
    if (isSnapVisualDivergenceClass(divergenceClass)) {
        bridgeCharacterRenderSnapWorld(character, { worldX, worldY, mode });
        return;
    }
    bridgeCharacterRenderTargetWorld(character, { worldX, worldY, mode });
}

export function bridgeCharacterPathLocomotion(
    character: VisualBridgeCharacterLike,
    {
        dx,
        dy,
        nextDx,
        nextDy,
    }: {
        dx: number;
        dy: number;
        nextDx: number;
        nextDy: number;
    }
): void {
    character.setVisualFacing(resolveStickyMovementFacing(character.orientation, dx, dy, nextDx, nextDy));
    character.walk();
}

export function bridgeCharacterInterpolatedLocomotion(
    character: VisualBridgeCharacterLike,
    {
        movedX,
        movedY,
        movingThresholdPx = 0.05,
    }: {
        movedX: number;
        movedY: number;
        movingThresholdPx?: number;
    }
): void {
    const moved = Math.abs(movedX) + Math.abs(movedY);
    if (moved <= movingThresholdPx) {
        character.idle();
        return;
    }

    const dx = movedX === 0 ? 0 : movedX < 0 ? -1 : 1;
    const dy = movedY === 0 ? 0 : movedY < 0 ? -1 : 1;
    character.setVisualFacing(resolveStickyMovementFacing(character.orientation, dx, dy, 0, 0));
    character.walk();
}
