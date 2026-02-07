import { expect, test } from 'bun:test';
import { runStartupWithConfig } from '../../server/js/main-esm-startup-runner.mjs';

test('startup runner executes bridge probe, runtime-option resolution, and startServer in order', async () => {
    const activeConfig = { port: 8000 };
    const runtimeOptions = { dependencies: { ws: { id: 'ws-esm' } } };
    const calls: string[] = [];
    let startArgs: { config: unknown; options: unknown } | null = null;

    const result = await runStartupWithConfig({
        activeConfig,
        env: { BQ_ESM_WS_RUNTIME: '1' },
        emitStructuredEvent: () => {
            // no-op
        },
        emitProbeEvent: () => {
            // no-op
        },
        requireWsCjs: () => ({ CLOSE_CODES: { NORMAL: 1000, UNSUPPORTED_DATA: 1003, INVALID_PAYLOAD: 1007 } }),
        importWsEsm: async () => ({ default: { id: 'ws-esm-default' } }),
        createRuntimeDependencies: () => ({ id: 'runtime-deps' }),
        startServer: (config, options) => {
            calls.push('start');
            startArgs = { config, options };
        },
        fail: () => {
            // no-op
        },
        runBridgeProbeFn: async () => {
            calls.push('bridge');
        },
        resolveRuntimeOptionsFn: async () => {
            calls.push('runtime');
            return runtimeOptions;
        },
    });

    expect(calls).toEqual(['bridge', 'runtime', 'start']);
    expect(startArgs).toEqual({ config: activeConfig, options: runtimeOptions });
    expect(result).toEqual({ runtimeOptions });
});

test('startup runner passes undefined runtime options through to startServer when resolver returns undefined', async () => {
    const activeConfig = { port: 8001 };
    let startedOptions: unknown = 'unset';

    const result = await runStartupWithConfig({
        activeConfig,
        env: {},
        emitStructuredEvent: () => {
            // no-op
        },
        emitProbeEvent: () => {
            // no-op
        },
        requireWsCjs: () => ({ CLOSE_CODES: { NORMAL: 1000, UNSUPPORTED_DATA: 1003, INVALID_PAYLOAD: 1007 } }),
        importWsEsm: async () => ({ default: { id: 'ws-esm-default' } }),
        createRuntimeDependencies: () => ({ id: 'runtime-deps' }),
        startServer: (_, options) => {
            startedOptions = options;
        },
        fail: () => {
            // no-op
        },
        runBridgeProbeFn: async () => {
            // no-op
        },
        resolveRuntimeOptionsFn: async () => undefined,
    });

    expect(startedOptions).toBeUndefined();
    expect(result).toEqual({ runtimeOptions: undefined });
});
