import { SERVER_EVENT_NAMES } from './server-event-names';

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
    void env;

    try {
        const wsEsm = await importWsEsm();
        emitStructuredEvent('info', SERVER_EVENT_NAMES.ESM_WS_RUNTIME_MODE, {
            mode: 'esm',
            status: 'ok',
        });

        return {
            dependencies: createRuntimeDependencies({
                ws: wsEsm.default,
            }),
        };
    } catch (error) {
        emitStructuredEvent('error', SERVER_EVENT_NAMES.ESM_WS_RUNTIME_MODE, {
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
