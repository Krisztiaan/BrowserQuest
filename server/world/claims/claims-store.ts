import { makeChunkKey } from '../chunks/chunk-overlay-store';
import { normalizeIdentityKey, normalizeIdentityKeyList } from '../../identity';

export type RectClaim = Readonly<{
    id: number;
    ownerName: string;
    editorNameKeys: ReadonlyArray<string>;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    createdAtMs: number;
    updatedAtMs: number;
}>;

function clampRectBounds(x1: number, y1: number, x2: number, y2: number): { x1: number; y1: number; x2: number; y2: number } {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    return { x1: minX, y1: minY, x2: maxX, y2: maxY };
}

function resolveIndexChunkCoords(indexChunkSize: number, x: number, y: number): { chunkX: number; chunkY: number } {
    return { chunkX: Math.floor(x / indexChunkSize), chunkY: Math.floor(y / indexChunkSize) };
}

function normalizeEditorNameKeys(ownerName: string, rawEditorNameKeys: ReadonlyArray<string> | null | undefined): string[] {
    return normalizeIdentityKeyList(rawEditorNameKeys, { exclude: ownerName });
}

function intersectsRect(a: { x1: number; y1: number; x2: number; y2: number }, b: { x1: number; y1: number; x2: number; y2: number }): boolean {
    return a.x1 <= b.x2 && a.x2 >= b.x1 && a.y1 <= b.y2 && a.y2 >= b.y1;
}

export class ClaimsStore {
    readonly indexChunkSize: number;
    readonly maxIndexCellsPerClaim: number;

    readonly #claimsById = new Map<number, RectClaim>();
    readonly #index = new Map<bigint, number[]>();
    #nextId = 1;

    constructor({ indexChunkSize = 32, maxIndexCellsPerClaim = 4096 }: { indexChunkSize?: number; maxIndexCellsPerClaim?: number } = {}) {
        if (!Number.isInteger(indexChunkSize) || indexChunkSize <= 0 || indexChunkSize > 1024) {
            throw new Error(`ClaimsStore: invalid indexChunkSize: ${String(indexChunkSize)}`);
        }
        if (!Number.isInteger(maxIndexCellsPerClaim) || maxIndexCellsPerClaim <= 0) {
            throw new Error(`ClaimsStore: invalid maxIndexCellsPerClaim: ${String(maxIndexCellsPerClaim)}`);
        }
        this.indexChunkSize = indexChunkSize;
        this.maxIndexCellsPerClaim = maxIndexCellsPerClaim;
    }

    clear(): void {
        this.#claimsById.clear();
        this.#index.clear();
        this.#nextId = 1;
    }

    listClaims(): RectClaim[] {
        return Array.from(this.#claimsById.values()).sort((a, b) => a.id - b.id);
    }

    getClaimById(id: number): RectClaim | null {
        return this.#claimsById.get(id) ?? null;
    }

    loadClaims(claims: ReadonlyArray<RectClaim>): void {
        this.clear();
        let maxId = 0;
        for (const claim of claims) {
            this.#upsertLoadedClaim(claim);
            if (claim.id > maxId) {
                maxId = claim.id;
            }
        }
        this.#nextId = maxId + 1;
    }

    createClaim({
        ownerName,
        editorNameKeys,
        x1,
        y1,
        x2,
        y2,
        nowMs = Date.now(),
    }: {
        ownerName: string;
        editorNameKeys?: ReadonlyArray<string>;
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        nowMs?: number;
    }): RectClaim {
        if (typeof ownerName !== 'string' || ownerName.trim() === '') {
            throw new Error('ClaimsStore: ownerName is required');
        }
        if (![x1, y1, x2, y2].every((v) => Number.isInteger(v))) {
            throw new Error('ClaimsStore: rect coords must be integers');
        }
        if (!Number.isFinite(nowMs) || nowMs <= 0) {
            throw new Error('ClaimsStore: invalid nowMs');
        }

        const id = this.#nextId++;
        const bounds = clampRectBounds(x1, y1, x2, y2);
        const normalizedOwnerName = normalizeIdentityKey(ownerName);
        const claim: RectClaim = Object.freeze({
            id,
            ownerName: normalizedOwnerName,
            editorNameKeys: normalizeEditorNameKeys(normalizedOwnerName, editorNameKeys),
            ...bounds,
            createdAtMs: Math.floor(nowMs),
            updatedAtMs: Math.floor(nowMs),
        });
        this.#upsertLoadedClaim(claim);
        return claim;
    }

    updateClaim({
        id,
        ownerName,
        editorNameKeys,
        x1,
        y1,
        x2,
        y2,
        nowMs = Date.now(),
    }: {
        id: number;
        ownerName?: string;
        editorNameKeys?: ReadonlyArray<string>;
        x1?: number;
        y1?: number;
        x2?: number;
        y2?: number;
        nowMs?: number;
    }): RectClaim | null {
        const existing = this.#claimsById.get(id);
        if (!existing) {
            return null;
        }
        if (!Number.isFinite(nowMs) || nowMs <= 0) {
            throw new Error('ClaimsStore: invalid nowMs');
        }

        const hasX1 = x1 !== undefined;
        const hasY1 = y1 !== undefined;
        const hasX2 = x2 !== undefined;
        const hasY2 = y2 !== undefined;
        if (hasX1 || hasY1 || hasX2 || hasY2) {
            if (![x1, y1, x2, y2].every((value) => value === undefined || Number.isInteger(value))) {
                throw new Error('ClaimsStore: rect coords must be integers');
            }
            if (!(hasX1 && hasY1 && hasX2 && hasY2)) {
                throw new Error('ClaimsStore: rect update must include x1,y1,x2,y2');
            }
        }

        const nextOwnerName = ownerName === undefined ? existing.ownerName : normalizeIdentityKey(ownerName);
        if (!nextOwnerName) {
            throw new Error('ClaimsStore: ownerName is required');
        }

        const nextBounds = clampRectBounds(
            hasX1 ? x1 : existing.x1,
            hasY1 ? y1 : existing.y1,
            hasX2 ? x2 : existing.x2,
            hasY2 ? y2 : existing.y2
        );
        const nextEditorNameKeys =
            editorNameKeys === undefined
                ? normalizeEditorNameKeys(nextOwnerName, existing.editorNameKeys)
                : normalizeEditorNameKeys(nextOwnerName, editorNameKeys);

        const nextClaim: RectClaim = Object.freeze({
            id: existing.id,
            ownerName: nextOwnerName,
            editorNameKeys: nextEditorNameKeys,
            ...nextBounds,
            createdAtMs: existing.createdAtMs,
            updatedAtMs: Math.floor(nowMs),
        });
        this.#upsertLoadedClaim(nextClaim);
        return nextClaim;
    }

    countClaimsByOwner(ownerName: string): number {
        const normalizedOwner = normalizeIdentityKey(ownerName);
        if (!normalizedOwner) {
            return 0;
        }
        let count = 0;
        for (const claim of this.#claimsById.values()) {
            if (claim.ownerName === normalizedOwner) {
                count += 1;
            }
        }
        return count;
    }

    findFirstOverlappingClaim({
        x1,
        y1,
        x2,
        y2,
        excludeClaimId,
    }: {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        excludeClaimId?: number;
    }): RectClaim | null {
        if (![x1, y1, x2, y2].every((v) => Number.isInteger(v))) {
            return null;
        }
        const target = clampRectBounds(x1, y1, x2, y2);
        const { chunkX: startX, chunkY: startY } = resolveIndexChunkCoords(this.indexChunkSize, target.x1, target.y1);
        const { chunkX: endX, chunkY: endY } = resolveIndexChunkCoords(this.indexChunkSize, target.x2, target.y2);
        const candidateIds = new Set<number>();

        for (let cy = startY; cy <= endY; cy += 1) {
            for (let cx = startX; cx <= endX; cx += 1) {
                const bucket = this.#index.get(makeChunkKey(cx, cy));
                if (!bucket) {
                    continue;
                }
                for (let i = 0; i < bucket.length; i += 1) {
                    const id = bucket[i];
                    if (id === undefined || id === excludeClaimId) {
                        continue;
                    }
                    candidateIds.add(id);
                }
            }
        }

        let oldestOverlap: RectClaim | null = null;
        for (const id of candidateIds) {
            const claim = this.#claimsById.get(id);
            if (!claim) {
                continue;
            }
            if (!intersectsRect(target, claim)) {
                continue;
            }
            if (!oldestOverlap || claim.id < oldestOverlap.id) {
                oldestOverlap = claim;
            }
        }
        return oldestOverlap;
    }

    deleteClaim(id: number): boolean {
        const existing = this.#claimsById.get(id);
        if (!existing) {
            return false;
        }
        this.#claimsById.delete(id);
        this.#removeFromIndex(existing);
        return true;
    }

    getClaimAt(x: number, y: number): RectClaim | null {
        if (!Number.isInteger(x) || !Number.isInteger(y)) {
            return null;
        }
        const { chunkX, chunkY } = resolveIndexChunkCoords(this.indexChunkSize, x, y);
        const bucket = this.#index.get(makeChunkKey(chunkX, chunkY));
        if (!bucket || bucket.length === 0) {
            return null;
        }
        let oldestClaim: RectClaim | null = null;
        for (let i = 0; i < bucket.length; i += 1) {
            const id = bucket[i];
            if (id === undefined) {
                continue;
            }
            const claim = this.#claimsById.get(id);
            if (!claim) {
                continue;
            }
            if (!(x >= claim.x1 && x <= claim.x2 && y >= claim.y1 && y <= claim.y2)) {
                continue;
            }
            if (!oldestClaim || claim.id < oldestClaim.id) {
                oldestClaim = claim;
            }
        }
        return oldestClaim;
    }

    #upsertLoadedClaim(claim: RectClaim): void {
        if (!Number.isInteger(claim.id) || claim.id <= 0) {
            throw new Error('ClaimsStore: invalid claim id');
        }
        if (typeof claim.ownerName !== 'string' || claim.ownerName.trim() === '') {
            throw new Error('ClaimsStore: invalid ownerName');
        }
        if (!Array.isArray(claim.editorNameKeys) || !claim.editorNameKeys.every((value) => typeof value === 'string')) {
            throw new Error('ClaimsStore: invalid editorNameKeys');
        }
        if (![claim.x1, claim.y1, claim.x2, claim.y2].every((v) => Number.isInteger(v))) {
            throw new Error('ClaimsStore: invalid rect coords');
        }
        const bounds = clampRectBounds(claim.x1, claim.y1, claim.x2, claim.y2);
        const normalizedOwnerName = normalizeIdentityKey(claim.ownerName);
        const normalized: RectClaim = Object.freeze({
            ...claim,
            ownerName: normalizedOwnerName,
            editorNameKeys: normalizeEditorNameKeys(normalizedOwnerName, claim.editorNameKeys),
            ...bounds,
        });

        const existing = this.#claimsById.get(normalized.id);
        if (existing) {
            this.#removeFromIndex(existing);
        }
        this.#claimsById.set(normalized.id, normalized);
        this.#addToIndex(normalized);
    }

    #addToIndex(claim: RectClaim): void {
        const indexSize = this.indexChunkSize;
        const { chunkX: startX, chunkY: startY } = resolveIndexChunkCoords(indexSize, claim.x1, claim.y1);
        const { chunkX: endX, chunkY: endY } = resolveIndexChunkCoords(indexSize, claim.x2, claim.y2);
        const spanX = endX - startX + 1;
        const spanY = endY - startY + 1;
        const cells = spanX * spanY;
        if (cells > this.maxIndexCellsPerClaim) {
            throw new Error(`ClaimsStore: claim ${claim.id} indexes too many cells (${cells})`);
        }

        for (let cy = startY; cy <= endY; cy += 1) {
            for (let cx = startX; cx <= endX; cx += 1) {
                const key = makeChunkKey(cx, cy);
                const bucket = this.#index.get(key);
                if (!bucket) {
                    this.#index.set(key, [claim.id]);
                    continue;
                }
                let exists = false;
                for (let i = 0; i < bucket.length; i += 1) {
                    if (bucket[i] === claim.id) {
                        exists = true;
                        break;
                    }
                }
                if (!exists) {
                    bucket.push(claim.id);
                }
            }
        }
    }

    #removeFromIndex(claim: RectClaim): void {
        const indexSize = this.indexChunkSize;
        const { chunkX: startX, chunkY: startY } = resolveIndexChunkCoords(indexSize, claim.x1, claim.y1);
        const { chunkX: endX, chunkY: endY } = resolveIndexChunkCoords(indexSize, claim.x2, claim.y2);

        for (let cy = startY; cy <= endY; cy += 1) {
            for (let cx = startX; cx <= endX; cx += 1) {
                const key = makeChunkKey(cx, cy);
                const bucket = this.#index.get(key);
                if (!bucket) {
                    continue;
                }
                let writeIndex = 0;
                for (let readIndex = 0; readIndex < bucket.length; readIndex += 1) {
                    const current = bucket[readIndex];
                    if (current === undefined || current === claim.id) {
                        continue;
                    }
                    bucket[writeIndex] = current;
                    writeIndex += 1;
                }

                if (writeIndex === 0) {
                    this.#index.delete(key);
                } else if (writeIndex !== bucket.length) {
                    bucket.length = writeIndex;
                }
            }
        }
    }
}
