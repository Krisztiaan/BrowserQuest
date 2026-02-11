import CLOSE_CODES from '../../shared/ws-close-codes';

type CloseCodesContract = {
    NORMAL: number;
    UNSUPPORTED_DATA: number;
    INVALID_PAYLOAD: number;
};

type WebSocketRuntimeModule = {
    default?: {
        CLOSE_CODES?: CloseCodesContract;
        MultiVersionWebsocketServer?: unknown;
        wsWebSocketConnection?: unknown;
    };
    CLOSE_CODES: CloseCodesContract;
    MultiVersionWebsocketServer: unknown;
    wsWebSocketConnection: unknown;
};

export async function runWebSocketBridgeProbeIfEnabled({
    env,
    emitProbeEvent,
    importWsRuntime,
    fail,
}: {
    env: NodeJS.ProcessEnv;
    emitProbeEvent: (level: string, fields: Record<string, unknown>) => void;
    importWsRuntime: () => Promise<WebSocketRuntimeModule>;
    fail: (code: number) => void;
}): Promise<void> {
    if (env.BQ_WS_BRIDGE_PROBE !== '1') {
        return;
    }

    const wsRuntime = await importWsRuntime();
    const wsDefault = wsRuntime.default ?? null;
    const contractMatches =
        wsDefault !== null &&
        wsDefault.CLOSE_CODES === wsRuntime.CLOSE_CODES &&
        wsDefault.MultiVersionWebsocketServer === wsRuntime.MultiVersionWebsocketServer &&
        wsDefault.wsWebSocketConnection === wsRuntime.wsWebSocketConnection &&
        typeof wsRuntime.MultiVersionWebsocketServer === 'function' &&
        typeof wsRuntime.wsWebSocketConnection === 'function' &&
        wsRuntime.CLOSE_CODES.NORMAL === CLOSE_CODES.NORMAL &&
        wsRuntime.CLOSE_CODES.UNSUPPORTED_DATA === CLOSE_CODES.UNSUPPORTED_DATA &&
        wsRuntime.CLOSE_CODES.INVALID_PAYLOAD === CLOSE_CODES.INVALID_PAYLOAD;
    const forceFail = env.BQ_WS_BRIDGE_PROBE_FORCE_FAIL === '1';

    if (!contractMatches || forceFail) {
        emitProbeEvent('error', {
            status: 'failed',
            reason: forceFail ? 'forced_failure' : 'contract_mismatch',
        });
        fail(1);
        return;
    }

    emitProbeEvent('info', {
        status: 'ok',
    });
}

export default {
    runWebSocketBridgeProbeIfEnabled,
};
