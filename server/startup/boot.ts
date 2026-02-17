import { resolveActiveConfig } from './config';
import { ensureConfigPreflightValid, ensureConfigSourcePresent, ensureMapPreflightValid } from './preflight';
import { runStartup } from './runner';
import type { ServerConfig } from '../runtime-types';

type ConfigValidationIssue = Readonly<{
    field: string;
    reason: string;
}>;
type StartupParams = Omit<Parameters<typeof runStartup>[0], 'activeConfig'>;
type StartupResult = Awaited<ReturnType<typeof runStartup>>;
type ConfigValidationResult = { isValid: boolean; errors: ConfigValidationIssue[] };

export async function runEntryBoot<TStartupParams extends StartupParams>({
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
    runStartupFn = runStartup,
    ensureMapPreflightValidFn = ensureMapPreflightValid,
}: {
    defaultConfigPath: string;
    customConfigPath: string;
    validateConfig: (config: object) => ConfigValidationResult;
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
        validateConfig: (config: object) => ConfigValidationResult;
        limitUtf8Bytes: (text: string, maxBytes: number) => string;
        emitError: (message: string) => void;
        fail: (code: number) => void;
    }) => boolean;
    runStartupFn?: (params: { activeConfig: ServerConfig } & TStartupParams) => Promise<StartupResult>;
    ensureMapPreflightValidFn?: (params: {
        activeConfig: object;
        emitError: (message: string) => void;
        fail: (code: number) => void;
    }) => Promise<boolean>;
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

    const hasValidMap = await ensureMapPreflightValidFn({
        activeConfig,
        emitError,
        fail,
    });
    if (!hasValidMap) {
        return { activeConfig, started: false };
    }

    await runStartupFn({
        activeConfig: activeConfig as ServerConfig,
        ...startupParams,
    });

    return { activeConfig, started: true };
}

export default {
    runEntryBoot,
};
