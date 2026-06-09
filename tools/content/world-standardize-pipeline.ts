import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseCliArgs } from '../shared/cli-args';

type UnknownRecord = Record<string, unknown>;

type StepSummary = Readonly<{
    name: string;
    command: string[];
    durationMs: number;
    status: number;
    parsedJson: unknown;
    stdout: string;
    stderr: string;
}>;

function fail(message: string): never {
    throw new Error(message);
}

function parseCsv(raw: string): string[] {
    return raw
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
}

function maybeParseJson(stdout: string): unknown {
    const trimmed = stdout.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        return null;
    }
    try {
        return JSON.parse(trimmed);
    } catch {
        return null;
    }
}

function runBunStep(name: string, command: string[]): StepSummary {
    const startedAt = Date.now();
    const result = spawnSync('bun', command, { encoding: 'utf8' });
    const durationMs = Date.now() - startedAt;
    const status = result.status ?? 1;
    // spawnSync types stdout/stderr as string, but they are null at runtime when the process fails to spawn.
    const stdout = (result.stdout as string | null) ?? '';
    const stderr = (result.stderr as string | null) ?? '';
    const parsedJson = maybeParseJson(stdout);
    if (status !== 0) {
        const printed = [
            `Step failed: ${name}`,
            `Command: bun ${command.join(' ')}`,
            `Exit code: ${status}`,
            stdout.trim() ? `stdout:\n${stdout.trim()}` : '',
            stderr.trim() ? `stderr:\n${stderr.trim()}` : '',
        ]
            .filter((part) => part.length > 0)
            .join('\n');
        fail(printed);
    }
    return {
        name,
        command,
        durationMs,
        status,
        parsedJson,
        stdout,
        stderr,
    };
}

function timestampSlug(now: Date): string {
    const year = String(now.getFullYear()).padStart(4, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}-${hour}${minute}${second}`;
}

function printUsage(): never {
    console.log(
        'Usage: bun tools/content/world-standardize-pipeline.ts [--map <path>] [--write] [--no-backup] [--skip-void-cull] [--skip-collision-migration] [--skip-idiomatic] [--skip-validate] [--void-tile-id <int>] [--void-also-tile-ids <csv>] [--void-occlusion-depth <int>] [--disable-transparent-soft] [--void-soft-border-min-ratio <float>] [--void-alpha-threshold <int>] [--drop-plateau-mask] [--drop-blocking-mask] [--rename-plateau-mask] [--rename-blocking-mask] [--tilesheet-source <path>] [--mobs-source <path>] [--validate-profiles <csv>]'
    );
    process.exit(0);
}

async function main(): Promise<void> {
    const parsedArgs = parseCliArgs(
        process.argv.slice(2),
        [
            { key: 'map', kind: 'string', defaultValue: 'assets/maps/tiled/world.json' },
            { key: 'write', kind: 'boolean', defaultValue: false },
            { key: 'no-backup', kind: 'boolean', defaultValue: false },
            { key: 'skip-void-cull', kind: 'boolean', defaultValue: false },
            { key: 'skip-collision-migration', kind: 'boolean', defaultValue: false },
            { key: 'skip-idiomatic', kind: 'boolean', defaultValue: false },
            { key: 'skip-validate', kind: 'boolean', defaultValue: false },
            { key: 'void-tile-id', kind: 'number', defaultValue: 3 },
            { key: 'void-also-tile-ids', kind: 'string', defaultValue: '27' },
            { key: 'void-occlusion-depth', kind: 'number', defaultValue: 1 },
            { key: 'disable-transparent-soft', kind: 'boolean', defaultValue: false },
            { key: 'void-soft-border-min-ratio', kind: 'number', defaultValue: 0.15 },
            { key: 'void-alpha-threshold', kind: 'number', defaultValue: 0 },
            { key: 'drop-plateau-mask', kind: 'boolean', defaultValue: false },
            { key: 'drop-blocking-mask', kind: 'boolean', defaultValue: false },
            { key: 'rename-plateau-mask', kind: 'boolean', defaultValue: false },
            { key: 'rename-blocking-mask', kind: 'boolean', defaultValue: false },
            { key: 'tilesheet-source', kind: 'string', defaultValue: 'assets/maps/tiled/tilesheet.wang.tsj' },
            { key: 'mobs-source', kind: 'string', defaultValue: 'assets/maps/tiled/mobs.tsj' },
            { key: 'validate-profiles', kind: 'string', defaultValue: 'legacy,target' },
        ],
        { onHelp: printUsage }
    );

    const mapPathInput = String(parsedArgs.map ?? 'assets/maps/tiled/world.json');
    const mapPathAbs = path.resolve(process.cwd(), mapPathInput);
    const write = Boolean(parsedArgs.write);
    const backupEnabled = write && !parsedArgs['no-backup'];
    const skipVoidCull = Boolean(parsedArgs['skip-void-cull']);
    const skipCollisionMigration = Boolean(parsedArgs['skip-collision-migration']);
    const skipIdiomatic = Boolean(parsedArgs['skip-idiomatic']);
    const skipValidate = Boolean(parsedArgs['skip-validate']);
    const voidTileId = Number(parsedArgs['void-tile-id'] ?? 3);
    const voidAlsoTileIds = String(parsedArgs['void-also-tile-ids'] ?? '27');
    const voidOcclusionDepth = Number(parsedArgs['void-occlusion-depth'] ?? 1);
    const transparentSoftEnabled = !parsedArgs['disable-transparent-soft'];
    const voidSoftBorderMinRatio = Number(parsedArgs['void-soft-border-min-ratio'] ?? 0.15);
    const voidAlphaThreshold = Number(parsedArgs['void-alpha-threshold'] ?? 0);
    const dropPlateauMask = Boolean(parsedArgs['drop-plateau-mask']);
    const dropBlockingMask = Boolean(parsedArgs['drop-blocking-mask']);
    const renamePlateauMask = Boolean(parsedArgs['rename-plateau-mask']);
    const renameBlockingMask = Boolean(parsedArgs['rename-blocking-mask']);
    const tilesheetSource = String(parsedArgs['tilesheet-source'] ?? 'assets/maps/tiled/tilesheet.wang.tsj');
    const mobsSource = String(parsedArgs['mobs-source'] ?? 'assets/maps/tiled/mobs.tsj');
    const validateProfiles = parseCsv(String(parsedArgs['validate-profiles'] ?? 'legacy,target'));

    if (!Number.isInteger(voidTileId) || voidTileId < 0) {
        fail(`--void-tile-id must be a non-negative integer. Received: ${voidTileId}`);
    }
    if (!Number.isInteger(voidOcclusionDepth) || voidOcclusionDepth < 0) {
        fail(`--void-occlusion-depth must be a non-negative integer. Received: ${voidOcclusionDepth}`);
    }
    if (!Number.isInteger(voidAlphaThreshold) || voidAlphaThreshold < 0 || voidAlphaThreshold > 255) {
        fail(`--void-alpha-threshold must be an integer in [0,255]. Received: ${voidAlphaThreshold}`);
    }
    if (!Number.isFinite(voidSoftBorderMinRatio) || voidSoftBorderMinRatio < 0) {
        fail(
            `--void-soft-border-min-ratio must be a non-negative finite number. Received: ${voidSoftBorderMinRatio}`
        );
    }

    let backupPath: string | null = null;
    if (backupEnabled) {
        const parsed = path.parse(mapPathAbs);
        const backupName = `${parsed.name}.backup.${timestampSlug(new Date())}${parsed.ext || '.json'}`;
        backupPath = path.join(parsed.dir, backupName);
        await fs.copyFile(mapPathAbs, backupPath);
    }

    const steps: StepSummary[] = [];

    if (!skipVoidCull) {
        const command = [
            'tools/content/world-null-outside-void.ts',
            '--map',
            mapPathInput,
            '--tile-id',
            String(voidTileId),
            '--also-tile-ids',
            voidAlsoTileIds,
            '--occlusion-depth',
            String(voidOcclusionDepth),
        ];
        if (transparentSoftEnabled) {
            command.push(
                '--enable-transparent-soft',
                '--soft-border-min-ratio',
                String(voidSoftBorderMinRatio),
                '--alpha-threshold',
                String(voidAlphaThreshold)
            );
        }
        if (write) {
            command.push('--write');
        }
        steps.push(runBunStep('void-cull', command));
    }

    if (!skipCollisionMigration) {
        const command = [
            'tools/content/tileset-migrate-c-to-objectgroup.ts',
            '--files',
            `${tilesheetSource},${mapPathInput}`,
        ];
        if (write) {
            command.push('--write');
        }
        steps.push(runBunStep('tileset-collision-migration', command));
    }

    if (!skipIdiomatic) {
        const command = [
            'tools/content/world-standardize-idiomatic.ts',
            '--map',
            mapPathInput,
            '--tilesheet-source',
            tilesheetSource,
            '--mobs-source',
            mobsSource,
        ];
        if (dropBlockingMask) {
            command.push('--drop-blocking-mask');
        }
        if (dropPlateauMask) {
            command.push('--drop-plateau-mask');
        }
        if (renamePlateauMask) {
            command.push('--rename-plateau-mask');
        }
        if (renameBlockingMask) {
            command.push('--rename-blocking-mask');
        }
        if (write) {
            command.push('--write');
        }
        steps.push(runBunStep('idiomatic-standardize', command));
    }

    if (!skipValidate) {
        for (const profile of validateProfiles) {
            const command = [
                'tools/content/world-map-validator.ts',
                '--map',
                mapPathInput,
                '--profile',
                profile,
                '--json',
            ];
            steps.push(runBunStep(`validate:${profile}`, command));
        }
    }

    const summary: UnknownRecord = {
        map: mapPathInput,
        mapAbsolute: mapPathAbs,
        write,
        backupPath,
        options: {
            skipVoidCull,
            skipCollisionMigration,
            skipIdiomatic,
            skipValidate,
            voidTileId,
            voidAlsoTileIds,
            voidOcclusionDepth,
            transparentSoftEnabled,
            voidSoftBorderMinRatio,
            voidAlphaThreshold,
            dropPlateauMask,
            dropBlockingMask,
            renamePlateauMask,
            renameBlockingMask,
            tilesheetSource,
            mobsSource,
            validateProfiles,
        },
        steps: steps.map((step) => ({
            name: step.name,
            command: ['bun', ...step.command].join(' '),
            durationMs: step.durationMs,
            status: step.status,
            parsedJson: step.parsedJson,
        })),
    };

    console.log(JSON.stringify(summary, null, 2));
}

void main();
