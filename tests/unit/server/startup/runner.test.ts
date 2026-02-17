import { expect, test } from 'bun:test';
import { runStartup } from '../../../../server/startup/runner';

test('startup runner executes bridge probe, runtime-option resolution, and startServer in order', async () => {
    const activeConfig = { port: 8000 };
    const runtimeOptions = { dependencies: { ws: { id: 'ws-runtime' } } };
    const calls: string[] = [];
    let startArgs: { config: object; options: { dependencies: { ws: { id: string } } } | undefined } | null = null;

    const result = await runStartup({
        activeConfig,
        env: {},
        emitStructuredEvent: () => {
            // no-op
        },
        emitProbeEvent: () => {
            // no-op
        },
        importWsRuntime: () => Promise.resolve({ default: { id: 'ws-runtime-default' } }),
        createRuntimeDependencies: () => ({ id: 'runtime-deps' }),
        startServer: (config, options) => {
            calls.push('start');
            startArgs = { config, options };
        },
        fail: () => {
            // no-op
        },
        runBridgeProbeFn: () => {
            calls.push('bridge');
            return Promise.resolve();
        },
        runEcsSchedulerProbeFn: () => {
            calls.push('ecs');
            return Promise.resolve();
        },
        resolveRuntimeOptionsFn: () => {
            calls.push('runtime');
            return Promise.resolve(runtimeOptions);
        },
    });

    expect(calls).toEqual(['bridge', 'ecs', 'runtime', 'start']);
    expect(startArgs).toEqual({ config: activeConfig, options: runtimeOptions });
    expect(result).toEqual({ runtimeOptions });
});

test('startup runner passes undefined runtime options through to startServer when resolver returns undefined', async () => {
    const activeConfig = { port: 8001 };
    let startedOptions: object | undefined = { marker: 'unset' };

    const result = await runStartup({
        activeConfig,
        env: {},
        emitStructuredEvent: () => {
            // no-op
        },
        emitProbeEvent: () => {
            // no-op
        },
        importWsRuntime: () => Promise.resolve({ default: { id: 'ws-runtime-default' } }),
        createRuntimeDependencies: () => ({ id: 'runtime-deps' }),
        startServer: (_, options) => {
            startedOptions = options;
        },
        fail: () => {
            // no-op
        },
        runBridgeProbeFn: () => Promise.resolve(),
        runEcsSchedulerProbeFn: () => Promise.resolve(),
        resolveRuntimeOptionsFn: () => Promise.resolve(undefined),
    });

    expect(startedOptions).toBeUndefined();
    expect(result).toEqual({ runtimeOptions: undefined });
});
