import { SERVER_EVENT_NAMES } from '../server-event-names';

export async function resolveRuntimeOptions({
    env,
    emitStructuredEvent,
    importWsRuntime,
    createRuntimeDependencies,
    fail,
}: {
    env: NodeJS.ProcessEnv;
    emitStructuredEvent: (level: string, event: string, fields: Record<string, unknown>) => void;
    importWsRuntime: () => Promise<{
        default: unknown;
        CLOSE_CODES?: unknown;
        MultiVersionWebsocketServer?: unknown;
        wsWebSocketConnection?: unknown;
    }>;
    createRuntimeDependencies: (overrides: object) => unknown;
    fail: (code: number) => void;
}): Promise<{ dependencies: unknown } | undefined> {
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
