import fs from 'node:fs/promises';

type ConfigObject = Record<string, unknown>;
type ReadFileFn = (
    path: string,
    options?: BufferEncoding | { encoding?: BufferEncoding | null }
) => Promise<string | Buffer>;

const defaultReadFile: ReadFileFn = (path, options) =>
    fs.readFile(path, options as BufferEncoding | { encoding?: BufferEncoding | null }) as Promise<string | Buffer>;

export async function loadConfigFile(configPath: string, readFileFn: ReadFileFn = defaultReadFile): Promise<ConfigObject | null> {
    const BunRuntime = globalThis.Bun;
    if (readFileFn === defaultReadFile && BunRuntime && typeof BunRuntime.file === 'function') {
        try {
            const file = BunRuntime.file(configPath);
            if (!(await file.exists())) {
                return null;
            }
            return (await file.json()) as ConfigObject;
        } catch (_) {
            return null;
        }
    }

    try {
        const raw = await readFileFn(configPath, 'utf8');
        const rawText = typeof raw === 'string' ? raw : raw.toString('utf8');
        return JSON.parse(rawText);
    } catch (_) {
        return null;
    }
}

export async function resolveActiveConfig({
    defaultConfigPath,
    customConfigPath,
    loadConfigFileFn = loadConfigFile,
}: {
    defaultConfigPath: string;
    customConfigPath: string;
    loadConfigFileFn?: (path: string) => Promise<ConfigObject | null>;
}): Promise<{ defaultConfig: ConfigObject | null; localConfig: ConfigObject | null; activeConfig: ConfigObject | null }> {
    const defaultConfig = await loadConfigFileFn(defaultConfigPath);
    const localConfig = await loadConfigFileFn(customConfigPath);
    const activeConfig = localConfig || defaultConfig;

    return {
        defaultConfig,
        localConfig,
        activeConfig,
    };
}

export default {
    loadConfigFile,
    resolveActiveConfig,
};
