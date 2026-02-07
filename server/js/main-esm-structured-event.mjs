/**
 * @param {object} [params]
 * @param {(message: string) => void} [params.emitInfo]
 * @param {(message: string) => void} [params.emitError]
 * @param {() => string} [params.nowIso]
 * @returns {(level: string, event: string, fields?: Record<string, unknown>) => void}
 */
export function createStructuredEventEmitter({ emitInfo = console.info, emitError = console.error, nowIso = () => new Date().toISOString() } = {}) {
    return function emitStructuredEvent(level, event, fields = {}) {
        const payload = JSON.stringify({
            ts: nowIso(),
            level,
            event,
            ...fields,
        });

        if (level === 'error') {
            emitError(payload);
            return;
        }

        emitInfo(payload);
    };
}

/**
 * @param {object} params
 * @param {(level: string, event: string, fields?: Record<string, unknown>) => void} params.emitStructuredEvent
 * @param {string} [params.probeEvent]
 * @returns {(level: string, fields?: Record<string, unknown>) => void}
 */
export function createProbeEventEmitter({ emitStructuredEvent, probeEvent = 'server.esm.ws_bridge_probe' }) {
    return function emitProbeEvent(level, fields = {}) {
        emitStructuredEvent(level, probeEvent, fields);
    };
}

export default {
    createStructuredEventEmitter,
    createProbeEventEmitter,
};
