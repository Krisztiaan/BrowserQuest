import { SqliteClaimsPersistence } from '../../server/world/claims/claims-persistence';
import { ClaimsStore } from '../../server/world/claims/claims-store';
import { parseCliArgs } from '../shared/cli-args';

function printUsageAndExit(code: number): never {
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
            console.log(JSON.stringify({ dbPath: persistence.databasePath, claims }, null, 2));
            return;
        }

        console.log(`db: ${persistence.databasePath}`);
        if (claims.length === 0) {
            console.log('(no claims)');
            return;
        }
        for (const claim of claims) {
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
            console.log(JSON.stringify({ dbPath: persistence.databasePath, claim }, null, 2));
            return;
        }
        console.log(`db: ${persistence.databasePath}`);
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
                console.log(JSON.stringify({ dbPath: persistence.databasePath, updated: false, id }, null, 2));
                process.exit(1);
            }
            console.error(`db: ${persistence.databasePath}`);
            console.error(`claim #${id} not found`);
            process.exit(1);
        }

        persistence.upsertClaim(updated);
        if (json) {
            console.log(JSON.stringify({ dbPath: persistence.databasePath, claim: updated }, null, 2));
            return;
        }
        console.log(`db: ${persistence.databasePath}`);
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
                console.log(JSON.stringify({ dbPath: persistence.databasePath, deleted: false, id }, null, 2));
                process.exit(1);
            }
            console.error(`db: ${persistence.databasePath}`);
            console.error(`claim #${id} not found`);
            process.exit(1);
        }
        persistence.deleteClaim(id);
        if (json) {
            console.log(JSON.stringify({ dbPath: persistence.databasePath, deleted: true, id }, null, 2));
            return;
        }
        console.log(`db: ${persistence.databasePath}`);
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
        const parsed = parseCliArgs(
            rest,
            [
                { key: 'world', kind: 'string', defaultValue: 'world1' },
                { key: 'db', kind: 'string' },
                { key: 'json', kind: 'boolean', defaultValue: false },
            ],
            { onHelp: () => printUsageAndExit(0) }
        );
        const worldIdRaw = typeof parsed.world === 'string' ? parsed.world.trim() : 'world1';
        const worldId = worldIdRaw.length > 0 ? worldIdRaw : 'world1';
        const dbPathRaw = typeof parsed.db === 'string' ? parsed.db.trim() : null;
        const dbPath = resolveClaimsDbPath({ dbPath: dbPathRaw && dbPathRaw.length > 0 ? dbPathRaw : null, worldId });
        runList({ dbPath, json: Boolean(parsed.json) });
    } else if (cmd === 'create') {
        const parsed = parseCliArgs(
            rest,
            [
                { key: 'world', kind: 'string', defaultValue: 'world1' },
                { key: 'db', kind: 'string' },
                { key: 'json', kind: 'boolean', defaultValue: false },
                { key: 'owner', kind: 'string' },
                { key: 'editors', kind: 'string' },
                { key: 'x1', kind: 'number' },
                { key: 'y1', kind: 'number' },
                { key: 'x2', kind: 'number' },
                { key: 'y2', kind: 'number' },
            ],
            { onHelp: () => printUsageAndExit(0) }
        );
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
        const parsed = parseCliArgs(
            rest,
            [
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
            ],
            { onHelp: () => printUsageAndExit(0) }
        );
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
        const editorNameKeys = hasEditorsArg
            ? parseEditorsList(parsed.editors as string)
            : clearEditors
              ? []
              : undefined;

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
        const parsed = parseCliArgs(
            rest,
            [
                { key: 'world', kind: 'string', defaultValue: 'world1' },
                { key: 'db', kind: 'string' },
                { key: 'json', kind: 'boolean', defaultValue: false },
                { key: 'id', kind: 'number' },
            ],
            { onHelp: () => printUsageAndExit(0) }
        );
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
    console.error(String(err));
    printUsageAndExit(2);
}
