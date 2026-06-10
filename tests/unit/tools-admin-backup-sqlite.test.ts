import { expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { existsSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

type CliResult = ReturnType<typeof spawnSync>;

const REPO_ROOT = path.resolve(import.meta.dir, '..', '..');

function withTempDir<T>(fn: (dir: string) => T): T {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'bq-backup-sqlite-'));
    try {
        return fn(dir);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

function runBackupCli(args: string[]): CliResult {
    return spawnSync(process.execPath, ['run', 'admin:backup-sqlite', '--', ...args], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
    });
}

test('admin:backup-sqlite creates a consistent sqlite snapshot without copying sidecars', () => {
    withTempDir((dir) => {
        const dbPath = path.join(dir, 'source.sqlite');
        const outDir = path.join(dir, 'backup');
        const db = new Database(dbPath, { create: true });
        db.exec(`CREATE TABLE probe (id INTEGER PRIMARY KEY, value TEXT NOT NULL); INSERT INTO probe (value) VALUES ('ok');`);
        db.close();
        writeFileSync(`${dbPath}-wal`, 'wal-bytes');
        writeFileSync(`${dbPath}-shm`, 'shm-bytes');

        const result = runBackupCli(['--db', dbPath, '--out', outDir, '--json']);
        expect(result.status).toBe(0);

        const body = JSON.parse(String(result.stdout)) as {
            ok?: boolean;
            backedUp?: { source?: string; target?: string; bytes?: number };
        };
        expect(body.ok).toBe(true);
        expect(path.basename(String(body.backedUp?.source))).toBe('source.sqlite');
        expect(path.basename(String(body.backedUp?.target))).toBe('source.sqlite');
        expect(body.backedUp?.bytes).toBe(statSync(String(body.backedUp?.target)).size);
        expect(existsSync(path.join(outDir, 'source.sqlite-wal'))).toBe(false);
        expect(existsSync(path.join(outDir, 'source.sqlite-shm'))).toBe(false);

        const backup = new Database(String(body.backedUp?.target), { readonly: true });
        try {
            const row = backup.query(`SELECT value FROM probe WHERE id = 1`).get() as { value?: string } | null;
            expect(row?.value).toBe('ok');
        } finally {
            backup.close();
        }
    });
});
