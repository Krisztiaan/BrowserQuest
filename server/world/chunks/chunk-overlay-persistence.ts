import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { ChunkOverlayStore } from './chunk-overlay-store';

const DEFAULT_CHUNK_DB_PATH = './server/.data/chunk-overlays.sqlite';

function resolveDatabasePath(configuredPath: string | null | undefined): string {
    const trimmed = typeof configuredPath === 'string' ? configuredPath.trim() : '';
    if (!trimmed) {
        return path.resolve(DEFAULT_CHUNK_DB_PATH);
    }
    if (trimmed === ':memory:') {
        return trimmed;
    }
    return path.resolve(trimmed);
}

type OverlayRow = {
    map_id: string;
    chunk_x: number;
    chunk_y: number;
    chunk_size: number;
    version: number;
    values_blob: Uint8Array;
    present_blob: Uint8Array;
};

export class SqliteChunkOverlayPersistence {
    readonly databasePath: string;
    readonly #db: Database;
    readonly #upsertOverlay: ReturnType<Database['prepare']>;
    readonly #selectRecent: ReturnType<Database['prepare']>;
    readonly #selectChunkByCoords: ReturnType<Database['prepare']>;

    constructor(configuredPath?: string | null) {
        this.databasePath = resolveDatabasePath(configuredPath);
        if (this.databasePath !== ':memory:') {
            mkdirSync(path.dirname(this.databasePath), { recursive: true });
        }

        this.#db = new Database(this.databasePath, { create: true });
        this.#db.exec(`
            PRAGMA journal_mode=WAL;
            PRAGMA synchronous=NORMAL;
            PRAGMA foreign_keys=ON;

            CREATE TABLE IF NOT EXISTS chunk_overlays (
                map_id TEXT NOT NULL DEFAULT 'world',
                chunk_x INTEGER NOT NULL,
                chunk_y INTEGER NOT NULL,
                chunk_size INTEGER NOT NULL,
                version INTEGER NOT NULL,
                values_blob BLOB NOT NULL,
                present_blob BLOB NOT NULL,
                updated_at INTEGER NOT NULL,
                PRIMARY KEY (map_id, chunk_x, chunk_y)
            );
            CREATE INDEX IF NOT EXISTS chunk_overlays_updated_at ON chunk_overlays(updated_at);
            CREATE INDEX IF NOT EXISTS chunk_overlays_map_id ON chunk_overlays(map_id);
            CREATE UNIQUE INDEX IF NOT EXISTS chunk_overlays_map_coords ON chunk_overlays(map_id, chunk_x, chunk_y);
        `);

        const overlayColumns = this.#db.query("PRAGMA table_info('chunk_overlays')").all() as Array<{ name?: string }>;
        const hasMapId = overlayColumns.some((column) => column.name === 'map_id');
        if (!hasMapId) {
            this.#db.exec(`ALTER TABLE chunk_overlays ADD COLUMN map_id TEXT NOT NULL DEFAULT 'world'`);
            this.#db.exec(`DROP INDEX IF EXISTS chunk_overlays_updated_at`);
            this.#db.exec(`DROP INDEX IF EXISTS chunk_overlays_map_id`);
            this.#db.exec(`DROP INDEX IF EXISTS chunk_overlays_map_coords`);
            this.#db.exec(`CREATE INDEX IF NOT EXISTS chunk_overlays_updated_at ON chunk_overlays(updated_at)`);
            this.#db.exec(`CREATE INDEX IF NOT EXISTS chunk_overlays_map_id ON chunk_overlays(map_id)`);
            this.#db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS chunk_overlays_map_coords ON chunk_overlays(map_id, chunk_x, chunk_y)`);
        }

        this.#upsertOverlay = this.#db.prepare(`
            INSERT INTO chunk_overlays
                (map_id, chunk_x, chunk_y, chunk_size, version, values_blob, present_blob, updated_at)
            VALUES
                (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            ON CONFLICT(map_id, chunk_x, chunk_y) DO UPDATE SET
                chunk_size = excluded.chunk_size,
                version = excluded.version,
                values_blob = excluded.values_blob,
                present_blob = excluded.present_blob,
                updated_at = excluded.updated_at
        `);

        this.#selectRecent = this.#db.prepare(`
            SELECT map_id, chunk_x, chunk_y, chunk_size, version, values_blob, present_blob
            FROM chunk_overlays
            ORDER BY updated_at DESC
            LIMIT ?1
        `);

        this.#selectChunkByCoords = this.#db.prepare(`
            SELECT map_id, chunk_x, chunk_y, chunk_size, version, values_blob, present_blob
            FROM chunk_overlays
            WHERE map_id = ?1 AND chunk_x = ?2 AND chunk_y = ?3
            LIMIT 1
        `);
    }

    close(): void {
        this.#db.close();
    }

    flushDirtyChunks(store: ChunkOverlayStore, nowMs = Date.now()): { flushed: number } {
        const dirty = store.listDirtyChunks();
        return this.flushChunks(dirty, store, nowMs);
    }

    flushChunks(
        chunks: ReadonlyArray<{
            mapId: string;
            chunkX: number;
            chunkY: number;
            size: number;
            version: number;
            values: Uint32Array;
            present: Uint8Array;
        }>,
        store: ChunkOverlayStore,
        nowMs = Date.now(),
        opts?: { maxChunks?: number }
    ): { flushed: number } {
        const maxChunks = opts?.maxChunks ?? Number.POSITIVE_INFINITY;
        const limit = Number.isFinite(maxChunks) ? Math.max(0, Math.floor(maxChunks)) : Number.POSITIVE_INFINITY;
        if (limit === 0 || chunks.length === 0) {
            return { flushed: 0 };
        }

        const dirty = chunks.slice(0, limit);
        if (dirty.length === 0) {
            return { flushed: 0 };
        }

        const chunkSize = store.chunkSize;
        const expectedCells = chunkSize * chunkSize;

        this.#db.exec('BEGIN');
        try {
            for (const chunk of dirty) {
                if (chunk.size !== chunkSize) {
                    throw new Error(`ChunkOverlayStore size mismatch: ${chunk.size} !== ${chunkSize}`);
                }
                if (chunk.values.length !== expectedCells || chunk.present.length !== expectedCells) {
                    throw new Error('ChunkOverlayStore: overlay arrays have unexpected size');
                }

                const valuesBlob = new Uint8Array(chunk.values.buffer.slice(0));
                const presentBlob = new Uint8Array(chunk.present.buffer.slice(0));
                this.#upsertOverlay.run(
                    chunk.mapId,
                    chunk.chunkX,
                    chunk.chunkY,
                    chunkSize,
                    chunk.version,
                    valuesBlob,
                    presentBlob,
                    nowMs
                );
            }
            this.#db.exec('COMMIT');
        } catch (err) {
            this.#db.exec('ROLLBACK');
            throw err;
        }

        for (const chunk of dirty) {
            store.markChunkClean(chunk.chunkX, chunk.chunkY, chunk.mapId);
        }
        return { flushed: dirty.length };
    }

    loadRecentIntoStore(store: ChunkOverlayStore, opts?: { limitChunks?: number }): { loaded: number } {
        const limit = opts?.limitChunks ?? 1000;
        if (!Number.isInteger(limit) || limit <= 0) {
            throw new Error(`loadRecentIntoStore: invalid limitChunks: ${String(limit)}`);
        }

        const rows = this.#selectRecent.all(limit) as OverlayRow[];
        let loaded = 0;
        for (const row of rows) {
            if (this.#applyRowToStore(store, row)) {
                loaded += 1;
            }
        }

        return { loaded };
    }

    loadChunkIntoStore(store: ChunkOverlayStore, chunkX: number, chunkY: number, mapId = 'world'): { loaded: boolean } {
        if (!Number.isSafeInteger(chunkX) || !Number.isSafeInteger(chunkY)) {
            throw new Error(`loadChunkIntoStore: invalid chunk coords: (${String(chunkX)}, ${String(chunkY)})`);
        }
        if (store.getChunk(chunkX, chunkY, mapId)) {
            return { loaded: false };
        }

        const row = this.#selectChunkByCoords.get(mapId, chunkX, chunkY) as OverlayRow | null;
        if (!row) {
            return { loaded: false };
        }

        return { loaded: this.#applyRowToStore(store, row) };
    }

    #applyRowToStore(store: ChunkOverlayStore, row: OverlayRow): boolean {
        const chunkSize = store.chunkSize;
        if (row.chunk_size !== chunkSize) {
            return false;
        }

        const expectedCells = chunkSize * chunkSize;
        const expectedValuesBytes = expectedCells * 4;
        const expectedPresentBytes = expectedCells;
        const valuesBlob = row.values_blob;
        const presentBlob = row.present_blob;
        if (valuesBlob.byteLength !== expectedValuesBytes || presentBlob.byteLength !== expectedPresentBytes) {
            return false;
        }

        const mapId = typeof row.map_id === 'string' && row.map_id.trim().length > 0 ? row.map_id : 'world';
        const chunk = store.getOrCreateChunk(row.chunk_x, row.chunk_y, mapId);
        const valuesView = new Uint32Array(valuesBlob.buffer.slice(valuesBlob.byteOffset, valuesBlob.byteOffset + valuesBlob.byteLength));
        chunk.values.set(valuesView);
        chunk.present.set(presentBlob);
        chunk.version = row.version >>> 0;
        chunk.dirty = false;
        store.markChunkClean(chunk.chunkX, chunk.chunkY, mapId);
        return true;
    }
}
