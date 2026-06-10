import fs from 'node:fs/promises';
import path from 'node:path';
import { copyPathIfExists } from '../shared/fs-helpers';

const repoRoot = path.resolve(import.meta.dir, '..', '..');
const outputRoot = path.join(repoRoot, '.tmp', 'dev-client');
const outputClientRoot = path.join(outputRoot, 'client');

async function copyIntoOutput(sourceRelativePath: string, destinationRelativePath = sourceRelativePath): Promise<void> {
    const sourcePath = path.join(repoRoot, sourceRelativePath);
    const destinationPath = path.join(outputRoot, destinationRelativePath);
    await copyPathIfExists(sourcePath, destinationPath);
}

function ensureBuildSucceeded(result: Bun.BuildOutput): void {
    if (result.success) {
        return;
    }

    const errors = result.logs
        .filter((entry) => entry.level === 'error')
        .map((entry) => entry.message)
        .join('\n');
    throw new Error(errors.length > 0 ? errors : 'client build failed');
}

async function writeDevIndexHtml(): Promise<void> {
    const sourcePath = path.join(repoRoot, 'index.html');
    const outputPath = path.join(outputRoot, 'index.html');
    const source = await fs.readFile(sourcePath, 'utf8');

    const workerBootstrap = "<script>window.__BQ_MAP_WORKER_URL__ = '/client/mapworker.js';</script>";
    const withWorkerOverride = source.replace(
        '<script type="module" src="/client/preflight.ts"></script>',
        `${workerBootstrap}\n        <script type="module" src="/client/preflight.ts"></script>`
    );

    const builtEntryHtml = withWorkerOverride
        .replace('/client/preflight.ts', '/client/preflight.js')
        .replace('/client/home.ts', '/client/home.js');

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, builtEntryHtml, 'utf8');
}

async function main(): Promise<void> {
    await fs.rm(outputRoot, { recursive: true, force: true });
    await fs.mkdir(outputClientRoot, { recursive: true });

    const result = await Bun.build({
        entrypoints: [
            path.join(repoRoot, 'client', 'preflight.ts'),
            path.join(repoRoot, 'client', 'home.ts'),
            path.join(repoRoot, 'client', 'mapworker.ts'),
        ],
        outdir: outputClientRoot,
        target: 'browser',
        format: 'esm',
        splitting: false,
        minify: false,
        sourcemap: 'none',
    });
    ensureBuildSucceeded(result);

    await copyIntoOutput('client/public', '.');
    await copyIntoOutput('client/css', 'client/css');
    await copyIntoOutput('client/fonts', 'client/fonts');
    await copyIntoOutput('client/audio', 'audio');
    await copyIntoOutput('assets/maps', 'assets/maps');
    await writeDevIndexHtml();

    console.log(`dev client build complete -> ${outputRoot}`);
}

main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`dev client build failed: ${message}`);
    process.exit(1);
});
