import { resolveActiveConfig } from './main-esm-config-source.mjs';
import { ensureConfigPreflightValid, ensureConfigSourcePresent } from './main-esm-preflight-failures.mjs';
import { runStartupWithConfig } from './main-esm-startup-runner.mjs';

/**
 * @param {object} params
 * @param {string} params.defaultConfigPath
 * @param {string} params.customConfigPath
 * @param {(config: object) => { isValid: boolean, errors: unknown[] }} params.validateConfig
 * @param {(text: string, maxBytes: number) => string} params.limitUtf8Bytes
 * @param {(message: string) => void} params.emitError
 * @param {(code: number) => void} params.fail
 * @param {object} params.startupParams
 * @param {(params: object) => Promise<{ activeConfig: object | null }>} [params.resolveActiveConfigFn]
 * @param {(params: object) => boolean} [params.ensureConfigSourcePresentFn]
 * @param {(params: object) => boolean} [params.ensureConfigPreflightValidFn]
 * @param {(params: object) => Promise<unknown>} [params.runStartupWithConfigFn]
 * @returns {Promise<{ activeConfig: object | null, started: boolean }>}
 */
export async function runMainEsmBootEnvelope({
    defaultConfigPath,
    customConfigPath,
    validateConfig,
    limitUtf8Bytes,
    emitError,
    fail,
    startupParams,
    resolveActiveConfigFn = resolveActiveConfig,
    ensureConfigSourcePresentFn = ensureConfigSourcePresent,
    ensureConfigPreflightValidFn = ensureConfigPreflightValid,
    runStartupWithConfigFn = runStartupWithConfig,
}) {
    const configSource = await resolveActiveConfigFn({
        defaultConfigPath,
        customConfigPath,
    });
    const activeConfig = configSource.activeConfig;

    const hasConfig = ensureConfigSourcePresentFn({
        activeConfig,
        emitError,
        fail,
    });
    if (!hasConfig) {
        return { activeConfig, started: false };
    }

    const hasValidConfig = ensureConfigPreflightValidFn({
        activeConfig,
        validateConfig,
        limitUtf8Bytes,
        emitError,
        fail,
    });
    if (!hasValidConfig) {
        return { activeConfig, started: false };
    }

    await runStartupWithConfigFn({
        activeConfig,
        ...startupParams,
    });

    return { activeConfig, started: true };
}

export default {
    runMainEsmBootEnvelope,
};
