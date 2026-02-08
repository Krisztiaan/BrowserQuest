#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const buildConfig = 'tsconfig.build-npc.json';
const buildOutFile = path.join(repoRoot, '.tmp', 'npc', 'npc.cjs');
const runtimeFile = path.join(repoRoot, 'server', 'js', 'npc.js');
const checkMode = process.argv.includes('--check');
const generatedBanner =
    '// AUTO-GENERATED from server/js/npc.cts via `bun run build:npc`.\n' +
    '// Do not edit server/js/npc.js directly.\n\n';

const tsc = spawnSync('bun', ['x', 'tsc', '-p', buildConfig], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
});

if (tsc.error) {
    console.error('npc-sync: failed to execute TypeScript build.');
    console.error(String(tsc.error));
    process.exit(1);
}

if (tsc.status !== 0) {
    console.error('npc-sync: TypeScript build failed.');
    if (tsc.stdout) {
        process.stderr.write(tsc.stdout);
    }
    if (tsc.stderr) {
        process.stderr.write(tsc.stderr);
    }
    process.exit(tsc.status || 1);
}

if (!fs.existsSync(buildOutFile)) {
    console.error('npc-sync: build output file not found.');
    console.error(`Expected: ${path.relative(repoRoot, buildOutFile)}`);
    process.exit(1);
}

const generated = generatedBanner + fs.readFileSync(buildOutFile, 'utf8');
const current = fs.existsSync(runtimeFile) ? fs.readFileSync(runtimeFile, 'utf8') : '';

if (generated === current) {
    console.log('npc-sync: ok (runtime artifact is up to date).');
    process.exit(0);
}

if (checkMode) {
    console.error('npc-sync: out of sync.');
    console.error('Run `bun run build:npc` to regenerate server/js/npc.js.');
    process.exit(1);
}

fs.writeFileSync(runtimeFile, generated, 'utf8');
console.log('npc-sync: updated server/js/npc.js from .cts source.');
