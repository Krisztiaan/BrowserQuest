import { existsSync, readdirSync, readFileSync } from 'node:fs';

type PackageJson = Readonly<{
    scripts?: Record<string, string>;
}>;

const failures: string[] = [];

function requireExists(path: string): void {
    if (!existsSync(path)) {
        failures.push(`Missing required clean-base file: ${path}`);
    }
}

requireExists('docs/README.md');
requireExists('docs/project-surface-inventory.md');
requireExists('artifacts/project-surface-inventory.json');

if (existsSync('EXTERNAL-AUDIT.md')) {
    failures.push('EXTERNAL-AUDIT.md must be moved under docs/audits/ or explicitly removed from the repo root.');
}

if (existsSync('docs')) {
    for (const file of readdirSync('docs')) {
        if (file.startsWith('audit-') && file.endsWith('.md')) {
            failures.push(`Historical audit remains in active docs root: docs/${file}`);
        }
    }
}

const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as PackageJson;
for (const [name, command] of Object.entries(packageJson.scripts ?? {})) {
    if (!name.startsWith('legacy:') && command.includes('tools/content/legacy/')) {
        failures.push(`Active script "${name}" calls legacy content tool: ${command}`);
    }
}

if (failures.length > 0) {
    console.error(`Clean base state check failed:\n${failures.join('\n')}`);
    process.exit(1);
}

console.log('Clean base state check passed.');
