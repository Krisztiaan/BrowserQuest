import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ChunkOverlayStore } from '../../../server/world/chunks/chunk-overlay-store';
import { SqliteChunkOverlayPersistence } from '../../../server/world/chunks/chunk-overlay-persistence';

function withTempDbPath<T>(fn: (dbPath: string) => T): T {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'bq-chunks-'));
    const dbPath = path.join(dir, 'chunks.sqlite');
    try {
        return fn(dbPath);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

test('flushDirtyChunks persists overlays and loadRecentIntoStore reloads them', () => {
    withTempDbPath((dbPath) => {
        const store = new ChunkOverlayStore({ chunkSize: 4 });
        store.setGlobal(0, 0, 10);
        store.setGlobal(-1, -1, 20);

        const persistence = new SqliteChunkOverlayPersistence(dbPath);
        const flushed = persistence.flushDirtyChunks(store, 1000);
        persistence.close();

        expect(flushed).toEqual({ flushed: 2 });
        expect(store.listDirtyChunks()).toEqual([]);

        const store2 = new ChunkOverlayStore({ chunkSize: 4 });
        const persistence2 = new SqliteChunkOverlayPersistence(dbPath);
        const loaded = persistence2.loadRecentIntoStore(store2, { limitChunks: 10 });
        persistence2.close();

        expect(loaded.loaded).toBe(2);
        expect(store2.getGlobal(0, 0)).toBe(10);
        expect(store2.getGlobal(-1, -1)).toBe(20);
        expect(store2.getChunk(0, 0)?.dirty).toBe(false);
        expect(store2.getChunk(-1, -1)?.dirty).toBe(false);
        expect(store2.getChunk(0, 0)?.version).toBe(1);
        expect(store2.getChunk(-1, -1)?.version).toBe(1);
    });
});

test('loadRecentIntoStore honors limitChunks', () => {
    withTempDbPath((dbPath) => {
        const store = new ChunkOverlayStore({ chunkSize: 4 });
        store.setGlobal(0, 0, 1);
        store.setGlobal(4, 0, 2);

        const persistence = new SqliteChunkOverlayPersistence(dbPath);
        persistence.flushDirtyChunks(store, 1000);

        // Update one chunk later so it becomes the most recent.
        store.setGlobal(0, 1, 3);
        persistence.flushDirtyChunks(store, 2000);
        persistence.close();

        const store2 = new ChunkOverlayStore({ chunkSize: 4 });
        const persistence2 = new SqliteChunkOverlayPersistence(dbPath);
        const loaded = persistence2.loadRecentIntoStore(store2, { limitChunks: 1 });
        persistence2.close();

        expect(loaded.loaded).toBe(1);
        expect(store2.getGlobal(0, 0)).toBe(1);
        expect(store2.getGlobal(0, 1)).toBe(3);
        expect(store2.getGlobal(4, 0)).toBeNull();
    });
});

test('flushDirtyChunks is a no-op when nothing is dirty', () => {
    withTempDbPath((dbPath) => {
        const store = new ChunkOverlayStore({ chunkSize: 4 });
        const persistence = new SqliteChunkOverlayPersistence(dbPath);
        expect(persistence.flushDirtyChunks(store, 1000)).toEqual({ flushed: 0 });
        persistence.close();
    });
});

test('loadChunkIntoStore restores a cold chunk that was not bootstrapped by recency limit', () => {
    withTempDbPath((dbPath) => {
        const store = new ChunkOverlayStore({ chunkSize: 4 });
        store.setGlobal(400, 0, 77); // chunk (100, 0)

        const persistence = new SqliteChunkOverlayPersistence(dbPath);
        persistence.flushDirtyChunks(store, 1000);
        store.setGlobal(0, 0, 11); // chunk (0, 0)
        persistence.flushDirtyChunks(store, 2000);
        persistence.close();

        const store2 = new ChunkOverlayStore({ chunkSize: 4 });
        const persistence2 = new SqliteChunkOverlayPersistence(dbPath);
        expect(persistence2.loadRecentIntoStore(store2, { limitChunks: 1 })).toEqual({ loaded: 1 });
        expect(store2.getGlobal(0, 0)).toBe(11);
        expect(store2.getGlobal(400, 0)).toBeNull();

        expect(persistence2.loadChunkIntoStore(store2, 100, 0)).toEqual({ loaded: true });
        expect(store2.getGlobal(400, 0)).toBe(77);

        // Idempotent: already loaded chunks are not reloaded.
        expect(persistence2.loadChunkIntoStore(store2, 100, 0)).toEqual({ loaded: false });
        expect(persistence2.loadChunkIntoStore(store2, 999, 999)).toEqual({ loaded: false });
        persistence2.close();
    });
});
