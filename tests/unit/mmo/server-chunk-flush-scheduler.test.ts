import { expect, test } from 'bun:test';
import { ChunkOverlayStore } from '../../../server/world/chunks/chunk-overlay-store';
import { SqliteChunkOverlayPersistence } from '../../../server/world/chunks/chunk-overlay-persistence';
import { ChunkFlushScheduler } from '../../../server/world/chunks/chunk-flush-scheduler';

test('chunk flush scheduler flushes at cadence and bounds work per tick', () => {
    const store = new ChunkOverlayStore({ chunkSize: 4 });
    const persistence = new SqliteChunkOverlayPersistence(':memory:');
    const scheduler = new ChunkFlushScheduler({
        store,
        persistence,
        config: { flushIntervalMs: 10_000, maxChunksPerFlush: 1 },
    });

    store.setGlobal(0, 0, 1);
    store.setGlobal(4, 0, 2); // different chunk
    expect(store.listDirtyChunks().length).toBe(2);

    expect(scheduler.tick(0)).toEqual({ flushed: 1 });
    expect(store.listDirtyChunks().length).toBe(1);

    // Still within interval: no flush.
    expect(scheduler.tick(5000)).toEqual({ flushed: 0 });
    expect(store.listDirtyChunks().length).toBe(1);

    // Next interval flushes the remaining chunk.
    expect(scheduler.tick(10_000)).toEqual({ flushed: 1 });
    expect(store.listDirtyChunks().length).toBe(0);

    persistence.close();
});

test('flushAllNow flushes all dirty chunks regardless of cadence', () => {
    const store = new ChunkOverlayStore({ chunkSize: 4 });
    const persistence = new SqliteChunkOverlayPersistence(':memory:');
    const scheduler = new ChunkFlushScheduler({
        store,
        persistence,
        config: { flushIntervalMs: 10_000, maxChunksPerFlush: 1 },
    });

    store.setGlobal(0, 0, 1);
    store.setGlobal(4, 0, 2);
    expect(store.listDirtyChunks().length).toBe(2);

    expect(scheduler.flushAllNow(1234)).toEqual({ flushed: 2 });
    expect(store.listDirtyChunks().length).toBe(0);

    persistence.close();
});

