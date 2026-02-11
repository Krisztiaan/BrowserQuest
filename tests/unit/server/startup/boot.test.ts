import { expect, test } from 'bun:test';
import { runEntryBoot } from '../../../../server/startup/boot';

test('boot envelope resolves config and starts runtime when preflight succeeds', async () => {
    const activeConfig = { port: 8000 };
    const calls: string[] = [];

    const result = await runEntryBoot({
        defaultConfigPath: './server/config.json',
        customConfigPath: './server/config_local.json',
        validateConfig: () => ({ isValid: true, errors: [] }),
        limitUtf8Bytes: (text) => text,
        emitError: () => {
            // no-op
        },
        fail: () => {
            // no-op
        },
        startupParams: { env: {} },
        resolveActiveConfigFn: async () => ({ activeConfig }),
        ensureConfigSourcePresentFn: ({ activeConfig: resolvedConfig }) => {
            calls.push('source');
            return Boolean(resolvedConfig);
        },
        ensureConfigPreflightValidFn: ({ activeConfig: validatedConfig }) => {
            calls.push('preflight');
            return Boolean(validatedConfig);
        },
        runStartupFn: async ({ activeConfig: bootConfig }) => {
            calls.push('startup');
            expect(bootConfig).toBe(activeConfig);
        },
    });

    expect(calls).toEqual(['source', 'preflight', 'startup']);
    expect(result).toEqual({ activeConfig, started: true });
});

test('boot envelope aborts before startup when no config is resolved', async () => {
    const calls: string[] = [];

    const result = await runEntryBoot({
        defaultConfigPath: './server/config.json',
        customConfigPath: './server/config_local.json',
        validateConfig: () => ({ isValid: true, errors: [] }),
        limitUtf8Bytes: (text) => text,
        emitError: () => {
            // no-op
        },
        fail: () => {
            // no-op
        },
        startupParams: {},
        resolveActiveConfigFn: async () => ({ activeConfig: null }),
        ensureConfigSourcePresentFn: () => {
            calls.push('source');
            return false;
        },
        ensureConfigPreflightValidFn: () => {
            calls.push('preflight');
            return true;
        },
        runStartupFn: async () => {
            calls.push('startup');
        },
    });

    expect(calls).toEqual(['source']);
    expect(result).toEqual({ activeConfig: null, started: false });
});

test('boot envelope aborts before startup when preflight validation fails', async () => {
    const activeConfig = { port: 'invalid' };
    const calls: string[] = [];

    const result = await runEntryBoot({
        defaultConfigPath: './server/config.json',
        customConfigPath: './server/config_local.json',
        validateConfig: () => ({ isValid: false, errors: [{ field: 'port' }] }),
        limitUtf8Bytes: (text) => text,
        emitError: () => {
            // no-op
        },
        fail: () => {
            // no-op
        },
        startupParams: {},
        resolveActiveConfigFn: async () => ({ activeConfig }),
        ensureConfigSourcePresentFn: () => {
            calls.push('source');
            return true;
        },
        ensureConfigPreflightValidFn: () => {
            calls.push('preflight');
            return false;
        },
        runStartupFn: async () => {
            calls.push('startup');
        },
    });

    expect(calls).toEqual(['source', 'preflight']);
    expect(result).toEqual({ activeConfig, started: false });
});
