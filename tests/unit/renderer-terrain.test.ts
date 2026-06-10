import { expect, test } from 'bun:test';
import { resolveViewportSize } from '../../client/renderer';
import { runClientRenderSystem } from '../../client/ecs/systems/client-render-system';
import type { DebugOverlayMode, GameRenderer, RenderFrameContext } from '../../client/rendering/renderer-contract';

test('resolveViewportSize prefers visualViewport dimensions when available', () => {
    const viewport = resolveViewportSize({
        innerWidth: 1280,
        innerHeight: 720,
        visualViewport: {
            width: 390.7,
            height: 844.2,
        },
    });

    expect(viewport.width).toBe(390);
    expect(viewport.height).toBe(844);
});

test('resolveViewportSize falls back to inner dimensions and clamps minimum size', () => {
    const viewport = resolveViewportSize({
        innerWidth: 0,
        innerHeight: -4,
    });

    expect(viewport.width).toBe(1);
    expect(viewport.height).toBe(1);
});

test('client render system renders through the game renderer boundary', () => {
    const calls: RenderFrameContext[] = [];
    const overlayModes: DebugOverlayMode[] = [];
    const renderer: GameRenderer = {
        renderFrame(ctx) {
            calls.push(ctx);
        },
        setDebugOverlayMode(mode) {
            overlayModes.push(mode);
        },
    };

    runClientRenderSystem({
        started: true,
        currentTime: 1234,
        gameRenderer: renderer,
    });

    expect(calls).toEqual([{ nowMs: 1234 }]);
    expect(overlayModes).toEqual([]);
});
