#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');

const EXPECTED_RJS_VERSION = '0.26.0';
const EXPECTED_HASHES = {
  'bin/r.js': 'ea6d971c5d558e65b237a7495d580fa13281a6fd95509b2c9c194fd74c1a2d23',
  'bin/r.cjs': '5ba3dba590fe9fd125cee77cec2275f3051ca653e75b9393edb154b8273a0449',
  'bin/build.sh': '2492efc508a78d69cc0a3e104c14144ddf0e630a962ec1564ea393ffeddd50a1',
  'client/js/build.js': '885f5139a1939a27133dcd3ffac3e40f7da50c57091cb4adb1cfddd54de5b1f3',
};

function fail(message) {
  process.stderr.write(`legacy-optimizer-integrity: ${message}\n`);
  process.exit(1);
}

function hashFile(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    fail(`missing required file: ${relativePath}`);
  }
  const content = fs.readFileSync(absolutePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

for (const [relativePath, expectedHash] of Object.entries(EXPECTED_HASHES)) {
  const actualHash = hashFile(relativePath);
  if (actualHash !== expectedHash) {
    fail(
      `hash mismatch for ${relativePath} (expected ${expectedHash}, got ${actualHash}). ` +
        'If intentional, update tools/check-legacy-optimizer-integrity.cjs and docs/legacy-optimizer-provenance.md.'
    );
  }
}

const rjsHeader = fs.readFileSync(path.join(repoRoot, 'bin', 'r.js'), 'utf8').slice(0, 500);
if (!rjsHeader.includes(`r.js ${EXPECTED_RJS_VERSION}`)) {
  fail(`expected bin/r.js version header ${EXPECTED_RJS_VERSION}`);
}

process.stdout.write('legacy-optimizer-integrity: ok (hashes + version header match expected baseline)\n');
