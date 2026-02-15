import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

type CliResult = ReturnType<typeof spawnSync>;

const REPO_ROOT = path.resolve(import.meta.dir, '..', '..');

function withTempDbPath<T>(fn: (dbPath: string) => T): T {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'bq-admin-claims-'));
    const dbPath = path.join(dir, 'claims.sqlite');
    try {
        return fn(dbPath);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

function runClaimsCli(args: string[]): CliResult {
    return spawnSync(process.execPath, ['run', 'admin:claims', '--', ...args], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
    });
}

function parseJsonStdout(result: CliResult): unknown {
    const stdout = typeof result.stdout === 'string' ? result.stdout.trim() : '';
    if (!stdout) {
        throw new Error('Expected JSON stdout from admin:claims command.');
    }
    return JSON.parse(stdout);
}

test('admin:claims create/list expose delegated editors in persisted output', () => {
    withTempDbPath((dbPath) => {
        const create = runClaimsCli([
            'create',
            '--db',
            dbPath,
            '--owner',
            'Alice',
            '--editors',
            'Bob, CAROL,bob',
            '--x1',
            '0',
            '--y1',
            '0',
            '--x2',
            '3',
            '--y2',
            '3',
            '--json',
        ]);
        expect(create.status).toBe(0);
        const createBody = parseJsonStdout(create) as { claim?: { ownerName?: string; editorNameKeys?: string[] } };
        expect(createBody.claim?.ownerName).toBe('alice');
        expect(createBody.claim?.editorNameKeys).toEqual(['bob', 'carol']);

        const list = runClaimsCli(['list', '--db', dbPath, '--json']);
        expect(list.status).toBe(0);
        const listBody = parseJsonStdout(list) as { claims?: Array<{ editorNameKeys?: string[] }> };
        expect(Array.isArray(listBody.claims)).toBe(true);
        expect(listBody.claims?.[0]?.editorNameKeys).toEqual(['bob', 'carol']);
    });
});

test('admin:claims update can replace and clear delegated editors', () => {
    withTempDbPath((dbPath) => {
        const create = runClaimsCli([
            'create',
            '--db',
            dbPath,
            '--owner',
            'alice',
            '--editors',
            'bob',
            '--x1',
            '1',
            '--y1',
            '1',
            '--x2',
            '4',
            '--y2',
            '4',
            '--json',
        ]);
        expect(create.status).toBe(0);

        const update = runClaimsCli(['update', '--db', dbPath, '--id', '1', '--owner', 'Builder', '--editors', 'dave', '--json']);
        expect(update.status).toBe(0);
        const updateBody = parseJsonStdout(update) as { claim?: { ownerName?: string; editorNameKeys?: string[] } };
        expect(updateBody.claim?.ownerName).toBe('builder');
        expect(updateBody.claim?.editorNameKeys).toEqual(['dave']);

        const clearEditors = runClaimsCli(['update', '--db', dbPath, '--id', '1', '--clear-editors', '--json']);
        expect(clearEditors.status).toBe(0);
        const clearBody = parseJsonStdout(clearEditors) as { claim?: { editorNameKeys?: string[] } };
        expect(clearBody.claim?.editorNameKeys).toEqual([]);
    });
});

test('admin:claims update rejects partial rect arguments', () => {
    withTempDbPath((dbPath) => {
        const create = runClaimsCli([
            'create',
            '--db',
            dbPath,
            '--owner',
            'alice',
            '--x1',
            '1',
            '--y1',
            '1',
            '--x2',
            '4',
            '--y2',
            '4',
            '--json',
        ]);
        expect(create.status).toBe(0);

        const update = runClaimsCli(['update', '--db', dbPath, '--id', '1', '--x1', '10']);
        expect(update.status).toBe(2);
        expect(String(update.stderr)).toContain('Rect updates must include all coords');
    });
});
