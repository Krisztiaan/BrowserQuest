import { resolveActiveConfig } from './main-esm-config-source';
import { ensureConfigPreflightValid, ensureConfigSourcePresent } from './main-esm-preflight-failures';
import { runStartupWithConfig } from './main-esm-startup-runner';

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
}: {
    defaultConfigPath: string;
    customConfigPath: string;
    validateConfig: (config: object) => { isValid: boolean; errors: unknown[] };
    limitUtf8Bytes: (text: string, maxBytes: number) => string;
    emitError: (message: string) => void;
    fail: (code: number) => void;
    startupParams: Record<string, unknown>;
    resolveActiveConfigFn?: (params: {
        defaultConfigPath: string;
        customConfigPath: string;
    }) => Promise<{ activeConfig: object | null }>;
    ensureConfigSourcePresentFn?: (params: {
        activeConfig: object | null;
        emitError: (message: string) => void;
        fail: (code: number) => void;
    }) => boolean;
    ensureConfigPreflightValidFn?: (params: {
        activeConfig: object;
        validateConfig: (config: object) => { isValid: boolean; errors: unknown[] };
        limitUtf8Bytes: (text: string, maxBytes: number) => string;
        emitError: (message: string) => void;
        fail: (code: number) => void;
    }) => boolean;
    runStartupWithConfigFn?: (params: Record<string, unknown>) => Promise<unknown>;
}): Promise<{ activeConfig: object | null; started: boolean }> {
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
