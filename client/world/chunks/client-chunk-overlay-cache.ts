export type ClientChunkDeltaChange = Readonly<[number, number, number | null]>;
export type ClientChunkSnapshotOverride = Readonly<[number, number, number]>;

function toUint32(value: number): number {
    return value >>> 0;
}

function makeChunkKey(chunkX: number, chunkY: number): bigint {
    return (BigInt(toUint32(chunkX)) << 32n) | BigInt(toUint32(chunkY));
}

export class ClientChunkOverlay {
    readonly chunkX: number;
    readonly chunkY: number;
    readonly size: number;
    version = 0;

    readonly values: Uint32Array;
    readonly present: Uint8Array;

    constructor({ chunkX, chunkY, size }: { chunkX: number; chunkY: number; size: number }) {
        this.chunkX = chunkX;
        this.chunkY = chunkY;
        this.size = size;
        const cellCount = size * size;
        this.values = new Uint32Array(cellCount);
        this.present = new Uint8Array(cellCount);
    }
}

export class ClientChunkOverlayCache {
    chunkSize: number | null = null;
    readonly #chunks = new Map<bigint, ClientChunkOverlay>();
    readonly #pendingSnapshotParts = new Map<
        bigint,
        {
            version: number;
            chunkSize: number;
            partCount: number;
            nextPartIndex: number;
            overrides: ClientChunkSnapshotOverride[];
        }
    >();

    clear(): void {
        this.#chunks.clear();
        this.chunkSize = null;
        this.#pendingSnapshotParts.clear();
    }

    getChunk(chunkX: number, chunkY: number): ClientChunkOverlay | null {
        return this.#chunks.get(makeChunkKey(chunkX, chunkY)) ?? null;
    }

    applySnapshot({
        chunkX,
        chunkY,
        version,
        chunkSize,
        overrides,
    }: {
        chunkX: number;
        chunkY: number;
        version: number;
        chunkSize: number;
        overrides: ClientChunkSnapshotOverride[];
    }): void {
        if (!Number.isInteger(chunkX) || !Number.isInteger(chunkY) || !Number.isInteger(version) || version < 0) {
            return;
        }
        if (!Number.isInteger(chunkSize) || chunkSize <= 0 || chunkSize > 256) {
            return;
        }
        if (this.chunkSize === null) {
            this.chunkSize = chunkSize;
        } else if (this.chunkSize !== chunkSize) {
            // Defensive: ignore mismatched chunk sizes until a full cache-reset protocol exists.
            return;
        }

        const key = makeChunkKey(chunkX, chunkY);
        const existing = this.#chunks.get(key);
        const chunk = existing ?? new ClientChunkOverlay({ chunkX, chunkY, size: chunkSize });
        if (!existing) {
            this.#chunks.set(key, chunk);
        }

        chunk.present.fill(0);
        chunk.values.fill(0);
        chunk.version = version >>> 0;

        for (let i = 0; i < overrides.length; i += 1) {
            const entry = overrides[i];
            if (!entry) {
                continue;
            }
            const [localX, localY, value] = entry;
            if (
                !Number.isInteger(localX) ||
                !Number.isInteger(localY) ||
                !Number.isInteger(value) ||
                localX < 0 ||
                localY < 0 ||
                localX >= chunkSize ||
                localY >= chunkSize ||
                value < 0
            ) {
                continue;
            }
            const idx = localY * chunkSize + localX;
            chunk.present[idx] = 1;
            chunk.values[idx] = value >>> 0;
        }
    }

    applySnapshotPart({
        chunkX,
        chunkY,
        version,
        partIndex,
        partCount,
        chunkSize,
        overrides,
    }: {
        chunkX: number;
        chunkY: number;
        version: number;
        partIndex: number;
        partCount: number;
        chunkSize: number;
        overrides: ClientChunkSnapshotOverride[];
    }): { applied: boolean } {
        if (
            !Number.isInteger(chunkX) ||
            !Number.isInteger(chunkY) ||
            !Number.isInteger(version) ||
            version < 0 ||
            !Number.isInteger(partIndex) ||
            !Number.isInteger(partCount) ||
            partIndex < 0 ||
            partCount <= 0 ||
            partIndex >= partCount
        ) {
            return { applied: false };
        }
        if (!Number.isInteger(chunkSize) || chunkSize <= 0 || chunkSize > 256) {
            return { applied: false };
        }

        const key = makeChunkKey(chunkX, chunkY);
        if (partIndex === 0) {
            this.#pendingSnapshotParts.set(key, {
                version: version >>> 0,
                chunkSize,
                partCount,
                nextPartIndex: 0,
                overrides: [],
            });
        }

        const pending = this.#pendingSnapshotParts.get(key);
        if (!pending) {
            return { applied: false };
        }
        if (
            pending.version !== version >>> 0 ||
            pending.partCount !== partCount ||
            pending.chunkSize !== chunkSize ||
            pending.nextPartIndex !== partIndex
        ) {
            this.#pendingSnapshotParts.delete(key);
            return { applied: false };
        }

        const maxOverrides = chunkSize * chunkSize;
        if (pending.overrides.length + overrides.length > maxOverrides) {
            this.#pendingSnapshotParts.delete(key);
            return { applied: false };
        }
        pending.overrides.push(...overrides);
        pending.nextPartIndex += 1;

        if (pending.nextPartIndex < pending.partCount) {
            return { applied: false };
        }

        this.#pendingSnapshotParts.delete(key);
        this.applySnapshot({ chunkX, chunkY, version, chunkSize, overrides: pending.overrides });
        return { applied: true };
    }

    applyDelta({
        chunkX,
        chunkY,
        fromVersion,
        toVersion,
        changes,
    }: {
        chunkX: number;
        chunkY: number;
        fromVersion: number;
        toVersion: number;
        changes: ClientChunkDeltaChange[];
    }): boolean {
        if (
            !Number.isInteger(chunkX) ||
            !Number.isInteger(chunkY) ||
            !Number.isInteger(fromVersion) ||
            !Number.isInteger(toVersion) ||
            fromVersion < 0 ||
            toVersion < 0
        ) {
            return false;
        }
        const chunkSize = this.chunkSize;
        if (chunkSize === null) {
            return false;
        }
        const chunk = this.getChunk(chunkX, chunkY);
        if (!chunk) {
            return false;
        }
        if (chunk.version !== fromVersion >>> 0) {
            return false;
        }

        for (let i = 0; i < changes.length; i += 1) {
            const entry = changes[i];
            if (!entry) {
                continue;
            }
            const [localX, localY, value] = entry;
            if (
                !Number.isInteger(localX) ||
                !Number.isInteger(localY) ||
                localX < 0 ||
                localY < 0 ||
                localX >= chunkSize ||
                localY >= chunkSize
            ) {
                continue;
            }
            const idx = localY * chunkSize + localX;
            if (value === null) {
                chunk.present[idx] = 0;
                chunk.values[idx] = 0;
                continue;
            }
            if (!Number.isInteger(value) || value < 0) {
                continue;
            }
            chunk.present[idx] = 1;
            chunk.values[idx] = value >>> 0;
        }

        chunk.version = toVersion >>> 0;
        return true;
    }

    getGlobal(x: number, y: number): number | null {
        const chunkSize = this.chunkSize;
        if (chunkSize === null) {
            return null;
        }
        if (!Number.isInteger(x) || !Number.isInteger(y)) {
            return null;
        }

        const chunkX = Math.floor(x / chunkSize);
        const chunkY = Math.floor(y / chunkSize);
        const localX = x - chunkX * chunkSize;
        const localY = y - chunkY * chunkSize;

        const chunk = this.getChunk(chunkX, chunkY);
        if (!chunk) {
            return null;
        }

        const idx = localY * chunkSize + localX;
        if (chunk.present[idx] !== 1) {
            return null;
        }
        const value = chunk.values[idx];
        return value ?? null;
    }

    forEachPresentGlobal(callback: (x: number, y: number, value: number) => void): void {
        for (const chunk of this.#chunks.values()) {
            const chunkSize = chunk.size;
            const baseX = chunk.chunkX * chunkSize;
            const baseY = chunk.chunkY * chunkSize;

            for (let idx = 0; idx < chunk.present.length; idx += 1) {
                if (chunk.present[idx] !== 1) {
                    continue;
                }

                const localX = idx % chunkSize;
                const localY = Math.floor(idx / chunkSize);
                callback(baseX + localX, baseY + localY, chunk.values[idx] ?? 0);
            }
        }
    }
}
