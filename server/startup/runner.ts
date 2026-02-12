import { runBridgeProbeIfEnabled } from './bridge-probe';
import { runEcsSchedulerProbeIfEnabled } from './ecs-scheduler-probe';
import { resolveRuntimeOptions } from './options';
import { getPluginSpecsFromConfig, loadServerPlugins, wrapWorldServerConstructorWithPlugins } from '../plugins/loader';
import type { RuntimeWorldServerConstructor } from '../runtime-types';

type BridgeProbeParams = Parameters<typeof runBridgeProbeIfEnabled>[0];
type EcsProbeParams = Parameters<typeof runEcsSchedulerProbeIfEnabled>[0];
type StartupWsImport = () => Promise<{ default: unknown; [key: string]: unknown }>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function runStartup({
    activeConfig,
    env,
    cwd,
    emitStructuredEvent,
    emitProbeEvent,
    importWsRuntime,
    createRuntimeDependencies,
    startServer,
    fail,
    runBridgeProbeFn = runBridgeProbeIfEnabled,
    runEcsSchedulerProbeFn = runEcsSchedulerProbeIfEnabled,
    resolveRuntimeOptionsFn = resolveRuntimeOptions,
}: {
    activeConfig: object;
    env: NodeJS.ProcessEnv;
    cwd?: string;
    emitStructuredEvent: (level: string, event: string, fields: Record<string, unknown>) => void;
    emitProbeEvent: (level: string, fields: Record<string, unknown>) => void;
    importWsRuntime: StartupWsImport;
    createRuntimeDependencies: (overrides: object) => unknown;
    startServer: (config: object, runtimeOptions?: unknown) => void;
    fail: (code: number) => void;
    runBridgeProbeFn?: (params: BridgeProbeParams) => Promise<void>;
    runEcsSchedulerProbeFn?: (params: EcsProbeParams) => Promise<void>;
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

    await runEcsSchedulerProbeFn({
        env,
        emitProbeEvent,
        fail,
    });

    const runtimeOptions = await resolveRuntimeOptionsFn({
        env,
        emitStructuredEvent,
        importWsRuntime,
        createRuntimeDependencies,
        fail,
    });

    const pluginSpecs = getPluginSpecsFromConfig(activeConfig);
    let effectiveRuntimeOptions: unknown = runtimeOptions;

    if (pluginSpecs.length > 0) {
        try {
            const plugins = await loadServerPlugins(pluginSpecs, { baseDir: cwd ?? process.cwd() });

            const optionsObject = isPlainObject(runtimeOptions) ? runtimeOptions : {};
            const dependencies = isPlainObject(optionsObject.dependencies) ? optionsObject.dependencies : {};
            const resolvedDependencies = createRuntimeDependencies(dependencies) as { WorldServer?: unknown };
            const baseWorldServer = resolvedDependencies.WorldServer;
            if (typeof baseWorldServer !== 'function') {
                throw new Error('Runtime dependency seam did not provide a constructable WorldServer.');
            }

            effectiveRuntimeOptions = {
                ...optionsObject,
                dependencies: {
                    ...dependencies,
                    WorldServer: wrapWorldServerConstructorWithPlugins(
                        baseWorldServer as unknown as RuntimeWorldServerConstructor,
                        plugins
                    ),
                },
            };

            emitStructuredEvent('info', 'startup_plugins_loaded', {
                plugins: plugins.map((plugin) => plugin.id),
            });
        } catch (err) {
            emitStructuredEvent('error', 'startup_plugins_load_failed', {
                specs: pluginSpecs,
                error: String(err),
            });
            fail(1);
            return { runtimeOptions };
        }
    }

    startServer(activeConfig, effectiveRuntimeOptions);

    return { runtimeOptions: effectiveRuntimeOptions };
}

export default {
    runStartup,
};
