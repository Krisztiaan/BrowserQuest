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
        resolveActiveConfigFn: () => Promise.resolve({ activeConfig }),
        ensureConfigSourcePresentFn: ({ activeConfig: resolvedConfig }) => {
            calls.push('source');
            return Boolean(resolvedConfig);
        },
        ensureConfigPreflightValidFn: ({ activeConfig: validatedConfig }) => {
            calls.push('preflight');
            return Boolean(validatedConfig);
        },
        runStartupFn: ({ activeConfig: bootConfig }) => {
            calls.push('startup');
            expect(bootConfig).toBe(activeConfig);
            return Promise.resolve();
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
        resolveActiveConfigFn: () => Promise.resolve({ activeConfig: null }),
        ensureConfigSourcePresentFn: () => {
            calls.push('source');
            return false;
        },
        ensureConfigPreflightValidFn: () => {
            calls.push('preflight');
            return true;
        },
        runStartupFn: () => {
            calls.push('startup');
            return Promise.resolve();
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
        resolveActiveConfigFn: () => Promise.resolve({ activeConfig }),
        ensureConfigSourcePresentFn: () => {
            calls.push('source');
            return true;
        },
        ensureConfigPreflightValidFn: () => {
            calls.push('preflight');
            return false;
        },
        runStartupFn: () => {
            calls.push('startup');
            return Promise.resolve();
        },
    });

    expect(calls).toEqual(['source', 'preflight']);
    expect(result).toEqual({ activeConfig, started: false });
});
