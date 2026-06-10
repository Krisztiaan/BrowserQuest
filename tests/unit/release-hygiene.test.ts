import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

type CliResult = ReturnType<typeof spawnSync>;

const REPO_ROOT = path.resolve(import.meta.dir, '..', '..');

function withTempDir<T>(fn: (dir: string) => T): T {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'bq-handoff-hygiene-'));
    try {
        return fn(dir);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

function runHygieneCli(root: string): CliResult {
    return spawnSync(process.execPath, ['run', 'check:handoff-hygiene', '--', root], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
    });
}

test('handoff hygiene check passes for a clean directory', () => {
    withTempDir((dir) => {
        mkdirSync(path.join(dir, 'docs'), { recursive: true });
        writeFileSync(path.join(dir, 'docs', 'README.md'), '# Clean handoff\n');

        const result = runHygieneCli(dir);

        expect(result.status).toBe(0);
        expect(result.stdout).toContain('Handoff hygiene check passed.');
        expect(String(result.stderr)).not.toContain('Handoff hygiene check failed:');
    });
});

test('handoff hygiene check rejects local and generated archive artifacts', () => {
    withTempDir((dir) => {
        mkdirSync(path.join(dir, 'server', '.data'), { recursive: true });
        mkdirSync(path.join(dir, 'node_modules'), { recursive: true });
        mkdirSync(path.join(dir, 'dist'), { recursive: true });
        mkdirSync(path.join(dir, 'generated'), { recursive: true });
        mkdirSync(path.join(dir, 'assets', 'maps', 'tiled'), { recursive: true });

        writeFileSync(path.join(dir, '.DS_Store'), '');
        writeFileSync(path.join(dir, 'server', '.data', 'world.sqlite'), '');
        writeFileSync(path.join(dir, 'server', '.data', 'world.sqlite-wal'), '');
        writeFileSync(path.join(dir, 'server', '.data', 'world.sqlite-shm'), '');
        writeFileSync(path.join(dir, 'assets', 'maps', 'tiled', 'world.original.json'), '{}');
        writeFileSync(path.join(dir, 'assets', 'maps', 'tiled', 'world.backup.2026-06-10.json'), '{}');

        const result = runHygieneCli(dir);
        const stderr = String(result.stderr);

        expect(result.status).toBe(1);
        expect(stderr).toContain('Handoff hygiene check failed:');
        expect(stderr).toContain('.DS_Store');
        expect(stderr).toContain('node_modules');
        expect(stderr).toContain('dist');
        expect(stderr).toContain('generated');
        expect(stderr).toContain('server/.data');
        expect(stderr).toContain('assets/maps/tiled/world.original.json');
        expect(stderr).toContain('assets/maps/tiled/world.backup.2026-06-10.json');
    });
});
