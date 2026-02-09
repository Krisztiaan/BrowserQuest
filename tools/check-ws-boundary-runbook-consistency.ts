import * as fs from 'node:fs';

const checks = [
    {
        file: 'docs/websocket-runtime-class-boundary-parity.md',
        patterns: [
            'server/js/ws-runtime-esm.ts',
            'server/js/ws-runtime-class-factory.ts',
            'bun run test:ws:runtime:drill',
            'bun run test:ws:runtime:decision',
            'bun run test:ws:runtime:parity',
            'bun run verify:modern:node22',
            'docs/websocket-boundary-escalation-template.md',
        ],
    },
    {
        file: 'docs/websocket-boundary-escalation-template.md',
        patterns: [
            'test:ws:runtime:decision',
            'test:ws:runtime:parity',
            'bun run verify:modern:node22',
            'ws-runtime-drill-summary-<run_id>',
        ],
    },
    {
        file: 'docs/runtime-cjs-boundary-inventory.md',
        patterns: [
            'No active CJS runtime boundary remains',
            'server/js/ws-runtime-esm.ts',
            'bun run verify:modern:node22',
        ],
    },
    {
        file: '.github/workflows/verify-ws-boundary-drill.yml',
        patterns: [
            'name: verify-ws-runtime-drill',
            'bun run test:ws:runtime:drill',
            'artifacts/ws-runtime-drill-summary.json',
            'ws-runtime-drill-summary-${{ github.run_id }}',
        ],
    },
];

const failures = [];

for (const check of checks) {
    let content = '';
    try {
        content = fs.readFileSync(check.file, 'utf8');
    } catch (err) {
        failures.push(`${check.file}: unreadable (${(err as { message?: string }).message || String(err)})`);
        continue;
    }

    for (const pattern of check.patterns) {
        if (!content.includes(pattern)) {
            failures.push(`${check.file}: missing "${pattern}"`);
        }
    }
}

if (failures.length > 0) {
    console.error('ws-boundary-runbook-consistency: fail');
    for (const failure of failures) {
        console.error(`- ${failure}`);
    }
    process.exit(1);
}

console.log('ws-boundary-runbook-consistency: ok');
