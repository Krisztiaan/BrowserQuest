import { expect, test } from 'bun:test';
import { resolveStartupWaitOutcome } from '../../client/game-startup-wait';

test('startup wait outcome is ready when map and sprites are loaded', () => {
    expect(
        resolveStartupWaitOutcome({
            mapLoaded: true,
            spritesLoaded: true,
            mapLoadError: null,
            elapsedMs: 0,
        })
    ).toBe('ready');
});

test('startup wait outcome is map_error when map loader reports failure', () => {
    expect(
        resolveStartupWaitOutcome({
            mapLoaded: false,
            spritesLoaded: true,
            mapLoadError: 'fetch failed',
            elapsedMs: 1500,
        })
    ).toBe('map_error');
});

test('startup wait outcome is timeout after max wait elapses', () => {
    expect(
        resolveStartupWaitOutcome({
            mapLoaded: false,
            spritesLoaded: false,
            mapLoadError: null,
            elapsedMs: 20_000,
            maxWaitMs: 20_000,
        })
    ).toBe('timeout');
});

test('startup wait outcome stays pending before ready/error/timeout', () => {
    expect(
        resolveStartupWaitOutcome({
            mapLoaded: false,
            spritesLoaded: false,
            mapLoadError: null,
            elapsedMs: 1_500,
            maxWaitMs: 20_000,
        })
    ).toBe('pending');
});
