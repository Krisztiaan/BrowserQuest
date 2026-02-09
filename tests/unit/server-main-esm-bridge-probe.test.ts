import { expect, test } from 'bun:test';
import { runWebSocketBridgeProbeIfEnabled } from '../../server/js/main-esm-bridge-probe.ts';

type ProbeEvent = {
    level: string;
    status: string;
    reason?: string;
};

function createMatchingBridgeContracts() {
    const closeCodes = {
        NORMAL: 1000,
        UNSUPPORTED_DATA: 1003,
        INVALID_PAYLOAD: 1007,
    };
    const MultiVersionWebsocketServer = function MultiVersionWebsocketServer() {
        // no-op
    };
    const wsWebSocketConnection = function wsWebSocketConnection() {
        // no-op
    };

    return {
        wsEsm: {
            default: {
                CLOSE_CODES: closeCodes,
                MultiVersionWebsocketServer,
                wsWebSocketConnection,
            },
            CLOSE_CODES: closeCodes,
            MultiVersionWebsocketServer,
            wsWebSocketConnection,
        },
    };
}

test('bridge probe does nothing when probe mode is disabled', async () => {
    const events: ProbeEvent[] = [];
    let failCode: number | null = null;

    await runWebSocketBridgeProbeIfEnabled({
        env: {},
        emitProbeEvent: (level, fields) => {
            events.push({ level, ...(fields as { status: string; reason?: string }) });
        },
        importWsEsm: async () => {
            throw new Error('should_not_import');
        },
        fail: (code) => {
            failCode = code;
        },
    });

    expect(events).toEqual([]);
    expect(failCode).toBeNull();
});

test('bridge probe emits success when bridge contract matches', async () => {
    const events: ProbeEvent[] = [];
    let failCode: number | null = null;
    const contracts = createMatchingBridgeContracts();

    await runWebSocketBridgeProbeIfEnabled({
        env: {
            BQ_ESM_WS_BRIDGE_PROBE: '1',
        },
        emitProbeEvent: (level, fields) => {
            events.push({ level, ...(fields as { status: string; reason?: string }) });
        },
        importWsEsm: async () => contracts.wsEsm,
        fail: (code) => {
            failCode = code;
        },
    });

    expect(failCode).toBeNull();
    expect(events).toEqual([
        {
            level: 'info',
            status: 'ok',
        },
    ]);
});

test('bridge probe emits forced-failure diagnostics and exits', async () => {
    const events: ProbeEvent[] = [];
    let failCode: number | null = null;
    const contracts = createMatchingBridgeContracts();

    await runWebSocketBridgeProbeIfEnabled({
        env: {
            BQ_ESM_WS_BRIDGE_PROBE: '1',
            BQ_ESM_WS_BRIDGE_PROBE_FORCE_FAIL: '1',
        },
        emitProbeEvent: (level, fields) => {
            events.push({ level, ...(fields as { status: string; reason?: string }) });
        },
        importWsEsm: async () => contracts.wsEsm,
        fail: (code) => {
            failCode = code;
        },
    });

    expect(failCode).toBe(1);
    expect(events).toEqual([
        {
            level: 'error',
            status: 'failed',
            reason: 'forced_failure',
        },
    ]);
});

test('bridge probe emits contract mismatch diagnostics and exits', async () => {
    const events: ProbeEvent[] = [];
    let failCode: number | null = null;
    const contracts = createMatchingBridgeContracts();
    const mismatchedEsm = {
        ...contracts.wsEsm,
        CLOSE_CODES: {
            NORMAL: 1000,
            UNSUPPORTED_DATA: 1003,
            INVALID_PAYLOAD: 4999,
        },
    };

    await runWebSocketBridgeProbeIfEnabled({
        env: {
            BQ_ESM_WS_BRIDGE_PROBE: '1',
        },
        emitProbeEvent: (level, fields) => {
            events.push({ level, ...(fields as { status: string; reason?: string }) });
        },
        importWsEsm: async () => mismatchedEsm,
        fail: (code) => {
            failCode = code;
        },
    });

    expect(failCode).toBe(1);
    expect(events).toEqual([
        {
            level: 'error',
            status: 'failed',
            reason: 'contract_mismatch',
        },
    ]);
});
