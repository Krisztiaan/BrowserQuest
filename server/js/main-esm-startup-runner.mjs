import { runWebSocketBridgeProbeIfEnabled } from './main-esm-bridge-probe.mjs';
import { resolveStartupRuntimeOptions } from './main-esm-runtime-options.mjs';

/**
 * @param {object} params
 * @param {object} params.activeConfig
 * @param {NodeJS.ProcessEnv} params.env
 * @param {(level: string, event: string, fields: Record<string, unknown>) => void} params.emitStructuredEvent
 * @param {(level: string, fields: Record<string, unknown>) => void} params.emitProbeEvent
 * @param {() => unknown} params.requireWsCjs
 * @param {() => Promise<{ default: unknown }>} params.importWsEsm
 * @param {(overrides: object) => unknown} params.createRuntimeDependencies
 * @param {(config: object, runtimeOptions?: unknown) => void} params.startServer
 * @param {(code: number) => void} params.fail
 * @param {(params: object) => Promise<void>} [params.runBridgeProbeFn]
 * @param {(params: object) => Promise<unknown>} [params.resolveRuntimeOptionsFn]
 * @returns {Promise<{ runtimeOptions: unknown }>}
 */
export async function runStartupWithConfig({
    activeConfig,
    env,
    emitStructuredEvent,
    emitProbeEvent,
    requireWsCjs,
    importWsEsm,
    createRuntimeDependencies,
    startServer,
    fail,
    runBridgeProbeFn = runWebSocketBridgeProbeIfEnabled,
    resolveRuntimeOptionsFn = resolveStartupRuntimeOptions,
}) {
    await runBridgeProbeFn({
        env,
        emitProbeEvent,
        requireWsCjs,
        importWsEsm,
        fail,
    });

    const runtimeOptions = await resolveRuntimeOptionsFn({
        env,
        emitStructuredEvent,
        importWsEsm,
        createRuntimeDependencies,
        fail,
    });

    startServer(activeConfig, runtimeOptions);

    return { runtimeOptions };
}

export default {
    runStartupWithConfig,
};
