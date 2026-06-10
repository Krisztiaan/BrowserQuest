import { Database } from 'bun:sqlite';
import { mkdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { parseCliArgs } from '../shared/cli-args';

type BackupFile = {
    source: string;
    target: string;
    bytes: number;
};

function sqlString(value: string): string {
    return `'${value.replace(/'/g, "''")}'`;
}

function usage(): never {
    console.log('Usage: bun run admin:backup-sqlite -- --db <path> --out <dir> [--json]');
    process.exit(0);
}

const args = parseCliArgs(
    process.argv.slice(2),
    [
        { key: 'db', kind: 'string' },
        { key: 'out', kind: 'string' },
        { key: 'json', kind: 'boolean', defaultValue: false },
    ],
    { onHelp: usage }
);

const dbPath = String(args.db ?? '').trim();
const outDir = String(args.out ?? '').trim();
if (!dbPath || !outDir) {
    throw new Error('Usage: bun run admin:backup-sqlite -- --db <path> --out <dir> [--json]');
}

await mkdir(outDir, { recursive: true });

const sourceStat = await stat(dbPath).catch(() => null);
if (!sourceStat?.isFile()) {
    throw new Error(`No SQLite database found for ${dbPath}`);
}

const target = path.join(outDir, path.basename(dbPath));
await unlink(target).catch((error: unknown) => {
    if ((error as { code?: unknown }).code !== 'ENOENT') {
        throw error;
    }
});

const db = new Database(dbPath, { readonly: true });
try {
    db.exec(`VACUUM INTO ${sqlString(target)}`);
} finally {
    db.close();
}

const targetStat = await stat(target);
const backedUp: BackupFile = { source: dbPath, target, bytes: targetStat.size };

if (args.json) {
    console.log(JSON.stringify({ ok: true, backedUp }, null, 2));
} else {
    console.log(`${backedUp.source} -> ${backedUp.target} (${backedUp.bytes} bytes)`);
}
