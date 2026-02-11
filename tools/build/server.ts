import fs from 'node:fs/promises';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dir, '..', '..');
const outputRoot = path.join(repoRoot, 'dist', 'server');

async function pathExists(targetPath: string): Promise<boolean> {
    try {
        await fs.access(targetPath);
        return true;
    } catch (_) {
        return false;
    }
}

async function copyIntoOutput(sourceRelativePath: string): Promise<void> {
    const sourcePath = path.join(repoRoot, sourceRelativePath);
    if (!(await pathExists(sourcePath))) {
        return;
    }

    const destinationPath = path.join(outputRoot, sourceRelativePath);
    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    await fs.cp(sourcePath, destinationPath, { recursive: true, force: true });
}

async function main(): Promise<void> {
    await fs.rm(outputRoot, { recursive: true, force: true });
    await fs.mkdir(outputRoot, { recursive: true });

    const runtimePayload = ['server', 'shared', 'assets', 'package.json', 'bun.lock', '.nvmrc'];
    for (const entry of runtimePayload) {
        await copyIntoOutput(entry);
    }

    console.log(`build:server complete -> ${outputRoot}`);
}

main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`build:server failed: ${message}`);
    process.exit(1);
});
