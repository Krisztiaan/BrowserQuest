import { expect, test } from 'bun:test';
import { resolveRuntimeOptions } from '../../../../server/startup/options';

test('startup runtime options always inject runtime websocket runtime through dependency seam', async () => {
    const events: Array<Record<string, unknown>> = [];
    const wsDefault = { id: 'ws-runtime-default' };
    const runtimeDependencies = { id: 'runtime-dependencies' };
    let receivedOverrides: Record<string, unknown> | null = null;
    let failCode: number | null = null;

    const runtimeOptions = await resolveRuntimeOptions({
        env: {},
        emitStructuredEvent: (level, event, fields) => {
            events.push({ level, event, ...fields });
        },
        importWsRuntime: () => Promise.resolve({ default: wsDefault }),
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
        event: 'server.runtime.ws_runtime_mode',
        mode: 'runtime',
        status: 'ok',
    });
});

test('startup runtime options ignore removed runtime-mode env toggles', async () => {
    const events: Array<Record<string, unknown>> = [];

    const runtimeOptions = await resolveRuntimeOptions({
        env: {
            BQ_WS_RUNTIME: '0',
            BQ_WS_RUNTIME_FORCE_FAIL: '1',
        },
        emitStructuredEvent: (level, event, fields) => {
            events.push({ level, event, ...fields });
        },
        importWsRuntime: () => Promise.resolve({ default: { id: 'ws-runtime-default' } }),
        createRuntimeDependencies: () => ({ id: 'runtime-deps' }),
        fail: () => {
            // no-op
        },
    });

    expect(runtimeOptions).toEqual({ dependencies: { id: 'runtime-deps' } });
    expect(events.length).toBe(1);
    expect(events[0]).toMatchObject({
        level: 'info',
        event: 'server.runtime.ws_runtime_mode',
        mode: 'runtime',
        status: 'ok',
    });
});

test('startup runtime options emit load-error diagnostics when runtime websocket runtime import fails', async () => {
    const events: Array<Record<string, unknown>> = [];
    let failCode: number | null = null;

    const runtimeOptions = await resolveRuntimeOptions({
        env: {},
        emitStructuredEvent: (level, event, fields) => {
            events.push({ level, event, ...fields });
        },
        importWsRuntime: () => Promise.reject(new Error('ws_import_failed')),
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
        event: 'server.runtime.ws_runtime_mode',
        mode: 'runtime',
        status: 'failed',
        reason: 'load_error',
    });
    expect(String(events[0].error)).toContain('ws_import_failed');
});
