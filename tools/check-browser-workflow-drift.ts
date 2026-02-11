import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

type PackageJson = {
    scripts?: Record<string, string>;
};

const repoRoot = process.cwd();
const packageJsonPath = path.join(repoRoot, 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as PackageJson;
const scripts = packageJson.scripts || {};

const fail = (message: string): never => {
    console.error(`browser-workflow-drift-check: fail - ${message}`);
    process.exit(1);
};

const ensureFileExists = (relativePath: string): void => {
    if (!existsSync(path.join(repoRoot, relativePath))) {
        fail(`required file missing: ${relativePath}`);
    }
};

const ensureScriptExists = (scriptName: string): void => {
    if (typeof scripts[scriptName] !== 'string') {
        fail(`missing package script: ${scriptName}`);
    }
};

const getWorkflowRuns = (relativePath: string): string[] => {
    const text = readFileSync(path.join(repoRoot, relativePath), 'utf8');
    return Array.from(text.matchAll(/^\s*run:\s*(.+)$/gm)).map((match) => match[1].trim());
};

const ensureWorkflowRunsCommand = (workflowPath: string, command: string): void => {
    const runCommands = getWorkflowRuns(workflowPath);
    if (!runCommands.includes(command)) {
        fail(`${workflowPath} does not run expected command: ${command}`);
    }
};

const requiredScripts = ['test:browser:modern', 'test:browser:protocol:ci'];
requiredScripts.forEach(ensureScriptExists);

ensureFileExists('playwright.config.ts');
ensureWorkflowRunsCommand('.github/workflows/verify-modern-browser.yml', 'bun run test:browser:modern');
ensureWorkflowRunsCommand('.github/workflows/verify-protocol-invariant.yml', 'bun run test:browser:protocol:ci');

const browserScriptNames = ['test:browser:modern', 'test:browser:protocol:ci', 'test:browser:protocol', 'test:browser:protocol-invariant'];
const browserTestPaths = new Set<string>();

for (const scriptName of browserScriptNames) {
    const script = scripts[scriptName];
    if (typeof script !== 'string') {
        continue;
    }

    for (const match of script.matchAll(/tests\/browser\/[^\s]+\.playwright\.ts/g)) {
        browserTestPaths.add(match[0]);
    }
}

for (const testPath of browserTestPaths) {
    ensureFileExists(testPath);
}

console.log(
    `browser-workflow-drift-check: ok (${requiredScripts.length} scripts, ${browserTestPaths.size} browser tests, workflows aligned)`,
);
