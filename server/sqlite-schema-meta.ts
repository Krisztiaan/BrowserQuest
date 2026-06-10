import type { Database } from 'bun:sqlite';

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
