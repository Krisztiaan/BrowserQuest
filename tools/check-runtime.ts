import { execSync } from 'node:child_process';

const REQUIRED_NODE_MAJOR = 22;
const MIN_BUN = { major: 1, minor: 3, patch: 0 };

function parseSemver(input) {
  const match = String(input).trim().match(/^v?(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    return null;
  }
  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3], 10),
  };
}

function compareSemver(a, b) {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

function fail(message) {
  process.stderr.write(`runtime-check: ${message}\n`);
  process.exit(1);
}

let nodeRawVersion;
try {
  nodeRawVersion = execSync('node -p "process.version"', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
} catch (_) {
  fail('node is not available on PATH. Install Node 22.x.');
}

const nodeVersion = parseSemver(nodeRawVersion);
if (!nodeVersion) {
  fail(`unable to parse Node version: ${nodeRawVersion}`);
}

if (nodeVersion.major !== REQUIRED_NODE_MAJOR) {
  fail(
    `unsupported Node runtime ${nodeRawVersion}. Required major is ${REQUIRED_NODE_MAJOR}. ` +
      `Use \`nvm use\` (reads .nvmrc) or install Node ${REQUIRED_NODE_MAJOR}.`
  );
}

let bunRawVersion;
try {
  bunRawVersion = execSync('bun -v', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
} catch (error) {
  fail('bun is not available on PATH. Install Bun >= 1.3.0.');
}

const bunVersion = parseSemver(bunRawVersion);
if (!bunVersion) {
  fail(`unable to parse Bun version: ${bunRawVersion}`);
}

if (compareSemver(bunVersion, MIN_BUN) < 0) {
  fail(
    `unsupported Bun runtime ${bunRawVersion}. Required Bun is >= ` +
      `${MIN_BUN.major}.${MIN_BUN.minor}.${MIN_BUN.patch}.`
  );
}

process.stdout.write(
  `runtime-check: ok (node ${nodeRawVersion}, bun ${bunRawVersion})\n`
);
