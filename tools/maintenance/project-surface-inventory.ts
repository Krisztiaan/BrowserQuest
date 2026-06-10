import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type SurfaceStatus = 'active' | 'legacy' | 'replace' | 'archive' | 'delete' | 'historical';

export type SurfaceEntry = Readonly<{
    path: string;
    kind: 'package_script' | 'content_tool' | 'doc' | 'plan' | 'external_audit' | 'generated_policy';
    name: string;
    status: SurfaceStatus;
    reason: string;
    replacement?: string;
    preserveReason?: string;
}>;

type PackageJson = Readonly<{
    scripts?: Record<string, string>;
}>;

const activeScriptPrefixes = [
    'admin',
    'audit',
    'bench',
    'bots',
    'build',
    'check',
    'dev',
    'format',
    'lint',
    'test',
    'typecheck',
    'verify',
] as const;

const knownReplaceScripts: Readonly<Record<string, string>> = {
    'legacy:check:foreground-layers:dry': 'Phase 2 layer contract replaces broad foreground migration dry-run as the first review surface.',
    'legacy:check:tileset-modernize:dry': 'Phase 2A terrain authoring audit replaces broad tileset modernization dry-run as the first review surface.',
    'legacy:check:world-standardize:dry': 'Phase 2A terrain authoring audit replaces broad standardize dry-run as the first review surface.',
    'legacy:fix:foreground-layers': 'Phase 2 layer contract and Phase 2A authoring repair replace broad foreground migration writes.',
    'legacy:fix:tileset-modernize': 'Phase 2A terrain grammar replaces broad tileset metadata modernization writes.',
    'legacy:fix:tileset-wang:scaffold': 'Phase 2A terrain grammar replaces scaffold-as-authority flow.',
    'legacy:fix:world-portals': 'Phase 2A world-authoring-repair replaces stale portal curation.',
    'legacy:fix:world-standardize': 'Phase 2A safe repair replaces broad standardize writes.',
};

const replacementContentTools: Readonly<Record<string, string>> = {
    'maps-migrate-v-to-foreground.ts': 'shared/maps/layer-contract.ts plus tools/content/world-authoring-repair.ts',
    'tileset-modernize-metadata.ts': 'assets/maps/tiled/terrain-authoring.json plus tools/content/terrain-grammar-validator.ts',
    'tileset-wang-scaffold.ts': 'assets/maps/tiled/terrain-authoring.json plus tools/content/terrain-grammar-validator.ts',
    'world-curate-portals.ts': 'tools/content/world-authoring-repair.ts',
    'world-standardize-idiomatic.ts': 'tools/content/world-authoring-repair.ts',
    'world-standardize-pipeline.ts': 'tools/content/world-authoring-repair.ts',
};

function toRepoPath(filePath: string): string {
    return path.relative(process.cwd(), filePath).split(path.sep).join('/');
}

function classifyPackageScript(name: string, command: string): SurfaceEntry {
    const replacement = knownReplaceScripts[name];
    if (replacement) {
        return {
            path: 'package.json',
            kind: 'package_script',
            name,
            status: 'replace',
            reason: replacement,
            replacement,
        };
    }

    const prefix = name.split(':')[0] ?? name;
    const status: SurfaceStatus = activeScriptPrefixes.includes(prefix as (typeof activeScriptPrefixes)[number])
        ? 'active'
        : 'legacy';
    return {
        path: 'package.json',
        kind: 'package_script',
        name,
        status,
        reason: status === 'active'
            ? `Script is in the active ${prefix} lane: ${command}`
            : `Script is outside the active script prefix set: ${command}`,
    };
}

function classifyContentTool(file: string): SurfaceEntry {
    const basename = path.basename(file);
    const replacement = replacementContentTools[basename];
    if (replacement) {
        return {
            path: file,
            kind: 'content_tool',
            name: basename,
            status: file.includes('/legacy/') ? 'legacy' : 'replace',
            reason: 'Tool is a broad or stale map-authoring migration surface and must not be treated as the current source of truth.',
            replacement,
        };
    }
    return {
        path: file,
        kind: 'content_tool',
        name: basename,
        status: 'active',
        reason: 'No stale classification rule matched; keep until dependency/reference audit proves otherwise.',
    };
}

function classifyDoc(file: string): SurfaceEntry {
    const basename = path.basename(file);
    if (basename.startsWith('audit-') || basename.includes('legacy-parity')) {
        return {
            path: file,
            kind: 'doc',
            name: basename,
            status: 'historical',
            reason: 'Historical audit evidence; preserve but move behind docs archive/index if no longer active guidance.',
            preserveReason: 'Contains dated evidence and decisions useful for regression analysis.',
        };
    }
    return {
        path: file,
        kind: 'doc',
        name: basename,
        status: 'active',
        reason: 'Current documentation candidate; verify through docs index in Ticket 0A.3.',
    };
}

async function listFiles(dir: string, suffix: string): Promise<string[]> {
    const out: string[] = [];

    async function walk(current: string): Promise<void> {
        for (const entry of await readdir(current, { withFileTypes: true })) {
            const absolute = path.join(current, entry.name);
            if (entry.isDirectory()) {
                await walk(absolute);
            } else if (entry.name.endsWith(suffix)) {
                out.push(toRepoPath(absolute));
            }
        }
    }

    try {
        await walk(dir);
    } catch {
        return [];
    }
    return out.sort();
}

export async function buildProjectSurfaceInventory(): Promise<SurfaceEntry[]> {
    const entries: SurfaceEntry[] = [];
    const packageJson = JSON.parse(await readFile('package.json', 'utf8')) as PackageJson;

    for (const [name, command] of Object.entries(packageJson.scripts ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
        entries.push(classifyPackageScript(name, command));
    }
    for (const file of await listFiles('tools/content', '.ts')) {
        entries.push(classifyContentTool(file));
    }
    for (const file of await listFiles('docs', '.md')) {
        entries.push(classifyDoc(file));
    }

    try {
        await readFile('PLAN.md', 'utf8');
        entries.push({
            path: 'PLAN.md',
            kind: 'plan',
            name: 'PLAN.md',
            status: 'active',
            reason: 'Current implementation plan requested by the user.',
        });
    } catch {
        // Optional root plan.
    }

    try {
        await readFile('EXTERNAL-AUDIT.md', 'utf8');
        entries.push({
            path: 'EXTERNAL-AUDIT.md',
            kind: 'external_audit',
            name: 'EXTERNAL-AUDIT.md',
            status: 'archive',
            reason: 'External audit evidence should be imported into docs/audits/ or referenced from PLAN.md, not left as an untracked root file.',
            preserveReason: 'Contains external review findings that may drive implementation tickets.',
        });
    } catch {
        // Optional external audit input.
    }

    entries.push({
        path: 'artifacts/',
        kind: 'generated_policy',
        name: 'artifacts',
        status: 'active',
        reason: 'Generated review artifacts are allowed when deterministic and named by the producing tool.',
    });
    return entries;
}

async function main(): Promise<void> {
    const entries = await buildProjectSurfaceInventory();
    await mkdir('artifacts', { recursive: true });
    await writeFile(
        'artifacts/project-surface-inventory.json',
        `${JSON.stringify({ generatedAt: new Date().toISOString(), entries }, null, 2)}\n`
    );
    console.log(`Project surface inventory entries: ${entries.length}`);
}

if (import.meta.main) {
    await main();
}
