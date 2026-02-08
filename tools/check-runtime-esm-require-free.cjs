#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const roots = [path.join(repoRoot, 'server', 'js'), path.join(repoRoot, 'shared', 'js')];

function listRuntimeEsmFiles(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  return fs
    .readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.mjs'))
    .map((entry) => path.join(rootDir, entry.name));
}

const offenders = [];
for (const root of roots) {
  const files = listRuntimeEsmFiles(root);
  for (const filePath of files) {
    const source = fs.readFileSync(filePath, 'utf8');
    if (source.includes('createRequire(')) {
      offenders.push(path.relative(repoRoot, filePath));
    }
  }
}

if (offenders.length > 0) {
  console.error('runtime-esm-require-free-check: createRequire usage is not allowed in runtime .mjs bridge modules:');
  for (const relativePath of offenders) {
    console.error(` - ${relativePath}`);
  }
  console.error('Use ESM import interop (`import ...`) instead of createRequire for runtime bridge modules.');
  process.exit(1);
}

console.log('runtime-esm-require-free-check: ok (no createRequire usage in runtime .mjs modules).');
