import { readdirSync, readFileSync } from 'node:fs';
import { expect, test } from 'bun:test';
import packageJson from '../../package.json';

const scripts = packageJson.scripts as Record<string, string>;

test('active scripts do not reference legacy content tools', () => {
    for (const [name, command] of Object.entries(scripts)) {
        if (name.startsWith('legacy:')) {
            continue;
        }
        expect(command).not.toContain('tools/content/legacy/');
    }
});

test('legacy content tools have replacement documentation', () => {
    const readme = readFileSync('tools/content/legacy/README.md', 'utf8');
    for (const file of readdirSync('tools/content/legacy')) {
        if (!file.endsWith('.ts')) {
            continue;
        }
        expect(readme).toContain(file);
        expect(readme).toContain('Replacement:');
    }
});

test('legacy scripts point at legacy content tool paths', () => {
    for (const [name, command] of Object.entries(scripts)) {
        if (name.startsWith('legacy:fix:')) {
            expect(command).toContain('tools/content/legacy/');
        }
    }
});
