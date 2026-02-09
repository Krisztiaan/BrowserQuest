import fs from 'node:fs/promises';

/**
 * @param {string} configPath
 * @param {(path: string, options?: BufferEncoding | { encoding?: BufferEncoding | null }) => Promise<string | Buffer>} [readFileFn]
 * @returns {Promise<object|null>}
 */
export async function loadConfigFile(configPath, readFileFn = fs.readFile) {
    const BunRuntime = globalThis.Bun;
    if (readFileFn === fs.readFile && BunRuntime && typeof BunRuntime.file === 'function') {
        try {
            const file = BunRuntime.file(configPath);
            if (!(await file.exists())) {
                return null;
            }
            return await file.json();
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

/**
 * @param {object} params
 * @param {string} params.defaultConfigPath
 * @param {string} params.customConfigPath
 * @param {(path: string) => Promise<object|null>} [params.loadConfigFileFn]
 * @returns {Promise<{ defaultConfig: object|null, localConfig: object|null, activeConfig: object|null }>}
 */
export async function resolveActiveConfig({ defaultConfigPath, customConfigPath, loadConfigFileFn = loadConfigFile }) {
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
