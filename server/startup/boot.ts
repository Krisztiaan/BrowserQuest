import { resolveActiveConfig } from './config';
import { ensureConfigPreflightValid, ensureConfigSourcePresent } from './preflight';
import { runStartupWithConfig } from './runner';

export async function runMainEntryBootEnvelope<TStartupParams extends Record<string, unknown>>({
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
    runStartupWithConfigFn = runStartupWithConfig as unknown as (
        params: { activeConfig: object } & TStartupParams
    ) => Promise<unknown>,
}: {
    defaultConfigPath: string;
    customConfigPath: string;
    validateConfig: (config: object) => { isValid: boolean; errors: unknown[] };
    limitUtf8Bytes: (text: string, maxBytes: number) => string;
    emitError: (message: string) => void;
    fail: (code: number) => void;
    startupParams: TStartupParams;
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
    runStartupWithConfigFn?: (params: { activeConfig: object } & TStartupParams) => Promise<unknown>;
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

    if (!activeConfig) {
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
    } as { activeConfig: object } & TStartupParams);

    return { activeConfig, started: true };
}

export default {
    runMainEntryBootEnvelope,
};
