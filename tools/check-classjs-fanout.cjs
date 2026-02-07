#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const serverRoot = path.join(repoRoot, 'server', 'js');

const allowed = new Set([]);

const classRequirePattern = /require\((['"])\.\/lib\/class\1\)/;

function walk(dirPath, output) {
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
        const next = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            walk(next, output);
            continue;
        }
        if (!entry.isFile() || !next.endsWith('.js')) {
            continue;
        }
        output.push(next);
    }
}

const files = [];
walk(serverRoot, files);

const actual = files
    .filter((filePath) => {
        const content = fs.readFileSync(filePath, 'utf8');
        return classRequirePattern.test(content);
    })
    .map((filePath) => path.relative(repoRoot, filePath).replace(/\\/g, '/'))
    .sort();

const unexpected = actual.filter((file) => !allowed.has(file));
const retired = Array.from(allowed).filter((file) => !actual.includes(file)).sort();

if (unexpected.length > 0) {
    console.error('class-fanout-check: unexpected new lib/class.js dependencies detected:');
    for (const file of unexpected) {
        console.error(` - ${file}`);
    }
    console.error('Update migration patches to remove these imports or refresh allowlist intentionally.');
    process.exit(1);
}

console.log(`class-fanout-check: ok (${actual.length} tracked dependencies).`);
if (retired.length > 0) {
    console.log('class-fanout-check: modules no longer depending on lib/class.js (consider allowlist refresh):');
    for (const file of retired) {
        console.log(` - ${file}`);
    }
}
