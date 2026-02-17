import { expect, test } from 'bun:test';
import { disableCanvasImageSmoothing } from '../../client/canvas-smoothing';

test('disableCanvasImageSmoothing disables standard and vendor flags', () => {
    const context = {
        imageSmoothingEnabled: true,
        mozImageSmoothingEnabled: true,
        webkitImageSmoothingEnabled: true,
        msImageSmoothingEnabled: true,
    } as CanvasRenderingContext2D & {
        mozImageSmoothingEnabled: boolean;
        webkitImageSmoothingEnabled: boolean;
        msImageSmoothingEnabled: boolean;
    };

    disableCanvasImageSmoothing(context);

    expect(context.imageSmoothingEnabled).toBe(false);
    expect(context.mozImageSmoothingEnabled).toBe(false);
    expect(context.webkitImageSmoothingEnabled).toBe(false);
    expect(context.msImageSmoothingEnabled).toBe(false);
});
