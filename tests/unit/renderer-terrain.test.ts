import { expect, test } from 'bun:test';
import { resolveViewportSize } from '../../client/renderer';

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
