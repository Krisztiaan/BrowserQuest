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

test('resolveCameraAxis clamps within an explicit range (region bounds)', () => {
    const axis = resolveCameraAxis({
        mapPixels: 3200,
        viewportPixels: 1000,
        desired: 100,
        rangeMinPixels: 480,
        rangeMaxPixels: 2400,
    });

    expect(axis.min).toBe(480);
    expect(axis.max).toBe(1400);
    expect(axis.clamped).toBe(480);
});

test('resolveCameraAxis centers over a range smaller than the viewport (enclosed room)', () => {
    const axis = resolveCameraAxis({
        mapPixels: 3200,
        viewportPixels: 1000,
        desired: 700,
        rangeMinPixels: 640,
        rangeMaxPixels: 1040,
    });

    // room extent 400 < viewport 1000 -> centered over the room
    expect(axis.clamped).toBe(640 - (1000 - 400) / 2);
    expect(axis.min).toBe(axis.clamped);
    expect(axis.max).toBe(axis.clamped);
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
