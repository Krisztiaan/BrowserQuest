import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

interface CheckSpec {
    key: string;
    command: string[];
}

interface CheckResult {
    key: string;
    passed: boolean;
    durationMs: number;
    stdout: string;
    stderr: string;
    status: number;
    signal: NodeJS.Signals | null;
    tailHint: string;
    spawnError: string | null;
}

interface FailedCheckSnapshotItem {
    key: string;
    exitCode: number;
    logTailHint: string;
    signal?: NodeJS.Signals;
    spawnError?: string;
}

interface DrillSummary {
    ts: string;
    checks: Array<{ key: string; passed: boolean; durationMs: number; status: number }>;
    totalMs: number;
    passed: boolean;
    failureSnapshot?: {
        failureCount: number;
        failedCheckKeys: string[];
        failedChecks: FailedCheckSnapshotItem[];
    };
}

const checks: CheckSpec[] = [
    { key: 'decision', command: ['bun', 'run', 'test:ws:runtime:decision'] },
    { key: 'parity', command: ['bun', 'run', 'test:ws:runtime:parity'] },
];
const forcedFailureCheck = process.env.BQ_WS_DRILL_FORCE_FAIL_CHECK;

const results: CheckResult[] = [];

function toTailHint(stdout, stderr) {
    const lines = `${stdout || ''}\n${stderr || ''}`
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    if (lines.length === 0) {
        return 'no-output';
    }

    const hint = lines.slice(-3).join(' | ');
    if (hint.length <= 220) {
        return hint;
    }

    return `${hint.slice(0, 217)}...`;
}

function toPreview(stdout, stderr) {
    const output = `${stdout || ''}${stderr || ''}`.trim();
    if (!output) {
        return '';
    }

    return output.split('\n').slice(-20).join('\n');
}

for (const check of checks) {
    const command =
        forcedFailureCheck && forcedFailureCheck === check.key
            ? ['node', '-e', "console.error('[ws-boundary-drill] forced failure simulation'); process.exit(97);"]
            : check.command;
    const startedAt = Date.now();
    const run = spawnSync(command[0], command.slice(1), {
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    const status = typeof run.status === 'number' ? run.status : -1;
    const durationMs = Date.now() - startedAt;
    const passed = status === 0 && !run.error;
    const tailHint = toTailHint(run.stdout, run.stderr);
    const preview = toPreview(run.stdout, run.stderr);
    const spawnError = run.error ? run.error.message : null;

    results.push({
        key: check.key,
        passed,
        durationMs,
        stdout: run.stdout || '',
        stderr: run.stderr || '',
        status,
        signal: run.signal || null,
        tailHint,
        spawnError,
    });

    if (!passed) {
        const detail = spawnError ? `spawn_error (${status})` : `exit ${status}`;
        console.error(`\n[ws-boundary-drill] ${check.key}: FAIL (${detail})`);
        if (preview) {
            console.error(preview);
        }
        if (spawnError) {
            console.error(`[ws-boundary-drill] ${check.key}: ${spawnError}`);
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

const summary: DrillSummary = {
    ts: new Date().toISOString(),
    checks: results.map((item) => ({
        key: item.key,
        passed: item.passed,
        durationMs: item.durationMs,
        status: item.status,
    })),
    totalMs,
    passed: failed.length === 0,
};

if (failed.length > 0) {
    summary.failureSnapshot = {
        failureCount: failed.length,
        failedCheckKeys: failed.map((item) => item.key),
        failedChecks: failed.map((item): FailedCheckSnapshotItem => {
            const payload: FailedCheckSnapshotItem = {
                key: item.key,
                exitCode: item.status,
                logTailHint: item.tailHint,
            };

            if (item.signal) {
                payload.signal = item.signal;
            }
            if (item.spawnError) {
                payload.spawnError = item.spawnError;
            }

            return payload;
        }),
    };
}

const summaryPath = process.env.BQ_WS_DRILL_SUMMARY_PATH;
if (summaryPath) {
    mkdirSync(dirname(summaryPath), { recursive: true });
    writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + '\n', 'utf8');
    console.log(`- summary_path: ${summaryPath}`);
}

const markdownPath = process.env.BQ_WS_DRILL_MARKDOWN_PATH;
if (markdownPath) {
    const lines = [
        '# Websocket Boundary Drill Summary',
        '',
        `- Timestamp: ${summary.ts}`,
        `- Overall: ${summary.passed ? 'PASS' : 'FAIL'}`,
        `- Total: ${summary.totalMs}ms`,
        '',
        '## Checks',
        '',
    ];

    for (const item of summary.checks) {
        lines.push(`- ${item.key}: ${item.passed ? 'PASS' : 'FAIL'} (${item.durationMs}ms, exit=${item.status})`);
    }

    if (summary.failureSnapshot) {
        lines.push('');
        lines.push('## Failure Snapshot');
        lines.push('');
        lines.push(`- Failed checks: ${summary.failureSnapshot.failedCheckKeys.join(', ')}`);
        for (const item of summary.failureSnapshot.failedChecks) {
            const signalSuffix = item.signal ? `, signal=${item.signal}` : '';
            lines.push(`- ${item.key}: exit=${item.exitCode}${signalSuffix}; hint=${item.logTailHint}`);
        }
    }

    lines.push('');
    mkdirSync(dirname(markdownPath), { recursive: true });
    writeFileSync(markdownPath, lines.join('\n'), 'utf8');
    console.log(`- markdown_path: ${markdownPath}`);
}

if (failed.length > 0) {
    process.exit(1);
}

if (passed.length === checks.length) {
    process.exit(0);
}
