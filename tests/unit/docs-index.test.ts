import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from 'bun:test';

test('docs index names active and archived documentation sections', () => {
    const index = readFileSync('docs/README.md', 'utf8');
    expect(index).toContain('## Active Documentation');
    expect(index).toContain('## Archived Evidence');
});

test('historical February audits are archived', () => {
    expect(existsSync('docs/archive/2026-02/audit-typing-rules-streamlining-2026-02-12.md')).toBe(true);
    expect(existsSync('docs/archive/2026-02/audit-typing-rules-streamlining-2026-02-12-followup.md')).toBe(true);
    expect(existsSync('docs/archive/2026-02/audit-legacy-parity-combat-ai-2026-02-13.md')).toBe(true);
});

test('archived audits carry a historical evidence banner', () => {
    const audit = readFileSync('docs/archive/2026-02/audit-legacy-parity-combat-ai-2026-02-13.md', 'utf8');
    expect(audit.startsWith('> Historical evidence:')).toBe(true);
});

test('external audit evidence is imported under docs audits', () => {
    expect(existsSync('docs/audits/external-audit-2026-06-10.md')).toBe(true);
});
