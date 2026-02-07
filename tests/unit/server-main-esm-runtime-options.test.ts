import { expect, test } from 'bun:test';
import { resolveStartupRuntimeOptions } from '../../server/js/main-esm-runtime-options.mjs';

test('startup runtime options return undefined when esm runtime mode is disabled', async () => {
    const events: Array<Record<string, unknown>> = [];
    let dependencyFactoryCalls = 0;
    let failCode: number | null = null;

    const runtimeOptions = await resolveStartupRuntimeOptions({
        env: {},
        emitStructuredEvent: (level, event, fields) => {
            events.push({ level, event, ...fields });
        },
        importWsEsm: async () => {
            throw new Error('should_not_import');
        },
        createRuntimeDependencies: () => {
            dependencyFactoryCalls += 1;
            return {};
        },
        fail: (code) => {
            failCode = code;
        },
    });

    expect(runtimeOptions).toBeUndefined();
    expect(events).toEqual([]);
    expect(dependencyFactoryCalls).toBe(0);
    expect(failCode).toBeNull();
});

test('startup runtime options emit forced failure diagnostics and fail fast', async () => {
    const events: Array<Record<string, unknown>> = [];
    let failCode: number | null = null;

    const runtimeOptions = await resolveStartupRuntimeOptions({
        env: {
            BQ_ESM_WS_RUNTIME: '1',
            BQ_ESM_WS_RUNTIME_FORCE_FAIL: '1',
        },
        emitStructuredEvent: (level, event, fields) => {
            events.push({ level, event, ...fields });
        },
        importWsEsm: async () => ({ default: {} }),
        createRuntimeDependencies: () => ({}),
        fail: (code) => {
            failCode = code;
        },
    });

    expect(runtimeOptions).toBeUndefined();
    expect(failCode).toBe(1);
    expect(events.length).toBe(1);
    expect(events[0]).toMatchObject({
        level: 'error',
        event: 'server.esm.ws_runtime_mode',
        mode: 'esm',
        status: 'failed',
        reason: 'forced_failure',
    });
});

test('startup runtime options inject esm websocket runtime through dependency seam', async () => {
    const events: Array<Record<string, unknown>> = [];
    const wsDefault = { id: 'ws-esm-default' };
    const runtimeDependencies = { id: 'runtime-dependencies' };
    let receivedOverrides: Record<string, unknown> | null = null;
    let failCode: number | null = null;

    const runtimeOptions = await resolveStartupRuntimeOptions({
        env: {
            BQ_ESM_WS_RUNTIME: '1',
        },
        emitStructuredEvent: (level, event, fields) => {
            events.push({ level, event, ...fields });
        },
        importWsEsm: async () => ({ default: wsDefault }),
        createRuntimeDependencies: (overrides) => {
            receivedOverrides = overrides as Record<string, unknown>;
            return runtimeDependencies;
        },
        fail: (code) => {
            failCode = code;
        },
    });

    expect(failCode).toBeNull();
    expect(receivedOverrides).toEqual({ ws: wsDefault });
    expect(runtimeOptions).toEqual({ dependencies: runtimeDependencies });
    expect(events.length).toBe(1);
    expect(events[0]).toMatchObject({
        level: 'info',
        event: 'server.esm.ws_runtime_mode',
        mode: 'esm',
        status: 'ok',
    });
});

test('startup runtime options emit load-error diagnostics when esm websocket runtime import fails', async () => {
    const events: Array<Record<string, unknown>> = [];
    let failCode: number | null = null;

    const runtimeOptions = await resolveStartupRuntimeOptions({
        env: {
            BQ_ESM_WS_RUNTIME: '1',
        },
        emitStructuredEvent: (level, event, fields) => {
            events.push({ level, event, ...fields });
        },
        importWsEsm: async () => {
            throw new Error('ws_import_failed');
        },
        createRuntimeDependencies: () => ({}),
        fail: (code) => {
            failCode = code;
        },
    });

    expect(runtimeOptions).toBeUndefined();
    expect(failCode).toBe(1);
    expect(events.length).toBe(1);
    expect(events[0]).toMatchObject({
        level: 'error',
        event: 'server.esm.ws_runtime_mode',
        mode: 'esm',
        status: 'failed',
        reason: 'load_error',
    });
    expect(String(events[0].error)).toContain('ws_import_failed');
});
