import { SERVER_EVENT_NAMES } from './server-event-names';

export async function resolveStartupRuntimeOptions({
    env,
    emitStructuredEvent,
    importWsEsm,
    createRuntimeDependencies,
    fail,
}: {
    env: NodeJS.ProcessEnv;
    emitStructuredEvent: (level: string, event: string, fields: Record<string, unknown>) => void;
    importWsEsm: () => Promise<{
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
