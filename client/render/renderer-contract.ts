import type Camera from '../camera';
import type { PixelArtCanvasContext } from '../canvas-smoothing';

export type RendererRect = {
    x: number;
    y: number;
    w: number;
    h: number;
    left: number;
    right: number;
    top: number;
    bottom: number;
};

/**
 * The seam between game/systems code and the canvas renderer (PLAN Phase 5.3).
 *
 * Derived from the actual call surface used by game.ts, app/main bootstrap and
 * the ECS systems. New renderer consumers should depend on this contract, not
 * the concrete Renderer class - it is the precondition for ever evaluating a
 * different rendering backend without touching gameplay code.
 */
export interface RendererContract {
    // state flags and metrics
    readonly mobile: boolean;
    readonly tablet: boolean;
    scale: number;
    tilesize: number;
    upscaledRendering: boolean;
    camera: Camera;
    context: PixelArtCanvasContext;
    targetRect: RendererRect | null;

    getWidth(): number;
    getHeight(): number;
    getScaleFactor(): number;

    // lifecycle / configuration
    rescale(factor?: number): void;
    setTileset(tileset: unknown): void;
    renderStaticCanvases(): void;

    // frame loop
    renderFrame(): void;
    clearScreen(context: PixelArtCanvasContext): void;
    isDebugInfoVisible: boolean;

    // geometry helpers used by dirty-rect tracking
    getEntityBoundingRect(entity: unknown): RendererRect;
    getTileBoundingRect(tile: unknown): RendererRect;
}
