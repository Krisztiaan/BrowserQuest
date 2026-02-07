#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const packageJsonPath = path.join(repoRoot, 'package.json');
const buildScriptPath = path.join(repoRoot, 'bin', 'build.sh');
const rWrapperPath = path.join(repoRoot, 'bin', 'r.cjs');

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

for (const scriptName of ['verify:modern', 'verify:legacy']) {
  const value = packageJson.scripts?.[scriptName];
  if (typeof value !== 'string' || !value.includes('check:package-mode-boundaries')) {
    fail(`script "${scriptName}" must include check:package-mode-boundaries`);
  }
}

if (!fs.existsSync(rWrapperPath)) {
  fail('missing required legacy optimizer wrapper bin/r.cjs');
}

const buildScript = readUtf8(buildScriptPath);
if (!buildScript.includes('bin/r.cjs')) {
  fail('bin/build.sh must invoke bin/r.cjs for legacy optimizer compatibility');
}

process.stdout.write('package-mode-boundary-check: ok (module package mode + CJS boundaries intact)\n');
