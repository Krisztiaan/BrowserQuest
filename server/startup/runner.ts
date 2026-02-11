import { runWebSocketBridgeProbeIfEnabled } from './bridge-probe';
import { resolveStartupRuntimeOptions } from './options';

type BridgeProbeParams = Parameters<typeof runWebSocketBridgeProbeIfEnabled>[0];
type StartupWsImport = () => Promise<{ default: unknown; [key: string]: unknown }>;

export async function runStartupWithConfig({
    activeConfig,
    env,
    emitStructuredEvent,
    emitProbeEvent,
    importWsRuntime,
    createRuntimeDependencies,
    startServer,
    fail,
    runBridgeProbeFn = runWebSocketBridgeProbeIfEnabled,
    resolveRuntimeOptionsFn = resolveStartupRuntimeOptions,
}: {
    activeConfig: object;
    env: NodeJS.ProcessEnv;
    emitStructuredEvent: (level: string, event: string, fields: Record<string, unknown>) => void;
    emitProbeEvent: (level: string, fields: Record<string, unknown>) => void;
    importWsRuntime: StartupWsImport;
    createRuntimeDependencies: (overrides: object) => unknown;
    startServer: (config: object, runtimeOptions?: unknown) => void;
    fail: (code: number) => void;
    runBridgeProbeFn?: (params: BridgeProbeParams) => Promise<void>;
    resolveRuntimeOptionsFn?: (params: {
        env: NodeJS.ProcessEnv;
        emitStructuredEvent: (level: string, event: string, fields: Record<string, unknown>) => void;
        importWsRuntime: StartupWsImport;
        createRuntimeDependencies: (overrides: object) => unknown;
        fail: (code: number) => void;
    }) => Promise<unknown>;
}): Promise<{ runtimeOptions: unknown }> {
    await runBridgeProbeFn({
        env,
        emitProbeEvent,
        importWsRuntime: importWsRuntime as BridgeProbeParams['importWsRuntime'],
        fail,
    });

    const runtimeOptions = await resolveRuntimeOptionsFn({
        env,
        emitStructuredEvent,
        importWsRuntime,
        createRuntimeDependencies,
        fail,
    });

    startServer(activeConfig, runtimeOptions);

    return { runtimeOptions };
}

export default {
    runStartupWithConfig,
};
