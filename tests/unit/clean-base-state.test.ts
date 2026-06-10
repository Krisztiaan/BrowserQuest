import { expect, test } from 'bun:test';

test('clean base checker source guards root external audit files', async () => {
    const source = await Bun.file('tools/maintenance/check-clean-base-state.ts').text();
    expect(source).toContain('EXTERNAL-AUDIT.md');
});

test('clean base checker source guards active scripts from legacy tools', async () => {
    const source = await Bun.file('tools/maintenance/check-clean-base-state.ts').text();
    expect(source).toContain('tools/content/legacy/');
    expect(source).toContain("!name.startsWith('legacy:')");
});
