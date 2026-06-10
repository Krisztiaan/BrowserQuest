import { readdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? '.');
const forbiddenNames = new Set(['.DS_Store', 'node_modules', 'dist', 'generated']);
const forbiddenPathParts = ['server/.data'];
const forbiddenPatterns = [/world\.original\.json$/, /world\.backup\..*\.json$/, /\.sqlite(?:-(?:wal|shm))?$/];

async function walk(dir: string, out: string[]): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
        const absolute = path.join(dir, entry.name);
        const relative = path.relative(root, absolute).replace(/\\/g, '/');
        const forbidden =
            forbiddenNames.has(entry.name) ||
            forbiddenPathParts.some((part) => relative === part || relative.startsWith(`${part}/`)) ||
            forbiddenPatterns.some((pattern) => pattern.test(relative));

        if (forbidden) {
            out.push(relative);
            if (entry.isDirectory()) {
                continue;
            }
        }

        if (entry.isDirectory()) {
            await walk(absolute, out);
        }
    }
}

const violations: string[] = [];
await walk(root, violations);

if (violations.length > 0) {
    console.error(`Handoff hygiene check failed:\n${violations.sort().join('\n')}`);
    process.exit(1);
}

console.log('Handoff hygiene check passed.');
