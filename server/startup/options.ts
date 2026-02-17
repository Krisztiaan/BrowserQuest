import { SERVER_EVENT_NAMES } from '../server-event-names';
import type { MainRuntimeDependencies, MainRuntimeDependencyOverrides, RuntimeEventFields } from '../runtime-types';

type StartupWsRuntimeModule = {
    default: MainRuntimeDependencies['ws'];
};

type ResolveRuntimeOptionsParams = {
    env: NodeJS.ProcessEnv;
    emitStructuredEvent: (level: string, event: string, fields: RuntimeEventFields) => void;
    importWsRuntime: () => Promise<StartupWsRuntimeModule>;
    createRuntimeDependencies: (overrides: MainRuntimeDependencyOverrides) => MainRuntimeDependencies;
    fail: (code: number) => void;
};

export type StartupRuntimeOptions = {
    dependencies: MainRuntimeDependencyOverrides;
};

export async function resolveRuntimeOptions({
    env,
    emitStructuredEvent,
    importWsRuntime,
    createRuntimeDependencies,
    fail,
}: ResolveRuntimeOptionsParams): Promise<StartupRuntimeOptions | undefined> {
    void env;

    try {
        const wsRuntime = await importWsRuntime();
        emitStructuredEvent('info', SERVER_EVENT_NAMES.WS_RUNTIME_MODE, {
            mode: 'runtime',
            status: 'ok',
        });

        return {
            dependencies: createRuntimeDependencies({
                ws: wsRuntime.default,
            }),
        };
    } catch (error) {
        emitStructuredEvent('error', SERVER_EVENT_NAMES.WS_RUNTIME_MODE, {
            mode: 'runtime',
            status: 'failed',
            reason: 'load_error',
            error: String(error),
        });
        fail(1);
        return undefined;
    }
}

export default {
    resolveRuntimeOptions,
};
