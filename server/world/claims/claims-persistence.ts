import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { RectClaim } from './claims-store';
import { normalizeIdentityKeyOrNull } from '../../identity';

const DEFAULT_CLAIMS_DB_PATH = './server/.data/claims.sqlite';

function resolveDatabasePath(configuredPath: string | null | undefined): string {
    const trimmed = typeof configuredPath === 'string' ? configuredPath.trim() : '';
    if (!trimmed) {
        return path.resolve(DEFAULT_CLAIMS_DB_PATH);
    }
    if (trimmed === ':memory:') {
        return trimmed;
    }
    return path.resolve(trimmed);
}

type ClaimRow = {
    id: number;
    map_id: string;
    owner_name: string;
    editors_json: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    created_at: number;
    updated_at: number;
};
type JsonScalar = string | number | boolean | null;
type JsonValue = JsonScalar | JsonValue[] | { [key: string]: JsonValue };

export class SqliteClaimsPersistence {
    readonly databasePath: string;
    readonly #db: Database;
    readonly #upsertClaim: ReturnType<Database['prepare']>;
    readonly #deleteClaim: ReturnType<Database['prepare']>;
    readonly #selectAll: ReturnType<Database['prepare']>;

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

            CREATE TABLE IF NOT EXISTS claims (
                id INTEGER PRIMARY KEY,
                map_id TEXT NOT NULL DEFAULT 'world_01',
                owner_name TEXT NOT NULL,
                editors_json TEXT NOT NULL DEFAULT '[]',
                x1 INTEGER NOT NULL,
                y1 INTEGER NOT NULL,
                x2 INTEGER NOT NULL,
                y2 INTEGER NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS claims_owner_name ON claims(owner_name);
        `);

        const claimColumns = this.#db.query("PRAGMA table_info('claims')").all() as Array<{ name?: string }>;
        const hasMapId = claimColumns.some((column) => column.name === 'map_id');
        if (!hasMapId) {
            this.#db.exec(`ALTER TABLE claims ADD COLUMN map_id TEXT NOT NULL DEFAULT 'world_01'`);
        }
        this.#db.exec(`CREATE INDEX IF NOT EXISTS claims_map_id ON claims(map_id)`);

        this.#upsertClaim = this.#db.prepare(`
            INSERT INTO claims
                (id, map_id, owner_name, editors_json, x1, y1, x2, y2, created_at, updated_at)
            VALUES
                (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
            ON CONFLICT(id) DO UPDATE SET
                map_id = excluded.map_id,
                owner_name = excluded.owner_name,
                editors_json = excluded.editors_json,
                x1 = excluded.x1,
                y1 = excluded.y1,
                x2 = excluded.x2,
                y2 = excluded.y2,
                updated_at = excluded.updated_at
        `);

        this.#deleteClaim = this.#db.prepare(`DELETE FROM claims WHERE id = ?1`);
        this.#selectAll = this.#db.prepare(`
            SELECT id, map_id, owner_name, editors_json, x1, y1, x2, y2, created_at, updated_at
            FROM claims
            ORDER BY id ASC
        `);
    }

    close(): void {
        this.#db.close();
    }

    upsertClaim(claim: RectClaim, nowMs = Date.now()): void {
        const updatedAt = Math.floor(nowMs);
        this.#upsertClaim.run(
            claim.id,
            claim.mapId,
            claim.ownerName,
            JSON.stringify(claim.editorNameKeys.slice()),
            claim.x1,
            claim.y1,
            claim.x2,
            claim.y2,
            claim.createdAtMs,
            updatedAt
        );
    }

    deleteClaim(id: number): void {
        this.#deleteClaim.run(id);
    }

    loadAllClaims(): RectClaim[] {
        const rows = this.#selectAll.all() as ClaimRow[];
        return rows.map((row) =>
            Object.freeze({
                id: row.id,
                mapId: typeof row.map_id === 'string' && row.map_id.trim().length > 0 ? row.map_id : 'world_01',
                ownerName: row.owner_name,
                editorNameKeys: decodeEditorNameKeys(row.editors_json),
                x1: row.x1,
                y1: row.y1,
                x2: row.x2,
                y2: row.y2,
                createdAtMs: row.created_at,
                updatedAtMs: row.updated_at,
            })
        );
    }
}

function decodeEditorNameKeys(editorsJson: string | number | boolean | null | undefined | object): string[] {
    if (typeof editorsJson !== 'string' || editorsJson.trim().length === 0) {
        return [];
    }
    let parsed: JsonValue;
    try {
        parsed = JSON.parse(editorsJson) as JsonValue;
    } catch {
        return [];
    }
    if (!Array.isArray(parsed)) {
        return [];
    }
    const deduped = new Set<string>();
    for (let i = 0; i < parsed.length; i += 1) {
        const raw = parsed[i];
        if (typeof raw !== 'string') {
            continue;
        }
        const normalized = normalizeIdentityKeyOrNull(raw);
        if (!normalized) {
            continue;
        }
        deduped.add(normalized);
    }
    return [...deduped];
}
