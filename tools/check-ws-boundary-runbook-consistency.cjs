#!/usr/bin/env node

const fs = require('node:fs');

const checks = [
    {
        file: 'README.md',
        patterns: [
            'docs/websocket-runtime-class-boundary-parity.md',
            'docs/websocket-cjs-factory-migration-decision.md',
            'docs/websocket-factory-ts-source-promotion-plan.md',
            'docs/websocket-boundary-escalation-template.md',
            'bun run test:ws:runtime:drill',
            'bun run build:ws-runtime-factory',
            'bun run check:ws-runtime-factory-sync',
        ],
    },
    {
        file: 'docs/client-build-support.md',
        patterns: [
            'verify-ws-boundary-drill',
            'docs/websocket-cjs-factory-migration-decision.md',
            'docs/websocket-boundary-escalation-template.md',
            'bun run test:ws:runtime:drill',
            'server/js/ws-runtime-class-factory.cts',
            'bun run build:ws-runtime-factory',
            'bun run check:ws-runtime-factory-sync',
        ],
    },
    {
        file: 'docs/runtime-cjs-boundary-inventory.md',
        patterns: [
            'docs/websocket-cjs-factory-migration-decision.md',
            'docs/websocket-runtime-class-boundary-parity.md',
            'docs/websocket-boundary-escalation-template.md',
            'bun run test:ws:runtime:drill',
            'bun run test:ws:runtime:decision',
            'bun run build:ws-runtime-factory',
            'bun run check:ws-runtime-factory-sync',
        ],
    },
    {
        file: 'docs/package-mode-migration-checklist.md',
        patterns: ['bun run test:ws:runtime:drill'],
    },
    {
        file: 'docs/websocket-cjs-factory-migration-decision.md',
        patterns: [
            'docs/websocket-boundary-escalation-template.md',
            'server/js/ws-runtime-class-factory.cts',
            'server/js/ws-runtime-class-factory.cjs',
            'bun run build:ws-runtime-factory',
            'bun run check:ws-runtime-factory-sync',
            'bun run test:ws:runtime:drill',
            'ws-boundary-drill-summary-<run_id>',
        ],
    },
    {
        file: 'docs/websocket-runtime-class-boundary-parity.md',
        patterns: [
            'docs/websocket-boundary-escalation-template.md',
            'bun run test:ws:runtime:drill',
            'bun run build:ws-runtime-factory',
            'bun run check:ws-runtime-factory-sync',
        ],
    },
    {
        file: '.github/workflows/verify-ws-boundary-drill.yml',
        patterns: ['workflow_dispatch:', 'bun run test:ws:runtime:drill', 'ws-boundary-drill-summary-${{ github.run_id }}'],
    },
];

const failures = [];

for (const check of checks) {
    let content = '';
    try {
        content = fs.readFileSync(check.file, 'utf8');
    } catch (err) {
        failures.push(`${check.file}: unreadable (${err.message})`);
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
