import Types from '../shared/gametypes-browser';
import { HALF_TILE_SUBPX, SUBPIXELS, TILE_PX, type WorldPos } from '../shared/world/worldpos';

export type VisualMoveMode = 'idle' | 'path_step' | 'interpolate' | 'snap';
export type VisualLocomotionState = 'idle' | 'walk';
export type VisualDivergenceClass =
    | 'ordinary'
    | 'prediction_hard_reconcile'
    | 'suppressed_resync'
    | 'remote_discontinuity'
    | 'teleport';

export type VisualCharacterState = {
    renderX: number;
    renderY: number;
    targetRenderX: number;
    targetRenderY: number;
    renderWorldX: number;
    renderWorldY: number;
    targetRenderWorldX: number;
    targetRenderWorldY: number;
    renderVelocityX: number;
    renderVelocityY: number;
    renderFacing: number;
    visualMoveMode: VisualMoveMode;
    visualLocomotionState: VisualLocomotionState;
    visualDivergenceClass: VisualDivergenceClass;
};

export function pixelTopLeftToWorldCenter(x: number, y: number): WorldPos {
    return {
        x: (x + TILE_PX / 2) * SUBPIXELS,
        y: (y + TILE_PX / 2) * SUBPIXELS,
    };
}

export function worldCenterToPixelTopLeft(worldX: number, worldY: number): { x: number; y: number } {
    return {
        x: Math.floor(worldX / SUBPIXELS) - TILE_PX / 2,
        y: Math.floor(worldY / SUBPIXELS) - TILE_PX / 2,
    };
}

export function createVisualCharacterState(): VisualCharacterState {
    return {
        renderX: 0,
        renderY: 0,
        targetRenderX: 0,
        targetRenderY: 0,
        renderWorldX: HALF_TILE_SUBPX,
        renderWorldY: HALF_TILE_SUBPX,
        targetRenderWorldX: HALF_TILE_SUBPX,
        targetRenderWorldY: HALF_TILE_SUBPX,
        renderVelocityX: 0,
        renderVelocityY: 0,
        renderFacing: Types.Orientations.DOWN,
        visualMoveMode: 'idle',
        visualLocomotionState: 'idle',
        visualDivergenceClass: 'ordinary',
    };
}
