import type { ChunkOverlayStore } from './chunk-overlay-store';
import type { SqliteChunkOverlayPersistence } from './chunk-overlay-persistence';

export type ChunkFlushSchedulerConfig = Readonly<{
    flushIntervalMs: number;
    maxChunksPerFlush: number;
}>;

export class ChunkFlushScheduler {
    readonly #store: ChunkOverlayStore;
    readonly #persistence: SqliteChunkOverlayPersistence;
    readonly #config: ChunkFlushSchedulerConfig;
    #lastFlushAtMs = -Infinity;

    constructor(params: { store: ChunkOverlayStore; persistence: SqliteChunkOverlayPersistence; config: ChunkFlushSchedulerConfig }) {
        const { store, persistence, config } = params;
        if (!Number.isFinite(config.flushIntervalMs) || config.flushIntervalMs <= 0) {
            throw new Error(`ChunkFlushScheduler: invalid flushIntervalMs: ${String(config.flushIntervalMs)}`);
        }
        if (!Number.isFinite(config.maxChunksPerFlush) || config.maxChunksPerFlush <= 0) {
            throw new Error(`ChunkFlushScheduler: invalid maxChunksPerFlush: ${String(config.maxChunksPerFlush)}`);
        }
        this.#store = store;
        this.#persistence = persistence;
        this.#config = config;
    }

    tick(nowMs = Date.now()): { flushed: number } {
        if (nowMs - this.#lastFlushAtMs < this.#config.flushIntervalMs) {
            return { flushed: 0 };
        }
        this.#lastFlushAtMs = nowMs;

        const dirty = this.#store.listDirtyChunks();
        return this.#persistence.flushChunks(dirty, this.#store, nowMs, { maxChunks: this.#config.maxChunksPerFlush });
    }

    flushAllNow(nowMs = Date.now()): { flushed: number } {
        this.#lastFlushAtMs = nowMs;
        const dirty = this.#store.listDirtyChunks();
        return this.#persistence.flushChunks(dirty, this.#store, nowMs);
    }
}
