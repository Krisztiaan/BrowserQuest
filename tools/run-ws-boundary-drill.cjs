#!/usr/bin/env node

const { spawnSync } = require('node:child_process');

const checks = [
    { key: 'decision', command: ['bun', 'run', 'test:ws:runtime:decision'] },
    { key: 'parity', command: ['bun', 'run', 'test:ws:runtime:parity'] },
];

const results = [];

for (const check of checks) {
    const startedAt = Date.now();
    const run = spawnSync(check.command[0], check.command.slice(1), {
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    const durationMs = Date.now() - startedAt;
    const passed = run.status === 0;

    results.push({
        key: check.key,
        passed,
        durationMs,
        stdout: run.stdout || '',
        stderr: run.stderr || '',
        status: run.status,
    });

    if (!passed) {
        const output = (run.stdout || '') + (run.stderr || '');
        const preview = output
            .trim()
            .split('\n')
            .slice(-20)
            .join('\n');
        console.error(`\n[ws-boundary-drill] ${check.key}: FAIL (exit ${run.status})`);
        if (preview) {
            console.error(preview);
        }
    }
}

const totalMs = results.reduce((sum, item) => sum + item.durationMs, 0);
const failed = results.filter((item) => !item.passed);
const passed = results.filter((item) => item.passed);

console.log('\n[ws-boundary-drill] Summary');
for (const item of results) {
    const status = item.passed ? 'PASS' : 'FAIL';
    console.log(`- ${item.key}: ${status} (${item.durationMs}ms)`);
}
console.log(`- total: ${totalMs}ms`);

if (failed.length > 0) {
    process.exit(1);
}

if (passed.length === checks.length) {
    process.exit(0);
}
