import { expect, test } from 'bun:test';
import * as MainRuntimeModule from '../../server/main-runtime';

const MainRuntime = MainRuntimeModule as any;

test('main runtime server event emitter forwards structured events to logger', () => {
    const events: Array<{ level: string; eventName: string; fields: unknown }> = [];
    const emitServerEvent = MainRuntime.createServerEventEmitter({
        event(level: string, eventName: string, fields: unknown) {
            events.push({ level, eventName, fields });
        },
    });

    emitServerEvent('info', 'server.start', { port: 8000 });

    expect(events).toEqual([{ level: 'info', eventName: 'server.start', fields: { port: 8000 } }]);
});

test('main runtime population check timer uses injected timer seam and updates on count changes only', () => {
    const scheduled: { fn?: () => void; delay?: number } = {};
    const timerToken = { id: 1 };
    const totals = [5, 5, 7];
    const updates: number[] = [];
    const worldA = {
        updatePopulation(total: number) {
            updates.push(total);
        },
    };
    const worldB = {
        updatePopulation(total: number) {
            updates.push(total * 10);
        },
    };
    let worlds = [worldA];

    const metrics = {
        isEnabled: true,
        isReady: true,
        getTotalPlayers(callback: (total: number) => void) {
            callback(totals.shift() as number);
        },
    };
    const setIntervalFn = (fn: () => void, delay: number) => {
        scheduled.fn = fn;
        scheduled.delay = delay;
        return timerToken;
    };
    const timer = MainRuntime.createPopulationCheckTimer(metrics, () => worlds, setIntervalFn);

    expect(timer).toBe(timerToken);
    expect(scheduled.delay).toBe(1000);
    scheduled.fn?.();
    expect(updates).toEqual([5]);

    scheduled.fn?.();
    expect(updates).toEqual([5]);

    worlds = [worldA, worldB];
    scheduled.fn?.();
    expect(updates).toEqual([5, 7, 70]);
});

test('main runtime fatal reporter maps known and unknown fatal events', () => {
    const logs: string[] = [];
    const events: Array<{
        level: string;
        eventName: string;
        fields: { source: string; message: string; stack?: string };
    }> = [];
    const reportFatal = MainRuntime.createFatalReporter(
        (level: string, eventName: string, fields: { source: string; message: string; stack?: string }) => {
            events.push({ level, eventName, fields });
        },
        {
            error(message: string) {
                logs.push(message);
            },
        }
    );
    const err = new Error('boom');

    reportFatal('uncaughtException', err);
    reportFatal('unknownLabel', 'raw-error');

    expect(events[0]?.eventName).toBe('server.fatal.uncaught_exception');
    expect(events[0]?.fields.source).toBe('uncaughtException');
    expect(events[0]?.fields.message).toBe('boom');
    expect(typeof events[0]?.fields.stack).toBe('string');
    expect(events[1]?.eventName).toBe('server.fatal.unknown');
    expect(events[1]?.fields.message).toBe('raw-error');
    expect(logs.length).toBe(2);
});

test('main runtime fatal handler installer binds process events to reporter', () => {
    const handlers: Record<string, (value: unknown) => void> = {};
    const removed: string[] = [];
    const calls: Array<{ label: string; value: unknown }> = [];
    const processObject = {
        on(eventName: string, handler: (value: unknown) => void) {
            handlers[eventName] = handler;
        },
        off(eventName: string) {
            removed.push(eventName);
            delete handlers[eventName];
        },
    };
    const cleanup = MainRuntime.installFatalHandlers(processObject, (label: string, value: unknown) => {
        calls.push({ label, value });
    });

    handlers.uncaughtException?.('u');
    handlers.unhandledRejection?.('r');

    expect(calls).toEqual([
        { label: 'uncaughtException', value: 'u' },
        { label: 'unhandledRejection', value: 'r' },
    ]);

    cleanup();
    expect(removed).toEqual(['uncaughtException', 'unhandledRejection']);
    expect(handlers.uncaughtException).toBeUndefined();
    expect(handlers.unhandledRejection).toBeUndefined();
});

test('main runtime fatal test trigger emits expected synthetic fatal labels', () => {
    const scheduledDelays: number[] = [];
    const calls: Array<{ label: string; message: string }> = [];
    const setTimeoutFn = (callback: () => void, delay: number) => {
        scheduledDelays.push(delay);
        callback();
    };
    const reportFatal = (label: string, err: Error) => {
        calls.push({ label, message: err.message });
    };

    MainRuntime.triggerFatalTestEvent(
        { BQ_TEST_TRIGGER_FATAL_EVENT: 'unhandled_rejection' },
        setTimeoutFn,
        reportFatal
    );
    MainRuntime.triggerFatalTestEvent({ BQ_TEST_TRIGGER_FATAL_EVENT: 'uncaught_exception' }, setTimeoutFn, reportFatal);
    MainRuntime.triggerFatalTestEvent({}, setTimeoutFn, reportFatal);

    expect(scheduledDelays).toEqual([10, 10]);
    expect(calls).toEqual([
        { label: 'unhandledRejection', message: 'bq-fatal-test-unhandled-rejection' },
        { label: 'uncaughtException', message: 'bq-fatal-test-uncaught-exception' },
    ]);
});

test('main runtime shutdown handler installer binds SIGTERM/SIGINT and cleans up listeners', () => {
    const handlers: Record<string, () => void> = {};
    const removed: string[] = [];
    const calls: string[] = [];
    const processObject = {
        on(eventName: string, handler: () => void) {
            handlers[eventName] = handler;
        },
        off(eventName: string) {
            removed.push(eventName);
            delete handlers[eventName];
        },
    };

    const cleanup = MainRuntime.installShutdownHandlers(processObject, (signal: string) => {
        calls.push(signal);
    });

    handlers.SIGTERM?.();
    handlers.SIGINT?.();

    expect(calls).toEqual(['SIGTERM', 'SIGINT']);

    cleanup();
    expect(removed).toEqual(['SIGTERM', 'SIGINT']);
    expect(handlers.SIGTERM).toBeUndefined();
    expect(handlers.SIGINT).toBeUndefined();
});

test('main runtime population cleanup delegates to provided clearInterval seam', () => {
    const cleared: unknown[] = [];
    const cleanup = MainRuntime.createPopulationCheckCleanup({ token: 'timer' }, (timerHandle: unknown) => {
        cleared.push(timerHandle);
    });

    cleanup();

    expect(cleared).toEqual([{ token: 'timer' }]);
});

test('main runtime cleanup combiner runs handlers once', () => {
    const calls: string[] = [];
    const cleanup = MainRuntime.createRuntimeCleanup([() => calls.push('first'), () => calls.push('second')]);

    cleanup();
    cleanup();

    expect(calls).toEqual(['first', 'second']);
});
