import { expect, test } from 'bun:test';
import { buildProjectSurfaceInventory } from '../../tools/maintenance/project-surface-inventory';

test('project surface inventory classifies package scripts', async () => {
    const entries = await buildProjectSurfaceInventory();
    expect(entries.some((entry) => entry.kind === 'package_script' && entry.name === 'verify:modern' && entry.status === 'active')).toBe(true);
    expect(entries.some((entry) => entry.kind === 'package_script' && entry.name === 'render:map-region' && entry.status === 'active')).toBe(true);
});

test('project surface inventory flags known stale map curation script', async () => {
    const entries = await buildProjectSurfaceInventory();
    const entry = entries.find((candidate) => candidate.kind === 'package_script' && candidate.name === 'legacy:fix:world-portals');
    expect(entry?.status).toBe('replace');
    expect(entry?.replacement).toContain('world-authoring-repair');
});

test('project surface inventory preserves historical audits instead of deleting them blindly', async () => {
    const entries = await buildProjectSurfaceInventory();
    const historical = entries.filter((entry) => entry.kind === 'doc' && entry.status === 'historical');
    expect(historical.length).toBeGreaterThan(0);
    expect(historical.every((entry) => Boolean(entry.preserveReason))).toBe(true);
});
