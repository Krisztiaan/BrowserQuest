import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Database } from 'bun:sqlite';
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

test('SqliteClaimsPersistence migrates legacy claims schema without editors_json', () => {
    withTempDbPath((dbPath) => {
        const db = new Database(dbPath, { create: true });
        db.exec(`
            CREATE TABLE claims (
                id INTEGER PRIMARY KEY,
                owner_name TEXT NOT NULL,
                x1 INTEGER NOT NULL,
                y1 INTEGER NOT NULL,
                x2 INTEGER NOT NULL,
                y2 INTEGER NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
            INSERT INTO claims (id, owner_name, x1, y1, x2, y2, created_at, updated_at)
            VALUES (1, 'alice', 0, 0, 1, 1, 1000, 1000);
        `);
        db.close();

        const persistence = new SqliteClaimsPersistence(dbPath);
        const claims = persistence.loadAllClaims();
        persistence.close();

        expect(claims.length).toBe(1);
        expect(claims[0]?.ownerName).toBe('alice');
        expect(claims[0]?.editorNameKeys).toEqual([]);
    });
});
