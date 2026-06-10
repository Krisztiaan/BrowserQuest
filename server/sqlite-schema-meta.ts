import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

export function ensureSchemaVersion(db: Database, version: number): void {
    db.exec(`
        CREATE TABLE IF NOT EXISTS schema_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    `);

    const existing = db.query(`SELECT value FROM schema_meta WHERE key = 'schema_version'`).get() as { value?: string } | null;
    if (!existing) {
        db.query(`INSERT INTO schema_meta (key, value) VALUES ('schema_version', ?1)`).run(String(version));
    }
}

export function resolveSqliteDatabasePath(configuredPath: string | null | undefined, defaultPath: string): string {
    const trimmed = typeof configuredPath === 'string' ? configuredPath.trim() : '';
    if (!trimmed) {
        return path.resolve(defaultPath);
    }
    if (trimmed === ':memory:') {
        return trimmed;
    }
    return path.resolve(trimmed);
}

export function openSqliteDatabase({
    configuredPath,
    defaultPath,
    schemaVersion,
    ddl,
    wal = true,
}: {
    configuredPath: string | null | undefined;
    defaultPath: string;
    schemaVersion: number;
    ddl: string;
    wal?: boolean;
}): { databasePath: string; db: Database } {
    const databasePath = resolveSqliteDatabasePath(configuredPath, defaultPath);
    if (databasePath !== ':memory:') {
        mkdirSync(path.dirname(databasePath), { recursive: true });
    }

    const db = new Database(databasePath, { create: true });
    db.exec(`
        ${wal ? 'PRAGMA journal_mode=WAL;' : ''}
        PRAGMA synchronous=NORMAL;
        PRAGMA foreign_keys=ON;
    `);
    ensureSchemaVersion(db, schemaVersion);
    if (ddl.trim().length > 0) {
        db.exec(ddl);
    }
    return { databasePath, db };
}
