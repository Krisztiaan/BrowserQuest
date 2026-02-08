#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const clientRoot = path.join(repoRoot, 'client', 'js-esm');
const runtimeConfig = 'tsconfig.typecheck-client-runtime.json';

function listTopLevelClientRuntimeFiles() {
    return fs
        .readdirSync(clientRoot, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
        .map((entry) => entry.name)
        .sort();
}

function listTypecheckReachableTopLevelFiles() {
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
        console.error('client-runtime-coverage-check: failed to execute TypeScript listFiles command.');
        console.error(String(result.error));
        process.exit(1);
    }

    if (result.status !== 0) {
        console.error('client-runtime-coverage-check: TypeScript listFiles command failed.');
        if (result.stdout) {
            process.stderr.write(result.stdout);
        }
        if (result.stderr) {
            process.stderr.write(result.stderr);
        }
        process.exit(result.status || 1);
    }

    const reachable = new Set();
    const lines = result.stdout.split(/\r?\n/);

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) {
            continue;
        }
        const resolved = path.resolve(repoRoot, line);
        if (!resolved.startsWith(clientRoot + path.sep)) {
            continue;
        }
        const relative = path.relative(clientRoot, resolved).replace(/\\/g, '/');
        if (relative.endsWith('.js') && !relative.includes('/')) {
            reachable.add(relative);
        }
    }

    return Array.from(reachable).sort();
}

const expected = listTopLevelClientRuntimeFiles();
const reachable = listTypecheckReachableTopLevelFiles();
const reachableSet = new Set(reachable);
const missing = expected.filter((fileName) => !reachableSet.has(fileName));

if (missing.length > 0) {
    console.error('client-runtime-coverage-check: missing top-level client runtime files in checkJs lane:');
    for (const fileName of missing) {
        console.error(` - client/js-esm/${fileName}`);
    }
    console.error(`Add these files to ${runtimeConfig} include roots or import graph.`);
    process.exit(1);
}

console.log(`client-runtime-coverage-check: ok (${reachable.length}/${expected.length} top-level files reachable).`);
