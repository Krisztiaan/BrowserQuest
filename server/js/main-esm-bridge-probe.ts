import CLOSE_CODES from '../../shared/js/ws-close-codes-esm';

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
    importWsEsm,
    fail,
}: {
    env: NodeJS.ProcessEnv;
    emitProbeEvent: (level: string, fields: Record<string, unknown>) => void;
    importWsEsm: () => Promise<WebSocketRuntimeModule>;
    fail: (code: number) => void;
}): Promise<void> {
    if (env.BQ_ESM_WS_BRIDGE_PROBE !== '1') {
        return;
    }

    const wsEsm = await importWsEsm();
    const wsDefault = wsEsm.default;
    const contractMatches =
        wsDefault &&
        wsDefault.CLOSE_CODES === wsEsm.CLOSE_CODES &&
        wsDefault.MultiVersionWebsocketServer === wsEsm.MultiVersionWebsocketServer &&
        wsDefault.wsWebSocketConnection === wsEsm.wsWebSocketConnection &&
        typeof wsEsm.MultiVersionWebsocketServer === 'function' &&
        typeof wsEsm.wsWebSocketConnection === 'function' &&
        wsEsm.CLOSE_CODES.NORMAL === CLOSE_CODES.NORMAL &&
        wsEsm.CLOSE_CODES.UNSUPPORTED_DATA === CLOSE_CODES.UNSUPPORTED_DATA &&
        wsEsm.CLOSE_CODES.INVALID_PAYLOAD === CLOSE_CODES.INVALID_PAYLOAD;
    const forceFail = env.BQ_ESM_WS_BRIDGE_PROBE_FORCE_FAIL === '1';

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
