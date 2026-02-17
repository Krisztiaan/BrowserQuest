import CLOSE_CODES from '../../shared/ws-close-codes';

type CloseCodesContract = {
    NORMAL: number;
    UNSUPPORTED_DATA: number;
    INVALID_PAYLOAD: number;
};
type ProbeEventValue = string | number | boolean | null;
type ProbeEventFields = Record<string, ProbeEventValue>;
type WsRuntimeExportValue = string | number | boolean | null | undefined | object;

type WebSocketRuntimeModule = {
    default?: {
        CLOSE_CODES?: CloseCodesContract;
        MultiVersionWebsocketServer?: WsRuntimeExportValue;
        wsWebSocketConnection?: WsRuntimeExportValue;
    };
    CLOSE_CODES: CloseCodesContract;
    MultiVersionWebsocketServer: WsRuntimeExportValue;
    wsWebSocketConnection: WsRuntimeExportValue;
};

export async function runBridgeProbeIfEnabled({
    env,
    emitProbeEvent,
    importWsRuntime,
    fail,
}: {
    env: NodeJS.ProcessEnv;
    emitProbeEvent: (level: string, fields: ProbeEventFields) => void;
    importWsRuntime: () => Promise<WebSocketRuntimeModule>;
    fail: (code: number) => void;
}): Promise<void> {
    if (env.BQ_WS_BRIDGE_PROBE !== '1') {
        return;
    }

    const wsRuntime = await importWsRuntime();
    const wsDefault = wsRuntime.default ?? null;
    const defaultServerCtor = wsDefault?.MultiVersionWebsocketServer;
    const defaultConnectionCtor = wsDefault?.wsWebSocketConnection;
    const runtimeServerCtor = wsRuntime.MultiVersionWebsocketServer;
    const runtimeConnectionCtor = wsRuntime.wsWebSocketConnection;
    const contractMatches =
        wsDefault !== null &&
        wsDefault.CLOSE_CODES === wsRuntime.CLOSE_CODES &&
        defaultServerCtor === runtimeServerCtor &&
        defaultConnectionCtor === runtimeConnectionCtor &&
        typeof runtimeServerCtor === 'function' &&
        typeof runtimeConnectionCtor === 'function' &&
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
    runBridgeProbeIfEnabled,
};
