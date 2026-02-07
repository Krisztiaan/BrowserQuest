/**
 * Resolve opt-in startup runtime options for ESM entry.
 *
 * @param {object} params
 * @param {NodeJS.ProcessEnv} params.env
 * @param {(level: string, event: string, fields: Record<string, unknown>) => void} params.emitStructuredEvent
 * @param {() => Promise<{ default: unknown }>} params.importWsEsm
 * @param {(overrides: object) => unknown} params.createRuntimeDependencies
 * @param {(code: number) => void} params.fail
 * @returns {Promise<{ dependencies: unknown } | undefined>}
 */
export async function resolveStartupRuntimeOptions({
    env,
    emitStructuredEvent,
    importWsEsm,
    createRuntimeDependencies,
    fail,
}) {
    if (env.BQ_ESM_WS_RUNTIME !== '1') {
        return undefined;
    }

    if (env.BQ_ESM_WS_RUNTIME_FORCE_FAIL === '1') {
        emitStructuredEvent('error', 'server.esm.ws_runtime_mode', {
            mode: 'esm',
            status: 'failed',
            reason: 'forced_failure',
        });
        fail(1);
        return undefined;
    }

    try {
        const wsEsm = await importWsEsm();
        emitStructuredEvent('info', 'server.esm.ws_runtime_mode', {
            mode: 'esm',
            status: 'ok',
        });

        return {
            dependencies: createRuntimeDependencies({
                ws: wsEsm.default,
            }),
        };
    } catch (error) {
        emitStructuredEvent('error', 'server.esm.ws_runtime_mode', {
            mode: 'esm',
            status: 'failed',
            reason: 'load_error',
            error: String(error),
        });
        fail(1);
        return undefined;
    }
}

export default {
    resolveStartupRuntimeOptions,
};
