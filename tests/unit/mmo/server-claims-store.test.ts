import { expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SqliteClaimsPersistence } from '../../../server/world/claims/claims-persistence';
import { ClaimsStore } from '../../../server/world/claims/claims-store';

function withTempDbPath<T>(fn: (dbPath: string) => T): T {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'bq-claims-'));
    const dbPath = path.join(dir, 'claims.sqlite');
    try {
        return fn(dbPath);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

test('claims persistence initializes schema metadata version', () => {
    withTempDbPath((dbPath) => {
        const persistence = new SqliteClaimsPersistence(dbPath);
        persistence.close();

        const db = new Database(dbPath, { readonly: true });
        try {
            const row = db.query(`SELECT value FROM schema_meta WHERE key = 'schema_version'`).get() as { value?: string } | null;
            expect(row?.value).toBe('1');
        } finally {
            db.close();
        }
    });
});

test('ClaimsStore resolves claim ownership for a tile and round-trips through sqlite', () => {
    withTempDbPath((dbPath) => {
        const store = new ClaimsStore({ indexChunkSize: 16 });
        const claim = store.createClaim({ ownerName: 'alice', editorNameKeys: ['bob'], x1: 0, y1: 0, x2: 10, y2: 10, nowMs: 1000 });
        expect(store.getClaimAt(5, 5)?.ownerName).toBe('alice');
        expect(store.getClaimAt(5, 5)?.editorNameKeys).toEqual(['bob']);
        expect(store.getClaimAt(11, 5)).toBeNull();

        const persistence = new SqliteClaimsPersistence(dbPath);
        persistence.upsertClaim(claim, 2000);
        persistence.close();

        const persistence2 = new SqliteClaimsPersistence(dbPath);
        const loadedClaims = persistence2.loadAllClaims();
        persistence2.close();

        const store2 = new ClaimsStore({ indexChunkSize: 16 });
        store2.loadClaims(loadedClaims);
        expect(store2.getClaimAt(5, 5)?.ownerName).toBe('alice');
        expect(store2.getClaimAt(5, 5)?.editorNameKeys).toEqual(['bob']);
        expect(store2.getClaimAt(11, 5)).toBeNull();
    });
});

test('ClaimsStore returns the oldest claim when multiple claims overlap', () => {
    const store = new ClaimsStore({ indexChunkSize: 16 });
    const a = store.createClaim({ ownerName: 'a', x1: 0, y1: 0, x2: 10, y2: 10, nowMs: 1000 });
    const b = store.createClaim({ ownerName: 'b', x1: 5, y1: 5, x2: 15, y2: 15, nowMs: 1001 });
    const resolved = store.getClaimAt(6, 6);
    expect(resolved?.id).toBe(a.id);
    expect(resolved?.ownerName).toBe('a');
    expect(b.id).toBeGreaterThan(a.id);
});

test('ClaimsStore can update claims and detect overlaps with optional exclusion', () => {
    const store = new ClaimsStore({ indexChunkSize: 16 });
    const claimA = store.createClaim({ ownerName: 'alice', editorNameKeys: ['bob'], x1: 0, y1: 0, x2: 4, y2: 4, nowMs: 1000 });
    const claimB = store.createClaim({ ownerName: 'charlie', x1: 10, y1: 10, x2: 12, y2: 12, nowMs: 1000 });

    const updated = store.updateClaim({
        id: claimA.id,
        x1: 1,
        y1: 1,
        x2: 5,
        y2: 5,
        editorNameKeys: ['bob', 'dave', 'BOB'],
        nowMs: 2000,
    });
    expect(updated).toBeTruthy();
    expect(updated?.x1).toBe(1);
    expect(updated?.editorNameKeys).toEqual(['bob', 'dave']);
    expect(updated?.updatedAtMs).toBe(2000);

    const overlapWithoutExclude = store.findFirstOverlappingClaim({ x1: 1, y1: 1, x2: 5, y2: 5 });
    expect(overlapWithoutExclude?.id).toBe(claimA.id);
    const overlapWithExclude = store.findFirstOverlappingClaim({ x1: 1, y1: 1, x2: 5, y2: 5, excludeClaimId: claimA.id });
    expect(overlapWithExclude).toBeNull();
    const overlapWithOther = store.findFirstOverlappingClaim({ x1: 11, y1: 11, x2: 14, y2: 14 });
    expect(overlapWithOther?.id).toBe(claimB.id);
});

test('ClaimsStore isolates claims by map id for identical coordinates', () => {
    const store = new ClaimsStore({ indexChunkSize: 16 });
    const worldClaim = store.createClaim({ mapId: 'world', ownerName: 'alice', x1: 2, y1: 2, x2: 4, y2: 4, nowMs: 1000 });
    const dungeonClaim = store.createClaim({ mapId: 'dungeon_1', ownerName: 'bob', x1: 2, y1: 2, x2: 4, y2: 4, nowMs: 1001 });

    expect(store.getClaimAt(3, 3, 'world')?.id).toBe(worldClaim.id);
    expect(store.getClaimAt(3, 3, 'dungeon_1')?.id).toBe(dungeonClaim.id);
    expect(store.getClaimAt(3, 3, 'unknown')).toBeNull();

    expect(store.findFirstOverlappingClaim({ mapId: 'world', x1: 2, y1: 2, x2: 4, y2: 4 })?.id).toBe(worldClaim.id);
    expect(store.findFirstOverlappingClaim({ mapId: 'dungeon_1', x1: 2, y1: 2, x2: 4, y2: 4 })?.id).toBe(dungeonClaim.id);
});
