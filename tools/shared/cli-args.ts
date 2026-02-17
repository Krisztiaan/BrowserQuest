export type CliArgValue = string | number | boolean;

export type CliArgSpec = Readonly<{
    key: string;
    kind: 'string' | 'number' | 'boolean';
    defaultValue?: CliArgValue;
}>;

export type ParsedCliArgs = Record<string, CliArgValue>;

export type ParseCliArgsOptions = Readonly<{
    onHelp?: () => never;
}>;

function parseNumberStrict(value: string, flag: string): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        throw new Error(`Invalid ${flag}: ${value}`);
    }
    return parsed;
}

function indexSpecs(specs: ReadonlyArray<CliArgSpec>): Map<string, CliArgSpec> {
    const indexed = new Map<string, CliArgSpec>();
    for (const spec of specs) {
        if (indexed.has(spec.key)) {
            throw new Error(`Duplicate CLI spec key: ${spec.key}`);
        }
        indexed.set(spec.key, spec);
    }
    return indexed;
}

export function parseCliArgs(
    argv: ReadonlyArray<string>,
    specs: ReadonlyArray<CliArgSpec>,
    options?: ParseCliArgsOptions
): ParsedCliArgs {
    const out: ParsedCliArgs = {};
    const specsByKey = indexSpecs(specs);

    for (const spec of specs) {
        if (spec.defaultValue !== undefined) {
            out[spec.key] = spec.defaultValue;
        }
    }

    for (let i = 0; i < argv.length; i += 1) {
        const raw = argv[i] ?? '';
        if (raw === '--help' || raw === '-h') {
            if (options?.onHelp) {
                options.onHelp();
            }
            throw new Error('Help requested but no help handler was provided.');
        }
        if (!raw.startsWith('--')) {
            throw new Error(`Unknown argument: ${raw}`);
        }

        const key = raw.slice(2);
        const spec = specsByKey.get(key);
        if (!spec) {
            throw new Error(`Unknown flag: --${key}`);
        }

        if (spec.kind === 'boolean') {
            out[key] = true;
            continue;
        }

        const next = argv[i + 1];
        if (typeof next !== 'string' || next.startsWith('--')) {
            throw new Error(`Missing value for --${key}`);
        }
        i += 1;

        out[key] = spec.kind === 'number' ? parseNumberStrict(next, `--${key}`) : next;
    }

    return out;
}
