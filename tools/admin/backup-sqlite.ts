import { copyFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { parseCliArgs } from '../shared/cli-args';

type CopiedFile = {
    source: string;
    target: string;
    bytes: number;
};

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

const copied: CopiedFile[] = [];
for (const suffix of ['', '-wal', '-shm']) {
    const source = `${dbPath}${suffix}`;
    const sourceStat = await stat(source).catch(() => null);
    if (!sourceStat?.isFile()) {
        continue;
    }

    const target = path.join(outDir, path.basename(source));
    await copyFile(source, target);

    const targetStat = await stat(target);
    if (targetStat.size !== sourceStat.size) {
        throw new Error(`Backup size mismatch for ${source}: ${sourceStat.size} !== ${targetStat.size}`);
    }
    copied.push({ source, target, bytes: targetStat.size });
}

if (copied.length === 0) {
    throw new Error(`No SQLite files found for ${dbPath}`);
}

if (args.json) {
    console.log(JSON.stringify({ ok: true, copied }, null, 2));
} else {
    for (const entry of copied) {
        console.log(`${entry.source} -> ${entry.target} (${entry.bytes} bytes)`);
    }
}
