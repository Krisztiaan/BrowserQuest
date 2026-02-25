import { expect, test } from 'bun:test';
import { resolveCameraAxis } from '../../../client/ecs/systems/client-simulation-system';

test('resolveCameraAxis clamps desired camera position when map overflows viewport', () => {
    const axis = resolveCameraAxis({
        mapPixels: 3200,
        viewportPixels: 1000,
        desired: 2800,
    });

    expect(axis.min).toBe(0);
    expect(axis.max).toBe(2200);
    expect(axis.clamped).toBe(2200);
});

test('resolveCameraAxis centers camera when map fits inside viewport', () => {
    const axis = resolveCameraAxis({
        mapPixels: 640,
        viewportPixels: 1000,
        desired: 120,
    });

    expect(axis.min).toBe(-180);
    expect(axis.max).toBe(-180);
    expect(axis.clamped).toBe(-180);
});
