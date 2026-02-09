import * as fs from 'node:fs';
import * as path from 'node:path';

const repoRoot = path.resolve(import.meta.dir, '..');
const packageJsonPath = path.join(repoRoot, 'package.json');

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function fail(message) {
  process.stderr.write(`package-mode-boundary-check: ${message}\n`);
  process.exit(1);
}

let packageJson;
try {
  packageJson = JSON.parse(readUtf8(packageJsonPath));
} catch (error) {
  fail(`unable to parse package.json (${error.message})`);
}

if (packageJson.type !== 'module') {
  fail(`expected package.json type to be "module" but got "${packageJson.type}"`);
}

const verifyModern = packageJson.scripts?.['verify:modern'];
if (typeof verifyModern !== 'string' || !verifyModern.includes('check:package-mode-boundaries')) {
  fail('script "verify:modern" must include check:package-mode-boundaries');
}

if (typeof packageJson.scripts?.['verify:legacy'] === 'string') {
  fail('script "verify:legacy" must not exist in modern-only mode');
}

process.stdout.write('package-mode-boundary-check: ok (module package mode + modern-only script boundaries intact)\n');
