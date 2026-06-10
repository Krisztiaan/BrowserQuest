import { expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
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

test('admin:backup-sqlite copies sqlite db and sidecar files with verified sizes', () => {
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
            copied?: Array<{ source?: string; target?: string; bytes?: number }>;
        };
        expect(body.ok).toBe(true);
        expect(body.copied?.map((entry) => path.basename(String(entry.source)))).toEqual([
            'source.sqlite',
            'source.sqlite-wal',
            'source.sqlite-shm',
        ]);

        for (const entry of body.copied ?? []) {
            expect(entry.target).toBeTruthy();
            expect(entry.bytes).toBe(statSync(String(entry.source)).size);
            expect(statSync(String(entry.target)).size).toBe(entry.bytes);
        }
    });
});
