/* eslint-disable no-console */
import * as fs from 'node:fs';
import * as path from 'node:path';

const roots = ['server/js', 'shared/js'];
const offenders = [];

function collectCtsFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...collectCtsFiles(fullPath));
            continue;
        }
        if (entry.isFile() && fullPath.endsWith('.cts')) {
            files.push(fullPath);
        }
    }
    return files;
}

for (const root of roots) {
    if (!fs.existsSync(root)) {
        continue;
    }
    const files = collectCtsFiles(root);
    for (const filePath of files) {
        const source = fs.readFileSync(filePath, 'utf8');
        const lines = source.split('\n');
        lines.forEach((line, index) => {
            if (/^\s*var\s+.*=\s*require\(/.test(line)) {
                offenders.push(`${filePath}:${index + 1}`);
            }
        });
    }
}

if (offenders.length > 0) {
    console.error('cts-require-const-check: found legacy `var ... = require(...)` declarations:');
    offenders.forEach((entry) => console.error(`  - ${entry}`));
    process.exit(1);
}

console.log('cts-require-const-check: ok (no legacy `var ... = require(...)` declarations in .cts sources).');
