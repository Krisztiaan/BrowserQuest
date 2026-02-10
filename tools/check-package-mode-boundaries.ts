import * as fs from 'node:fs';
import * as path from 'node:path';

const repoRoot = path.resolve(import.meta.dir, '..');
const packageJsonPath = path.join(repoRoot, 'package.json');
const retiredMapWatchPath = path.join(repoRoot, 'tools', 'maps', 'watch.ts');
const retiredClientMapsDir = path.join(repoRoot, 'client', 'maps');
const retiredServerMapsDir = path.join(repoRoot, 'server', 'maps');
const retiredClientImgDir = path.join(repoRoot, 'client', 'img');
const retiredNode22RunShellPath = path.join(repoRoot, 'tools', 'node22-run.sh');
const retiredLegacyIeStylesheetPath = path.join(repoRoot, 'client', 'css', 'ie.css');
const retiredClientAliasDriftCheckerPath = path.join(repoRoot, 'tools', 'check-client-runtime-alias-drift.ts');
const retiredClientRuntimeCoverageCheckerPath = path.join(repoRoot, 'tools', 'check-client-runtime-coverage.ts');
const retiredServerEsmRuntimeCoverageCheckerPath = path.join(
  repoRoot,
  'tools',
  'check-server-esm-runtime-coverage.ts',
);
const rootIndexPath = path.join(repoRoot, 'index.html');
const viteConfigPath = path.join(repoRoot, 'vite.config.ts');
const serverConfigPath = path.join(repoRoot, 'server', 'config.json');
const docsRoot = path.join(repoRoot, 'docs');
const docsArchiveRoot = path.join(docsRoot, 'archive');

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function fail(message) {
  process.stderr.write(`package-mode-boundary-check: ${message}\n`);
  process.exit(1);
}

function listMarkdownFiles(rootDir) {
  if (!fs.existsSync(rootDir)) return [];

  const results = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith('.md')) {
        results.push(fullPath);
      }
    }
  }
  return results;
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

if (verifyModern.includes('tools/maps/export.ts')) {
  fail('script "verify:modern" must not run generated map export pre-step after direct Tiled runtime cutover');
}

if (typeof packageJson.scripts?.['verify:legacy'] === 'string') {
  fail('script "verify:legacy" must not exist in modern-only mode');
}

if (typeof packageJson.scripts?.['map:watch'] === 'string') {
  fail('script "map:watch" must not exist after Vite-native map sync cutover');
}

if (typeof packageJson.scripts?.['check:client-runtime-alias-drift'] === 'string') {
  fail('script "check:client-runtime-alias-drift" must not exist after Vite alias built-in cutover');
}

if (typeof packageJson.scripts?.['check:client-runtime-alias-drift:strict'] === 'string') {
  fail('script "check:client-runtime-alias-drift:strict" must not exist after Vite alias built-in cutover');
}

if (typeof packageJson.scripts?.['check:client-runtime-coverage'] === 'string') {
  fail('script "check:client-runtime-coverage" must not exist after modern lane verifier simplification');
}

if (typeof packageJson.scripts?.['check:server-esm-runtime-coverage'] === 'string') {
  fail('script "check:server-esm-runtime-coverage" must not exist after server-esm glob coverage cutover');
}

if (fs.existsSync(retiredMapWatchPath)) {
  fail('tools/maps/watch.ts must not exist after Vite-native map sync cutover');
}

if (fs.existsSync(retiredClientMapsDir)) {
  fail('client/maps directory must not exist after generated-map artifact lane cutover');
}

if (fs.existsSync(retiredServerMapsDir)) {
  fail('server/maps directory must not exist after generated-map artifact lane cutover');
}

if (fs.existsSync(retiredClientImgDir)) {
  fail('client/img directory must not exist after Vite public-asset lane cutover');
}

if (fs.existsSync(retiredNode22RunShellPath)) {
  fail('tools/node22-run.sh must not exist after Bun-native Node22 runner cutover');
}

if (fs.existsSync(retiredLegacyIeStylesheetPath)) {
  fail('client/css/ie.css must not exist in modern-only browser support mode');
}

if (fs.existsSync(retiredClientAliasDriftCheckerPath)) {
  fail('tools/check-client-runtime-alias-drift.ts must not exist after Vite alias built-in cutover');
}

if (fs.existsSync(retiredClientRuntimeCoverageCheckerPath)) {
  fail('tools/check-client-runtime-coverage.ts must not exist after modern lane verifier simplification');
}

if (fs.existsSync(retiredServerEsmRuntimeCoverageCheckerPath)) {
  fail('tools/check-server-esm-runtime-coverage.ts must not exist after server-esm glob coverage cutover');
}

if (!fs.existsSync(rootIndexPath)) {
  fail('root index.html redirect entry must exist for Vite default-root routing');
}

if (readUtf8(viteConfigPath).includes('browserquest-root-redirect')) {
  fail('vite config must not include browserquest-root-redirect middleware after static root-index cutover');
}

const viteConfigSource = readUtf8(viteConfigPath);
if (
  viteConfigSource.includes('browserquest-map-runtime-sync') ||
  viteConfigSource.includes('syncRuntimeMaps(')
) {
  fail('vite config must not include generated-map sync plugins after direct Tiled runtime cutover');
}

if (!readUtf8(serverConfigPath).includes('"map_filepath": "./assets/maps/tiled/world.json"')) {
  fail('server/config.json must default map_filepath to ./assets/maps/tiled/world.json');
}

const docsRootEntries = fs.existsSync(docsRoot) ? fs.readdirSync(docsRoot, { withFileTypes: true }) : [];
const legacyRootDocs = docsRootEntries
  .filter((entry) => entry.isFile() && /^legacy-.*\.md$/.test(entry.name))
  .map((entry) => `docs/${entry.name}`);

if (legacyRootDocs.length > 0) {
  fail(
    `legacy historical docs must live under docs/archive/legacy (found: ${legacyRootDocs.join(', ')})`,
  );
}

const activeDocs = listMarkdownFiles(docsRoot).filter((filePath) => !filePath.startsWith(docsArchiveRoot + path.sep));
const archivedNoteOffenders = activeDocs
  .filter((filePath) => fs.readFileSync(filePath, 'utf8').includes('> Archived historical note'))
  .map((filePath) => path.relative(repoRoot, filePath));

if (archivedNoteOffenders.length > 0) {
  fail(
    `archived-note docs must be moved under docs/archive (found: ${archivedNoteOffenders.join(', ')})`,
  );
}

process.stdout.write(
  'package-mode-boundary-check: ok (module package mode + modern-only script boundaries intact, map watch lane/root legacy docs/source map dirs/client img lane/node22 shell runner/ie stylesheet/client alias drift checker/client runtime coverage checker/server esm runtime coverage checker/custom root redirect middleware/generated-map sync middleware retired; direct Tiled runtime lane active)\n',
);
