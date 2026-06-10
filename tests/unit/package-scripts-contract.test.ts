import { expect, test } from 'bun:test';
import packageJson from '../../package.json';

const scripts = packageJson.scripts as Record<string, string>;

test('verify modern does not call legacy scripts', () => {
    expect(scripts['verify:modern']).toBeDefined();
    expect(scripts['verify:modern']).not.toContain('legacy:');
    expect(scripts['verify:modern']).not.toContain('fix:world-portals');
    expect(scripts['verify:modern']).not.toContain('fix:world-standardize');
});

test('map write scripts are explicit repair or legacy lanes', () => {
    const writeScripts = Object.entries(scripts).filter(([, command]) => command.includes('tools/content/') && command.includes('--write'));
    for (const [name] of writeScripts) {
        expect(name.startsWith('repair:') || name.startsWith('legacy:')).toBe(true);
    }
});

test('known stale world portal script is not an active fix script', () => {
    expect(scripts['fix:world-portals']).toBeUndefined();
});
