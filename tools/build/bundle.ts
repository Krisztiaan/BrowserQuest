import fs from 'node:fs/promises';
import path from 'node:path';
import { pathExists } from '../shared/fs-helpers';

const repoRoot = path.resolve(import.meta.dir, '..', '..');
const serverArtifactRoot = path.join(repoRoot, 'dist', 'server');
const clientArtifactRoot = path.join(repoRoot, 'dist', 'client');
const bundleRoot = path.join(repoRoot, 'dist', 'bundle');

function resolveGitCommitSha(): string {
    const result = Bun.spawnSync({
        cmd: ['git', 'rev-parse', '--short', 'HEAD'],
        cwd: repoRoot,
        stdout: 'pipe',
        stderr: 'ignore',
    });

    if (result.exitCode === 0) {
        const sha = result.stdout.toString().trim();
        if (sha.length > 0) {
            return sha;
        }
    }
    return 'unknown';
}

async function main(): Promise<void> {
    if (!(await pathExists(serverArtifactRoot))) {
        throw new Error('dist/server is missing. Run `bun run build:server` first.');
    }

    if (!(await pathExists(clientArtifactRoot))) {
        throw new Error('dist/client is missing. Run `bun run build:client` first.');
    }

    await fs.rm(bundleRoot, { recursive: true, force: true });
    await fs.mkdir(bundleRoot, { recursive: true });

    await fs.cp(serverArtifactRoot, bundleRoot, { recursive: true, force: true });
    await fs.cp(clientArtifactRoot, path.join(bundleRoot, 'client'), { recursive: true, force: true });

    const packageJsonPath = path.join(repoRoot, 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8')) as { version?: string };

    const versionManifest = {
        name: 'browserquest',
        version: packageJson.version ?? '0.0.0',
        commit: resolveGitCommitSha(),
        built_at: new Date().toISOString(),
        artifact_root: 'dist/bundle',
        client_root: 'dist/bundle/client',
        server_entry: 'dist/bundle/server/entry.ts',
        server_config: 'dist/bundle/server/config.json',
    };

    await fs.writeFile(
        path.join(bundleRoot, 'VERSION.json'),
        `${JSON.stringify(versionManifest, null, 2)}\n`,
        'utf8',
    );

    console.log(`build:bundle complete -> ${bundleRoot}`);
}

main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`build:bundle failed: ${message}`);
    process.exit(1);
});
