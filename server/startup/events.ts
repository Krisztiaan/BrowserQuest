import { SERVER_EVENT_NAMES } from '../server-event-names';
import type { RuntimeEventFields } from '../runtime-types';

type LogEmitterFn = (message: string) => void;
type NowIsoFn = () => string;
type StructuredEventEmitter = (level: string, event: string, fields?: RuntimeEventFields) => void;

export function createStructuredEventEmitter({
    emitInfo = console.info,
    emitError = console.error,
    nowIso = () => new Date().toISOString(),
}: {
    emitInfo?: LogEmitterFn;
    emitError?: LogEmitterFn;
    nowIso?: NowIsoFn;
} = {}): StructuredEventEmitter {
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

export function createProbeEventEmitter({
    emitStructuredEvent,
    probeEvent = SERVER_EVENT_NAMES.WS_BRIDGE_PROBE,
}: {
    emitStructuredEvent: StructuredEventEmitter;
    probeEvent?: string;
}): (level: string, fields?: RuntimeEventFields) => void {
    return function emitProbeEvent(level, fields = {}) {
        emitStructuredEvent(level, probeEvent, fields);
    };
}

export default {
    createStructuredEventEmitter,
    createProbeEventEmitter,
};
