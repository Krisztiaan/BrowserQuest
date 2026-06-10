import fs from 'node:fs/promises';
import path from 'node:path';

type RuntimeConfig = Record<string, unknown> & {
    player_db_path?: string;
    claims_db_path?: string;
    chunk_overlay_db_path?: string;
};

const repoRoot = path.resolve(import.meta.dir, '..', '..');
const sourceConfigPath = path.join(repoRoot, 'server', 'config.json');
const outputConfigPath = path.join(repoRoot, 'server', '.tmp-config.playwright.json');

async function main(): Promise<void> {
    const sourceText = await fs.readFile(sourceConfigPath, 'utf8');
    const baseConfig = JSON.parse(sourceText) as RuntimeConfig;

    const playwrightConfig: RuntimeConfig = {
        ...baseConfig,
        player_db_path: ':memory:',
        claims_db_path: ':memory:',
        chunk_overlay_db_path: ':memory:',
    };

    await fs.writeFile(outputConfigPath, `${JSON.stringify(playwrightConfig, null, 2)}\n`, 'utf8');
    console.log(`playwright server config written -> ${outputConfigPath}`);
}

main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`failed to build playwright server config: ${message}`);
    process.exit(1);
});
