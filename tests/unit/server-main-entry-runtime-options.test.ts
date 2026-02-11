import { expect, test } from 'bun:test';
import { resolveStartupRuntimeOptions } from '../../server/main/runtime-options';

test('startup runtime options always inject esm websocket runtime through dependency seam', async () => {
    const events: Array<Record<string, unknown>> = [];
    const wsDefault = { id: 'ws-esm-default' };
    const runtimeDependencies = { id: 'runtime-dependencies' };
    let receivedOverrides: Record<string, unknown> | null = null;
    let failCode: number | null = null;

    const runtimeOptions = await resolveStartupRuntimeOptions({
        env: {},
        emitStructuredEvent: (level, event, fields) => {
            events.push({ level, event, ...fields });
        },
        importWsRuntime: async () => ({ default: wsDefault }),
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

test('startup runtime options ignore removed runtime-mode env toggles', async () => {
    const events: Array<Record<string, unknown>> = [];

    const runtimeOptions = await resolveStartupRuntimeOptions({
        env: {
            BQ_ESM_WS_RUNTIME: '0',
            BQ_ESM_WS_RUNTIME_FORCE_FAIL: '1',
        },
        emitStructuredEvent: (level, event, fields) => {
            events.push({ level, event, ...fields });
        },
        importWsRuntime: async () => ({ default: { id: 'ws-esm-default' } }),
        createRuntimeDependencies: () => ({ id: 'runtime-deps' }),
        fail: () => {
            // no-op
        },
    });

    expect(runtimeOptions).toEqual({ dependencies: { id: 'runtime-deps' } });
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
        env: {},
        emitStructuredEvent: (level, event, fields) => {
            events.push({ level, event, ...fields });
        },
        importWsRuntime: async () => {
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
