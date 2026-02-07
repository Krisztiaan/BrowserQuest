import fs from 'node:fs/promises';

/**
 * @param {string} configPath
 * @param {(path: string, encoding: string) => Promise<string>} [readFileFn]
 * @returns {Promise<object|null>}
 */
export async function loadConfigFile(configPath, readFileFn = fs.readFile) {
    try {
        const raw = await readFileFn(configPath, 'utf8');
        return JSON.parse(raw);
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
