import { SqliteClaimsPersistence } from '../../server/world/claims/claims-persistence';
import { ClaimsStore } from '../../server/world/claims/claims-store';

type ArgSpec = Readonly<{
    key: string;
    kind: 'string' | 'number' | 'boolean';
    defaultValue?: string | number | boolean;
}>;

function printUsageAndExit(code: number): never {
    // eslint-disable-next-line no-console
    console.error(
        [
            'Usage: bun run admin:claims -- <command> [options]',
            '',
            'Commands:',
            '  list',
            '  create',
            '  update',
            '  delete',
            '',
            'Global options:',
            '  --world WORLD_ID         world id (default: world1)',
            '  --db PATH                explicit SQLite DB path (overrides --world)',
            '  --json                   output JSON (default: false)',
            '',
            'Create options:',
            '  --owner NAME             claim owner name (required)',
            '  --editors N1,N2          delegated editor account keys (optional)',
            '  --x1 N --y1 N --x2 N --y2 N  rect bounds (required, ints)',
            '',
            'Update options:',
            '  --id N                   claim id (required)',
            '  --owner NAME             replace owner name (optional)',
            '  --editors N1,N2          replace delegated editors list (optional)',
            '  --clear-editors          clear delegated editors list',
            '  --x1 N --y1 N --x2 N --y2 N  replace rect bounds (optional, all-or-none)',
            '',
            'Delete options:',
            '  --id N                   claim id (required)',
        ].join('\n')
    );
    process.exit(code);
}

function toNumber(value: string, flag: string): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        throw new Error(`Invalid ${flag}: ${value}`);
    }
    return parsed;
}

function parseArgs(argv: string[], specs: ReadonlyArray<ArgSpec>): Record<string, string | number | boolean> {
    const out: Record<string, string | number | boolean> = {};
    for (const spec of specs) {
        if (spec.defaultValue !== undefined) {
            out[spec.key] = spec.defaultValue;
        }
    }

    for (let i = 0; i < argv.length; i += 1) {
        const raw = argv[i] ?? '';
        if (raw === '--help' || raw === '-h') {
            printUsageAndExit(0);
        }
        if (!raw.startsWith('--')) {
            throw new Error(`Unknown argument: ${raw}`);
        }
        const key = raw.slice(2);
        const spec = specs.find((s) => s.key === key);
        if (!spec) {
            throw new Error(`Unknown flag: --${key}`);
        }
        if (spec.kind === 'boolean') {
            out[key] = true;
            continue;
        }
        const next = argv[i + 1];
        if (typeof next !== 'string' || next.startsWith('--')) {
            throw new Error(`Missing value for --${key}`);
        }
        i += 1;
        out[key] = spec.kind === 'number' ? toNumber(next, `--${key}`) : next;
    }

    return out;
}

function fail(message: string): never {
    throw new Error(message);
}

function parseEditorsList(rawEditors: string | null | undefined): string[] {
    const trimmed = typeof rawEditors === 'string' ? rawEditors.trim() : '';
    if (trimmed.length === 0) {
        return [];
    }
    const deduped = new Set<string>();
    for (const rawEntry of trimmed.split(',')) {
        const normalized = rawEntry.trim().toLowerCase();
        if (normalized.length === 0) {
            continue;
        }
        deduped.add(normalized);
    }
    return [...deduped];
}

function resolveClaimsDbPath({ dbPath, worldId }: { dbPath: string | null; worldId: string }): string {
    if (typeof dbPath === 'string' && dbPath.trim().length > 0) {
        return dbPath.trim();
    }
    return `./server/.data/claims.${worldId}.sqlite`;
}

function openPersistence(dbPath: string): SqliteClaimsPersistence {
    return new SqliteClaimsPersistence(dbPath);
}

function runList({ dbPath, json }: { dbPath: string; json: boolean }): void {
    const persistence = openPersistence(dbPath);
    try {
        const claims = persistence.loadAllClaims();
        if (json) {
            // eslint-disable-next-line no-console
            console.log(JSON.stringify({ dbPath: persistence.databasePath, claims }, null, 2));
            return;
        }

        // eslint-disable-next-line no-console
        console.log(`db: ${persistence.databasePath}`);
        if (claims.length === 0) {
            // eslint-disable-next-line no-console
            console.log('(no claims)');
            return;
        }
        for (const claim of claims) {
            // eslint-disable-next-line no-console
            console.log(
                `#${claim.id} owner=${claim.ownerName} editors=${claim.editorNameKeys.join(',') || '-'} rect=(${claim.x1},${claim.y1})..(${claim.x2},${claim.y2}) updatedAtMs=${claim.updatedAtMs}`
            );
        }
    } finally {
        persistence.close();
    }
}

function runCreate({
    dbPath,
    json,
    ownerName,
    editorNameKeys,
    x1,
    y1,
    x2,
    y2,
}: {
    dbPath: string;
    json: boolean;
    ownerName: string;
    editorNameKeys: ReadonlyArray<string>;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}): void {
    const persistence = openPersistence(dbPath);
    try {
        const store = new ClaimsStore();
        store.loadClaims(persistence.loadAllClaims());
        const claim = store.createClaim({ ownerName, editorNameKeys, x1, y1, x2, y2 });
        persistence.upsertClaim(claim);
        if (json) {
            // eslint-disable-next-line no-console
            console.log(JSON.stringify({ dbPath: persistence.databasePath, claim }, null, 2));
            return;
        }
        // eslint-disable-next-line no-console
        console.log(`db: ${persistence.databasePath}`);
        // eslint-disable-next-line no-console
        console.log(`created claim #${claim.id}`);
    } finally {
        persistence.close();
    }
}

function runUpdate({
    dbPath,
    json,
    id,
    ownerName,
    editorNameKeys,
    x1,
    y1,
    x2,
    y2,
}: {
    dbPath: string;
    json: boolean;
    id: number;
    ownerName?: string;
    editorNameKeys?: ReadonlyArray<string>;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
}): void {
    const persistence = openPersistence(dbPath);
    try {
        const store = new ClaimsStore();
        store.loadClaims(persistence.loadAllClaims());
        const updated = store.updateClaim({
            id,
            ownerName,
            editorNameKeys,
            x1,
            y1,
            x2,
            y2,
        });
        if (!updated) {
            if (json) {
                // eslint-disable-next-line no-console
                console.log(JSON.stringify({ dbPath: persistence.databasePath, updated: false, id }, null, 2));
                process.exit(1);
            }
            // eslint-disable-next-line no-console
            console.error(`db: ${persistence.databasePath}`);
            // eslint-disable-next-line no-console
            console.error(`claim #${id} not found`);
            process.exit(1);
        }

        persistence.upsertClaim(updated);
        if (json) {
            // eslint-disable-next-line no-console
            console.log(JSON.stringify({ dbPath: persistence.databasePath, claim: updated }, null, 2));
            return;
        }
        // eslint-disable-next-line no-console
        console.log(`db: ${persistence.databasePath}`);
        // eslint-disable-next-line no-console
        console.log(`updated claim #${updated.id}`);
    } finally {
        persistence.close();
    }
}

function runDelete({ dbPath, json, id }: { dbPath: string; json: boolean; id: number }): void {
    const persistence = openPersistence(dbPath);
    try {
        const existing = persistence.loadAllClaims().some((claim) => claim.id === id);
        if (!existing) {
            if (json) {
                // eslint-disable-next-line no-console
                console.log(JSON.stringify({ dbPath: persistence.databasePath, deleted: false, id }, null, 2));
                process.exit(1);
            }
            // eslint-disable-next-line no-console
            console.error(`db: ${persistence.databasePath}`);
            // eslint-disable-next-line no-console
            console.error(`claim #${id} not found`);
            process.exit(1);
        }
        persistence.deleteClaim(id);
        if (json) {
            // eslint-disable-next-line no-console
            console.log(JSON.stringify({ dbPath: persistence.databasePath, deleted: true, id }, null, 2));
            return;
        }
        // eslint-disable-next-line no-console
        console.log(`db: ${persistence.databasePath}`);
        // eslint-disable-next-line no-console
        console.log(`deleted claim #${id}`);
    } finally {
        persistence.close();
    }
}

const argv = process.argv.slice(2);
const cmd = argv[0] ?? '';
const rest = argv.slice(1);

if (cmd === '' || cmd === '--help' || cmd === '-h') {
    printUsageAndExit(0);
}

try {
    if (cmd === 'list') {
        const parsed = parseArgs(rest, [
            { key: 'world', kind: 'string', defaultValue: 'world1' },
            { key: 'db', kind: 'string' },
            { key: 'json', kind: 'boolean', defaultValue: false },
        ]);
        const worldIdRaw = typeof parsed.world === 'string' ? parsed.world.trim() : 'world1';
        const worldId = worldIdRaw.length > 0 ? worldIdRaw : 'world1';
        const dbPathRaw = typeof parsed.db === 'string' ? parsed.db.trim() : null;
        const dbPath = resolveClaimsDbPath({ dbPath: dbPathRaw && dbPathRaw.length > 0 ? dbPathRaw : null, worldId });
        runList({ dbPath, json: Boolean(parsed.json) });
    } else if (cmd === 'create') {
        const parsed = parseArgs(rest, [
            { key: 'world', kind: 'string', defaultValue: 'world1' },
            { key: 'db', kind: 'string' },
            { key: 'json', kind: 'boolean', defaultValue: false },
            { key: 'owner', kind: 'string' },
            { key: 'editors', kind: 'string' },
            { key: 'x1', kind: 'number' },
            { key: 'y1', kind: 'number' },
            { key: 'x2', kind: 'number' },
            { key: 'y2', kind: 'number' },
        ]);
        const owner = typeof parsed.owner === 'string' ? parsed.owner.trim() : '';
        if (!owner) {
            fail('Missing --owner');
        }
        const editorsRaw = typeof parsed.editors === 'string' ? parsed.editors : null;
        const editorNameKeys = parseEditorsList(editorsRaw);
        const coords = ['x1', 'y1', 'x2', 'y2'].map((k) => parsed[k]);
        if (!coords.every((v) => typeof v === 'number' && Number.isInteger(v))) {
            fail('Missing or invalid rect coords (--x1/--y1/--x2/--y2 must be integers).');
        }
        const worldIdRaw = typeof parsed.world === 'string' ? parsed.world.trim() : 'world1';
        const worldId = worldIdRaw.length > 0 ? worldIdRaw : 'world1';
        const dbPathRaw = typeof parsed.db === 'string' ? parsed.db.trim() : null;
        const dbPath = resolveClaimsDbPath({ dbPath: dbPathRaw && dbPathRaw.length > 0 ? dbPathRaw : null, worldId });
        runCreate({
            dbPath,
            json: Boolean(parsed.json),
            ownerName: owner,
            editorNameKeys,
            x1: coords[0] as number,
            y1: coords[1] as number,
            x2: coords[2] as number,
            y2: coords[3] as number,
        });
    } else if (cmd === 'update') {
        const parsed = parseArgs(rest, [
            { key: 'world', kind: 'string', defaultValue: 'world1' },
            { key: 'db', kind: 'string' },
            { key: 'json', kind: 'boolean', defaultValue: false },
            { key: 'id', kind: 'number' },
            { key: 'owner', kind: 'string' },
            { key: 'editors', kind: 'string' },
            { key: 'clear-editors', kind: 'boolean', defaultValue: false },
            { key: 'x1', kind: 'number' },
            { key: 'y1', kind: 'number' },
            { key: 'x2', kind: 'number' },
            { key: 'y2', kind: 'number' },
        ]);
        const idRaw = parsed.id;
        if (typeof idRaw !== 'number' || !Number.isInteger(idRaw) || idRaw <= 0) {
            fail('Missing/invalid --id');
        }

        const ownerRaw = typeof parsed.owner === 'string' ? parsed.owner.trim() : undefined;
        const ownerName = ownerRaw && ownerRaw.length > 0 ? ownerRaw : undefined;
        const clearEditors = Boolean(parsed['clear-editors']);
        const hasEditorsArg = typeof parsed.editors === 'string';
        if (clearEditors && hasEditorsArg) {
            fail('Use either --editors or --clear-editors, not both.');
        }
        const hasEditors = clearEditors || hasEditorsArg;
        const editorNameKeys = hasEditorsArg ? parseEditorsList(parsed.editors as string) : clearEditors ? [] : undefined;

        const hasX1 = typeof parsed.x1 === 'number';
        const hasY1 = typeof parsed.y1 === 'number';
        const hasX2 = typeof parsed.x2 === 'number';
        const hasY2 = typeof parsed.y2 === 'number';
        const hasAnyRect = hasX1 || hasY1 || hasX2 || hasY2;
        if (hasAnyRect && !(hasX1 && hasY1 && hasX2 && hasY2)) {
            fail('Rect updates must include all coords (--x1/--y1/--x2/--y2).');
        }
        if (hasAnyRect && ![parsed.x1, parsed.y1, parsed.x2, parsed.y2].every((value) => Number.isInteger(value))) {
            fail('Invalid rect coords (--x1/--y1/--x2/--y2 must be integers).');
        }
        if (!ownerName && !hasEditors && !hasAnyRect) {
            fail('Missing update fields (--owner and/or --editors/--clear-editors and/or rect coords).');
        }

        const worldIdRaw = typeof parsed.world === 'string' ? parsed.world.trim() : 'world1';
        const worldId = worldIdRaw.length > 0 ? worldIdRaw : 'world1';
        const dbPathRaw = typeof parsed.db === 'string' ? parsed.db.trim() : null;
        const dbPath = resolveClaimsDbPath({ dbPath: dbPathRaw && dbPathRaw.length > 0 ? dbPathRaw : null, worldId });
        runUpdate({
            dbPath,
            json: Boolean(parsed.json),
            id: idRaw,
            ownerName,
            editorNameKeys,
            x1: hasAnyRect ? (parsed.x1 as number) : undefined,
            y1: hasAnyRect ? (parsed.y1 as number) : undefined,
            x2: hasAnyRect ? (parsed.x2 as number) : undefined,
            y2: hasAnyRect ? (parsed.y2 as number) : undefined,
        });
    } else if (cmd === 'delete') {
        const parsed = parseArgs(rest, [
            { key: 'world', kind: 'string', defaultValue: 'world1' },
            { key: 'db', kind: 'string' },
            { key: 'json', kind: 'boolean', defaultValue: false },
            { key: 'id', kind: 'number' },
        ]);
        const idRaw = parsed.id;
        if (typeof idRaw !== 'number' || !Number.isInteger(idRaw) || idRaw <= 0) {
            fail('Missing/invalid --id');
        }
        const worldIdRaw = typeof parsed.world === 'string' ? parsed.world.trim() : 'world1';
        const worldId = worldIdRaw.length > 0 ? worldIdRaw : 'world1';
        const dbPathRaw = typeof parsed.db === 'string' ? parsed.db.trim() : null;
        const dbPath = resolveClaimsDbPath({ dbPath: dbPathRaw && dbPathRaw.length > 0 ? dbPathRaw : null, worldId });
        runDelete({ dbPath, json: Boolean(parsed.json), id: idRaw });
    } else {
        fail(`Unknown command: ${cmd}`);
    }
} catch (err) {
    // eslint-disable-next-line no-console
    console.error(String(err));
    printUsageAndExit(2);
}
