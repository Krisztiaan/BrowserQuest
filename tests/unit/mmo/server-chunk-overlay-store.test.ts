import { expect, test } from 'bun:test';
import { ChunkOverlayStore, makeChunkKey } from '../../../server/world/chunks/chunk-overlay-store';

test('chunk overlay store uses stable chunk keys', () => {
    expect(makeChunkKey(0, 0)).toBe(makeChunkKey(0, 0));
    expect(makeChunkKey(1, 0)).not.toBe(makeChunkKey(0, 1));
    expect(makeChunkKey(-1, 0)).not.toBe(makeChunkKey(0, -1));
});

test('set/get/clear are deterministic and mark dirty with version bumps', () => {
    const store = new ChunkOverlayStore({ chunkSize: 4 });

    expect(store.getGlobal(0, 0)).toBeNull();
    expect(store.listDirtyChunks()).toEqual([]);

    expect(store.setGlobal(0, 0, 42)).toBe(true);
    expect(store.getGlobal(0, 0)).toBe(42);

    const chunk = store.getChunk(0, 0);
    expect(chunk).not.toBeNull();
    expect(chunk?.version).toBe(1);
    expect(chunk?.dirty).toBe(true);
    expect(store.listDirtyChunks().map((c) => [c.chunkX, c.chunkY])).toEqual([[0, 0]]);

    // Setting the same value is a no-op: no version bump.
    expect(store.setGlobal(0, 0, 42)).toBe(false);
    expect(chunk?.version).toBe(1);

    // Setting a different value bumps version.
    expect(store.setGlobal(0, 0, 7)).toBe(true);
    expect(store.getGlobal(0, 0)).toBe(7);
    expect(chunk?.version).toBe(2);

    // Clearing an existing override bumps version and returns null.
    expect(store.clearGlobal(0, 0)).toBe(true);
    expect(store.getGlobal(0, 0)).toBeNull();
    expect(chunk?.version).toBe(3);

    // Clearing again is a no-op.
    expect(store.clearGlobal(0, 0)).toBe(false);
    expect(chunk?.version).toBe(3);
});

test('negative coordinates map into chunks using Euclidean division', () => {
    const store = new ChunkOverlayStore({ chunkSize: 4 });

    expect(store.setGlobal(-1, -1, 9)).toBe(true);
    expect(store.getGlobal(-1, -1)).toBe(9);

    const chunk = store.getChunk(-1, -1);
    expect(chunk).not.toBeNull();
    expect(chunk?.getLocal(3, 3)).toBe(9);
});

test('markChunkClean clears dirty tracking without dropping the chunk', () => {
    const store = new ChunkOverlayStore({ chunkSize: 4 });
    store.setGlobal(0, 0, 1);
    expect(store.listDirtyChunks().length).toBe(1);

    store.markChunkClean(0, 0);
    expect(store.listDirtyChunks().length).toBe(0);
    expect(store.getChunk(0, 0)).not.toBeNull();
    expect(store.getChunk(0, 0)?.dirty).toBe(false);
});

