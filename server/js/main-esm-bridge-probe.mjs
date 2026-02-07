/**
 * Run optional websocket bridge probe in ESM entry mode.
 *
 * @param {object} params
 * @param {NodeJS.ProcessEnv} params.env
 * @param {(level: string, fields: Record<string, unknown>) => void} params.emitProbeEvent
 * @param {() => { CLOSE_CODES: { NORMAL: number, UNSUPPORTED_DATA: number, INVALID_PAYLOAD: number } }} params.requireWsCjs
 * @param {() => Promise<{ default: { CLOSE_CODES: object, MultiVersionWebsocketServer: unknown, wsWebSocketConnection: unknown }, CLOSE_CODES: { NORMAL: number, UNSUPPORTED_DATA: number, INVALID_PAYLOAD: number }, MultiVersionWebsocketServer: unknown, wsWebSocketConnection: unknown }>} params.importWsEsm
 * @param {(code: number) => void} params.fail
 * @returns {Promise<void>}
 */
export async function runWebSocketBridgeProbeIfEnabled({
    env,
    emitProbeEvent,
    requireWsCjs,
    importWsEsm,
    fail,
}) {
    if (env.BQ_ESM_WS_BRIDGE_PROBE !== '1') {
        return;
    }

    const wsCjs = requireWsCjs();
    const wsEsm = await importWsEsm();
    const contractMatches =
        wsEsm.default &&
        wsEsm.default.CLOSE_CODES === wsEsm.CLOSE_CODES &&
        wsEsm.default.MultiVersionWebsocketServer === wsEsm.MultiVersionWebsocketServer &&
        wsEsm.default.wsWebSocketConnection === wsEsm.wsWebSocketConnection &&
        typeof wsEsm.MultiVersionWebsocketServer === 'function' &&
        typeof wsEsm.wsWebSocketConnection === 'function' &&
        wsEsm.CLOSE_CODES.NORMAL === wsCjs.CLOSE_CODES.NORMAL &&
        wsEsm.CLOSE_CODES.UNSUPPORTED_DATA === wsCjs.CLOSE_CODES.UNSUPPORTED_DATA &&
        wsEsm.CLOSE_CODES.INVALID_PAYLOAD === wsCjs.CLOSE_CODES.INVALID_PAYLOAD;
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
