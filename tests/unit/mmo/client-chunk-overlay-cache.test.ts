import { expect, test } from 'bun:test';
import { ClientChunkOverlayCache } from '../../../client/world/chunks/client-chunk-overlay-cache';

test('client chunk overlay cache applies snapshots and versioned deltas', () => {
    const cache = new ClientChunkOverlayCache();

    cache.applySnapshot({
        chunkX: 0,
        chunkY: 0,
        version: 1,
        chunkSize: 32,
        overrides: [
            [1, 1, 123],
            [2, 3, 456],
        ],
    });

    expect(cache.getGlobal(1, 1)).toBe(123);
    expect(cache.getGlobal(2, 3)).toBe(456);
    expect(cache.getGlobal(0, 0)).toBe(null);

    expect(
        cache.applyDelta({
            chunkX: 0,
            chunkY: 0,
            fromVersion: 1,
            toVersion: 2,
            changes: [
                [1, 1, null],
                [0, 0, 999],
            ],
        })
    ).toBe(true);

    expect(cache.getGlobal(1, 1)).toBe(null);
    expect(cache.getGlobal(0, 0)).toBe(999);

    expect(
        cache.applyDelta({
            chunkX: 0,
            chunkY: 0,
            fromVersion: 1,
            toVersion: 3,
            changes: [[0, 1, 1]],
        })
    ).toBe(false);
});

