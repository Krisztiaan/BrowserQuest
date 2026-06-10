export type ChunkCoord = Readonly<{ x: number; y: number }>;

export type ChunkOverlaySnapshot = Readonly<{
    mapId: string;
    chunkX: number;
    chunkY: number;
    version: number;
    // Dense, row-major overlays plus a matching present-mask (0/1) array.
    values: Uint32Array;
    present: Uint8Array;
}>;

function toUint32(value: number): number {
    return value >>> 0;
}

export function makeChunkKey(chunkX: number, chunkY: number): bigint {
    return (BigInt(toUint32(chunkX)) << 32n) | BigInt(toUint32(chunkY));
}

export function makeScopedChunkKey(mapId: string, chunkX: number, chunkY: number): string {
    return `${mapId}:${chunkX}:${chunkY}`;
}

export class ChunkOverlay {
    readonly mapId: string;
    readonly chunkX: number;
    readonly chunkY: number;
    readonly size: number;
    version = 0;
    dirty = false;

    readonly values: Uint32Array;
    readonly present: Uint8Array;

    #pendingDeltaBaseVersion: number | null = null;
    readonly #pendingDeltaMask: Uint8Array;
    readonly #pendingDeltaIndices: number[] = [];

    constructor({ mapId, chunkX, chunkY, size }: { mapId: string; chunkX: number; chunkY: number; size: number }) {
        this.mapId = mapId;
        this.chunkX = chunkX;
        this.chunkY = chunkY;
        this.size = size;
        const cellCount = size * size;
        this.values = new Uint32Array(cellCount);
        this.present = new Uint8Array(cellCount);
        this.#pendingDeltaMask = new Uint8Array(cellCount);
    }

    #idx(localX: number, localY: number): number {
        if (
            !Number.isInteger(localX) ||
            !Number.isInteger(localY) ||
            localX < 0 ||
            localY < 0 ||
            localX >= this.size ||
            localY >= this.size
        ) {
            throw new Error(`ChunkOverlay: local coords out of bounds: (${localX}, ${localY})`);
        }
        return localY * this.size + localX;
    }

    getLocal(localX: number, localY: number): number | null {
        const i = this.#idx(localX, localY);
        const value = this.values[i];
        return this.present[i] === 1 && value !== undefined ? value : null;
    }

    #markPendingDelta(i: number, baseVersion: number): void {
        if (this.#pendingDeltaBaseVersion === null) {
            this.#pendingDeltaBaseVersion = baseVersion;
        }
        if (this.#pendingDeltaMask[i]) {
            return;
        }
        this.#pendingDeltaMask[i] = 1;
        this.#pendingDeltaIndices.push(i);
    }

    setLocal(localX: number, localY: number, value: number): boolean {
        if (!Number.isFinite(value) || !Number.isSafeInteger(value) || value < 0) {
            throw new Error(`ChunkOverlay: invalid value: ${String(value)}`);
        }
        const i = this.#idx(localX, localY);
        const baseVersion = this.version;
        const next = toUint32(value);
        const wasPresent = this.present[i] === 1;
        const prevValue = this.values[i] ?? 0;
        if (wasPresent && prevValue === next) {
            return false;
        }
        this.present[i] = 1;
        this.values[i] = next;
        this.version = toUint32(baseVersion + 1);
        this.#markPendingDelta(i, baseVersion);
        this.dirty = true;
        return true;
    }

    clearLocal(localX: number, localY: number): boolean {
        const i = this.#idx(localX, localY);
        if (!this.present[i]) {
            return false;
        }
        const baseVersion = this.version;
        this.present[i] = 0;
        this.values[i] = 0;
        this.version = toUint32(baseVersion + 1);
        this.#markPendingDelta(i, baseVersion);
        this.dirty = true;
        return true;
    }

    pendingDeltaCellCount(): number {
        return this.#pendingDeltaIndices.length;
    }

    drainPendingDelta(): {
        fromVersion: number;
        toVersion: number;
        changes: Array<[number, number, number | null]>;
    } | null {
        if (this.#pendingDeltaBaseVersion === null || this.#pendingDeltaIndices.length === 0) {
            this.#pendingDeltaBaseVersion = null;
            return null;
        }
        const fromVersion = this.#pendingDeltaBaseVersion;
        const toVersion = this.version;
        const changes: Array<[number, number, number | null]> = [];
        for (let j = 0; j < this.#pendingDeltaIndices.length; j += 1) {
            const idx = this.#pendingDeltaIndices[j];
            if (idx === undefined) {
                continue;
            }
            const localX = idx % this.size;
            const localY = Math.floor(idx / this.size);
            const nextValue = this.values[idx];
            const next = this.present[idx] === 1 && nextValue !== undefined ? nextValue : null;
            changes.push([localX, localY, next]);
            this.#pendingDeltaMask[idx] = 0;
        }
        this.#pendingDeltaIndices.length = 0;
        this.#pendingDeltaBaseVersion = null;
        return { fromVersion, toVersion, changes };
    }

    markClean(): void {
        this.dirty = false;
    }

    snapshot(): ChunkOverlaySnapshot {
        return Object.freeze({
            mapId: this.mapId,
            chunkX: this.chunkX,
            chunkY: this.chunkY,
            version: this.version,
            values: this.values.slice(),
            present: this.present.slice(),
        });
    }
}

export class ChunkOverlayStore {
    readonly chunkSize: number;

    readonly #overlays = new Map<string, ChunkOverlay>();
    readonly #dirtyKeys = new Set<string>();
    readonly #pendingDeltaKeys = new Set<string>();

    constructor({ chunkSize }: { chunkSize: number }) {
        if (!Number.isInteger(chunkSize) || chunkSize <= 0 || chunkSize > 256) {
            throw new Error(`ChunkOverlayStore: invalid chunkSize: ${String(chunkSize)}`);
        }
        this.chunkSize = chunkSize;
    }

    #normalizeMapId(mapId: string): string {
        const trimmed = mapId.trim();
        if (trimmed.length === 0) {
            throw new Error('ChunkOverlayStore: mapId is required');
        }
        return trimmed;
    }

    getChunk(chunkX: number, chunkY: number, mapId = 'world_01'): ChunkOverlay | null {
        const scopedKey = makeScopedChunkKey(this.#normalizeMapId(mapId), chunkX, chunkY);
        return this.#overlays.get(scopedKey) ?? null;
    }

    getOrCreateChunk(chunkX: number, chunkY: number, mapId = 'world_01'): ChunkOverlay {
        const normalizedMapId = this.#normalizeMapId(mapId);
        const key = makeScopedChunkKey(normalizedMapId, chunkX, chunkY);
        const existing = this.#overlays.get(key);
        if (existing) {
            return existing;
        }
        const created = new ChunkOverlay({ mapId: normalizedMapId, chunkX, chunkY, size: this.chunkSize });
        this.#overlays.set(key, created);
        return created;
    }

    getGlobal(x: number, y: number, mapId = 'world_01'): number | null {
        const { chunkX, chunkY, localX, localY } = this.#toChunkLocal(x, y);
        const chunk = this.getChunk(chunkX, chunkY, mapId);
        if (!chunk) {
            return null;
        }
        return chunk.getLocal(localX, localY);
    }

    setGlobal(x: number, y: number, value: number, mapId = 'world_01'): boolean {
        const { chunkX, chunkY, localX, localY } = this.#toChunkLocal(x, y);
        const normalizedMapId = this.#normalizeMapId(mapId);
        const key = makeScopedChunkKey(normalizedMapId, chunkX, chunkY);
        const chunk = this.getOrCreateChunk(chunkX, chunkY, normalizedMapId);
        const changed = chunk.setLocal(localX, localY, value);
        if (changed) {
            this.#dirtyKeys.add(key);
            this.#pendingDeltaKeys.add(key);
        }
        return changed;
    }

    clearGlobal(x: number, y: number, mapId = 'world_01'): boolean {
        const { chunkX, chunkY, localX, localY } = this.#toChunkLocal(x, y);
        const normalizedMapId = this.#normalizeMapId(mapId);
        const key = makeScopedChunkKey(normalizedMapId, chunkX, chunkY);
        const chunk = this.getChunk(chunkX, chunkY, normalizedMapId);
        if (!chunk) {
            return false;
        }
        const changed = chunk.clearLocal(localX, localY);
        if (changed) {
            this.#dirtyKeys.add(key);
            this.#pendingDeltaKeys.add(key);
        }
        return changed;
    }

    listDirtyChunks(): ChunkOverlay[] {
        const out: ChunkOverlay[] = [];
        for (const key of this.#dirtyKeys) {
            const chunk = this.#overlays.get(key);
            if (chunk) {
                out.push(chunk);
            }
        }
        return out;
    }

    listChunksWithPendingDelta(): ChunkOverlay[] {
        const out: ChunkOverlay[] = [];
        for (const key of this.#pendingDeltaKeys) {
            const chunk = this.#overlays.get(key);
            if (!chunk) {
                this.#pendingDeltaKeys.delete(key);
                continue;
            }
            if (chunk.pendingDeltaCellCount() === 0) {
                this.#pendingDeltaKeys.delete(key);
                continue;
            }
            out.push(chunk);
        }
        return out;
    }

    drainPendingDeltaForChunk(
        chunkX: number,
        chunkY: number,
        mapId = 'world_01'
    ): ReturnType<ChunkOverlay['drainPendingDelta']> {
        const key = makeScopedChunkKey(this.#normalizeMapId(mapId), chunkX, chunkY);
        const chunk = this.#overlays.get(key);
        if (!chunk) {
            this.#pendingDeltaKeys.delete(key);
            return null;
        }
        const delta = chunk.drainPendingDelta();
        if (!delta) {
            this.#pendingDeltaKeys.delete(key);
        }
        return delta;
    }

    markChunkClean(chunkX: number, chunkY: number, mapId = 'world_01'): void {
        const key = makeScopedChunkKey(this.#normalizeMapId(mapId), chunkX, chunkY);
        const chunk = this.#overlays.get(key);
        if (chunk) {
            chunk.markClean();
        }
        this.#dirtyKeys.delete(key);
    }

    clearDirty(): void {
        for (const key of this.#dirtyKeys) {
            const chunk = this.#overlays.get(key);
            if (chunk) {
                chunk.markClean();
            }
        }
        this.#dirtyKeys.clear();
    }

    #toChunkLocal(x: number, y: number): { chunkX: number; chunkY: number; localX: number; localY: number } {
        if (!Number.isInteger(x) || !Number.isInteger(y)) {
            throw new Error(`ChunkOverlayStore: global coords must be integers: (${x}, ${y})`);
        }
        const size = this.chunkSize;

        // Euclidean division for potentially-negative coordinates.
        const chunkX = Math.floor(x / size);
        const chunkY = Math.floor(y / size);

        const localX = x - chunkX * size;
        const localY = y - chunkY * size;

        return { chunkX, chunkY, localX, localY };
    }
}
