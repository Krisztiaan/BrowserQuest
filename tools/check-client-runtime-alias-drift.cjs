#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const clientRoot = path.join(repoRoot, 'client', 'js-esm');
const runtimeConfig = 'tsconfig.typecheck-client-runtime.json';
const runtimeConfigPath = path.join(repoRoot, runtimeConfig);
const strictMode =
    process.argv.includes('--strict') ||
    process.env.BQ_CLIENT_RUNTIME_ALIAS_STRICT === '1';

function readRuntimePathAliases() {
    const config = JSON.parse(fs.readFileSync(runtimeConfigPath, 'utf8'));
    const aliases = config?.compilerOptions?.paths || {};
    return new Set(Object.keys(aliases));
}

function listRuntimeLaneClientFiles() {
    const result = spawnSync(
        'bun',
        ['x', 'tsc', '-p', runtimeConfig, '--listFiles', '--pretty', 'false'],
        {
            cwd: repoRoot,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
        }
    );

    if (result.error) {
        console.error('client-runtime-alias-drift-check: failed to execute TypeScript listFiles command.');
        console.error(String(result.error));
        process.exit(1);
    }

    if (result.status !== 0) {
        console.error('client-runtime-alias-drift-check: TypeScript listFiles command failed.');
        if (result.stdout) {
            process.stderr.write(result.stdout);
        }
        if (result.stderr) {
            process.stderr.write(result.stderr);
        }
        process.exit(result.status || 1);
    }

    const files = new Set();
    for (const rawLine of result.stdout.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line) {
            continue;
        }
        const resolved = path.resolve(repoRoot, line);
        if (!resolved.startsWith(clientRoot + path.sep)) {
            continue;
        }
        if (!resolved.endsWith('.js')) {
            continue;
        }
        files.add(resolved);
    }
    return Array.from(files).sort();
}

function collectBareSpecifiers(filePaths) {
    const specifierToFiles = new Map();
    const staticImportPattern = /\bimport\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g;
    const dynamicImportPattern = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

    const addSpecifier = (specifier, sourcePath) => {
        if (
            !specifier ||
            specifier.startsWith('.') ||
            specifier.startsWith('/') ||
            specifier.startsWith('node:')
        ) {
            return;
        }
        const list = specifierToFiles.get(specifier) || new Set();
        list.add(path.relative(repoRoot, sourcePath).replace(/\\/g, '/'));
        specifierToFiles.set(specifier, list);
    };

    for (const filePath of filePaths) {
        const source = fs.readFileSync(filePath, 'utf8');

        staticImportPattern.lastIndex = 0;
        dynamicImportPattern.lastIndex = 0;

        let match;
        while ((match = staticImportPattern.exec(source)) !== null) {
            addSpecifier(match[1], filePath);
        }
        while ((match = dynamicImportPattern.exec(source)) !== null) {
            addSpecifier(match[1], filePath);
        }
    }

    return specifierToFiles;
}

const aliases = readRuntimePathAliases();
const runtimeFiles = listRuntimeLaneClientFiles();
const specifierToFiles = collectBareSpecifiers(runtimeFiles);
const missingAliases = [];
const unusedAliases = [];

for (const [specifier, files] of specifierToFiles.entries()) {
    if (!aliases.has(specifier)) {
        missingAliases.push({ specifier, files: Array.from(files).sort() });
    }
}

missingAliases.sort((a, b) => a.specifier.localeCompare(b.specifier));

if (missingAliases.length > 0) {
    console.error('client-runtime-alias-drift-check: missing explicit path aliases:');
    for (const entry of missingAliases) {
        console.error(` - ${entry.specifier}`);
        for (const file of entry.files) {
            console.error(`   from: ${file}`);
        }
    }
    console.error(`Add missing aliases to ${runtimeConfig} compilerOptions.paths.`);
    process.exit(1);
}

for (const alias of aliases.values()) {
    if (!specifierToFiles.has(alias)) {
        unusedAliases.push(alias);
    }
}
unusedAliases.sort((a, b) => a.localeCompare(b));

if (unusedAliases.length > 0) {
    const header = strictMode
        ? 'client-runtime-alias-drift-check: strict mode failed due to unused explicit aliases:'
        : 'client-runtime-alias-drift-check: warning - unused explicit aliases:';
    console.error(header);
    for (const alias of unusedAliases) {
        console.error(` - ${alias}`);
    }
    console.error(`Remove stale aliases from ${runtimeConfig} or re-run with intended usage.`);
    if (strictMode) {
        process.exit(1);
    }
}

console.log(
    `client-runtime-alias-drift-check: ok (${specifierToFiles.size} bare specifiers across ${runtimeFiles.length} runtime-lane files, ${unusedAliases.length} unused aliases).`
);
