export type DebugOverlayMode = 'none' | 'passability';

export type RenderFrameContext = Readonly<{
    nowMs: number;
}>;

export interface GameRenderer {
    renderFrame(ctx: RenderFrameContext): void;
    setDebugOverlayMode(mode: DebugOverlayMode): void;
}
