import fs from 'node:fs/promises';
import path from 'node:path';
import { copyPathIfExists } from '../shared/fs-helpers';

const repoRoot = path.resolve(import.meta.dir, '..', '..');
const outputRoot = path.join(repoRoot, 'dist', 'server');

async function copyIntoOutput(sourceRelativePath: string): Promise<void> {
    const sourcePath = path.join(repoRoot, sourceRelativePath);
    const destinationPath = path.join(outputRoot, sourceRelativePath);
    await copyPathIfExists(sourcePath, destinationPath);
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
