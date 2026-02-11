import * as fs from 'node:fs';
import * as path from 'node:path';

const repoRoot = path.resolve(import.meta.dir, '..');
const roots = [path.join(repoRoot, 'server'), path.join(repoRoot, 'shared')];

function listRuntimeEsmFiles(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  const files = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const currentDir = stack.pop();
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolute);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      const relative = path.relative(repoRoot, absolute).replace(/\\/g, '/');
      const isRuntimeBridgeFile =
        entry.name.endsWith('-esm.ts') ||
        relative === 'server/entry.ts' ||
        relative.startsWith('server/main/') ||
        relative === 'server/ws-runtime-class-factory.ts' ||
        relative === 'server/ws-runtime-esm.ts';
      if (isRuntimeBridgeFile) {
        files.push(absolute);
      }
    }
  }
  return files;
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
  console.error('runtime-esm-require-free-check: createRequire usage is not allowed in runtime .ts bridge modules:');
  for (const relativePath of offenders) {
    console.error(` - ${relativePath}`);
  }
  console.error('Use ESM import interop (`import ...`) instead of createRequire for runtime bridge modules.');
  process.exit(1);
}

console.log('runtime-esm-require-free-check: ok (no createRequire usage in runtime .ts modules).');
