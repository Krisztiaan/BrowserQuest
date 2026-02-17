import { runBridgeProbeIfEnabled } from './bridge-probe';
import { runEcsSchedulerProbeIfEnabled } from './ecs-scheduler-probe';
import { resolveRuntimeOptions, type StartupRuntimeOptions } from './options';
import { getPluginSpecsFromConfig, loadServerPlugins, wrapWorldServerConstructorWithPlugins } from '../plugins/loader';
import type {
    MainRuntimeDependencies,
    MainRuntimeDependencyOverrides,
    RuntimeEventFields,
    RuntimeWorldServerConstructor,
    ServerConfig,
} from '../runtime-types';

type BridgeProbeParams = Parameters<typeof runBridgeProbeIfEnabled>[0];
type EcsProbeParams = Parameters<typeof runEcsSchedulerProbeIfEnabled>[0];
type StartupWsImport = Parameters<typeof resolveRuntimeOptions>[0]['importWsRuntime'];
type RuntimeOptionsLike = StartupRuntimeOptions;

function isRuntimeWorldServerConstructor(value: object | null | undefined): value is RuntimeWorldServerConstructor {
    return typeof value === 'function';
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
    activeConfig: ServerConfig;
    env: NodeJS.ProcessEnv;
    cwd?: string;
    emitStructuredEvent: (level: string, event: string, fields: RuntimeEventFields) => void;
    emitProbeEvent: (level: string, fields: RuntimeEventFields) => void;
    importWsRuntime: StartupWsImport;
    createRuntimeDependencies: (overrides: MainRuntimeDependencyOverrides) => MainRuntimeDependencies;
    startServer: (config: ServerConfig, runtimeOptions?: RuntimeOptionsLike) => void;
    fail: (code: number) => void;
    runBridgeProbeFn?: (params: BridgeProbeParams) => Promise<void>;
    runEcsSchedulerProbeFn?: (params: EcsProbeParams) => Promise<void>;
    resolveRuntimeOptionsFn?: (params: {
        env: NodeJS.ProcessEnv;
        emitStructuredEvent: (level: string, event: string, fields: RuntimeEventFields) => void;
        importWsRuntime: StartupWsImport;
        createRuntimeDependencies: (overrides: MainRuntimeDependencyOverrides) => MainRuntimeDependencies;
        fail: (code: number) => void;
    }) => Promise<RuntimeOptionsLike | undefined>;
}): Promise<{ runtimeOptions: RuntimeOptionsLike | undefined }> {
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
    let effectiveRuntimeOptions = runtimeOptions;

    if (pluginSpecs.length > 0) {
        try {
            const plugins = await loadServerPlugins(pluginSpecs, { baseDir: cwd ?? process.cwd() });

            const optionsObject = runtimeOptions ?? { dependencies: {} };
            const dependencies = optionsObject.dependencies ?? {};
            const resolvedDependencies = createRuntimeDependencies(dependencies);
            const baseWorldServer = resolvedDependencies.WorldServer;
            if (!isRuntimeWorldServerConstructor(baseWorldServer)) {
                throw new Error('Runtime dependency seam did not provide a constructable WorldServer.');
            }

            effectiveRuntimeOptions = {
                ...optionsObject,
                dependencies: {
                    ...dependencies,
                    WorldServer: wrapWorldServerConstructorWithPlugins(baseWorldServer, plugins),
                },
            };

            emitStructuredEvent('info', 'startup_plugins_loaded', {
                plugins: plugins.map((plugin) => plugin.id),
            });
        } catch (err) {
            emitStructuredEvent('error', 'startup_plugins_load_failed', {
                specs: pluginSpecs.join(','),
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
