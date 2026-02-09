import * as fs from 'node:fs';
import * as path from 'node:path';

const repoRoot = path.resolve(import.meta.dir, '..');
const configFile = 'tsconfig.typecheck-server-esm.json';
const configPath = path.join(repoRoot, configFile);

function toPosixPath(input) {
    return input.replace(/\\/g, '/');
}

function listExpectedRuntimeEsmFiles() {
    const expected = new Set();

    const serverDir = path.join(repoRoot, 'server', 'js');
    for (const entry of fs.readdirSync(serverDir, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith('.ts')) {
            continue;
        }
        expected.add(`server/js/${entry.name}`);
    }

    const sharedDir = path.join(repoRoot, 'shared', 'js');
    for (const entry of fs.readdirSync(sharedDir, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith('-esm.ts')) {
            continue;
        }
        expected.add(`shared/js/${entry.name}`);
    }

    return Array.from(expected).sort();
}

function loadConfigIncludes() {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const includes = Array.isArray(config?.include) ? config.include : [];
    return includes.map((entry) => toPosixPath(String(entry)));
}

const expected = listExpectedRuntimeEsmFiles();
const includes = loadConfigIncludes();
const includeSet = new Set(includes);

const missing = expected.filter((file) => !includeSet.has(file));
const stale = includes
    .filter((entry) => entry.endsWith('.ts') && !entry.includes('*'))
    .filter((entry) => !fs.existsSync(path.join(repoRoot, entry)))
    .sort();

if (missing.length > 0 || stale.length > 0) {
    console.error('server-esm-runtime-coverage-check: failed.');

    if (missing.length > 0) {
        console.error('Missing files from tsconfig include list:');
        for (const file of missing) {
            console.error(` - ${file}`);
        }
    }

    if (stale.length > 0) {
        console.error('Stale include entries (file not found):');
        for (const file of stale) {
            console.error(` - ${file}`);
        }
    }

    console.error(`Update ${configFile} include coverage to match runtime ESM files.`);
    process.exit(1);
}

console.log(
    `server-esm-runtime-coverage-check: ok (${expected.length} runtime ESM files covered in ${configFile}).`
);
