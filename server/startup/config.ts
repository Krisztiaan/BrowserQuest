import fs from 'node:fs/promises';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
type ConfigObject = Record<string, JsonValue>;
type ReadFileFn = (
    path: string,
    options?: BufferEncoding | { encoding?: BufferEncoding | null }
) => Promise<string | Buffer>;

const defaultReadFile: ReadFileFn = (path, options) =>
    fs.readFile(path, options as BufferEncoding | { encoding?: BufferEncoding | null }) as Promise<string | Buffer>;

function isConfigObject(value: JsonValue | object | null | undefined): value is ConfigObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function loadConfigFile(configPath: string, readFileFn: ReadFileFn = defaultReadFile): Promise<ConfigObject | null> {
    const BunRuntime = 'Bun' in globalThis ? globalThis.Bun : undefined;
    if (readFileFn === defaultReadFile && BunRuntime && typeof BunRuntime.file === 'function') {
        try {
            const file = BunRuntime.file(configPath);
            if (!(await file.exists())) {
                return null;
            }
            const parsed = (await file.json()) as JsonValue;
            return isConfigObject(parsed) ? parsed : null;
        } catch (_) {
            return null;
        }
    }

    try {
        const raw = await readFileFn(configPath, 'utf8');
        const rawText = typeof raw === 'string' ? raw : raw.toString('utf8');
        const parsed = JSON.parse(rawText) as JsonValue;
        return isConfigObject(parsed) ? parsed : null;
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
    const activeConfig = localConfig ?? defaultConfig;

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
