import { expect, test } from 'bun:test';
import {
    DEFAULT_WORLD_UPDATES_PER_SECOND,
    resolveWorldUpdatesPerSecond,
    startWorldUpdateLoop,
} from '../../../server/world/update-loop';

test('update loop UPS resolver normalizes invalid and fractional values', () => {
    expect(resolveWorldUpdatesPerSecond(undefined)).toBe(DEFAULT_WORLD_UPDATES_PER_SECOND);
    expect(resolveWorldUpdatesPerSecond(Number.NaN)).toBe(DEFAULT_WORLD_UPDATES_PER_SECOND);
    expect(resolveWorldUpdatesPerSecond(0)).toBe(DEFAULT_WORLD_UPDATES_PER_SECOND);
    expect(resolveWorldUpdatesPerSecond(-5)).toBe(DEFAULT_WORLD_UPDATES_PER_SECOND);
    expect(resolveWorldUpdatesPerSecond(29.9)).toBe(29);
    expect(resolveWorldUpdatesPerSecond(30)).toBe(30);
});

test('update loop catches up after transient timer drift while preserving cadence', () => {
    const scheduledDelays: number[] = [];
    const processedAt: number[] = [];
    let now = 1_000;
    let pendingCallback: (() => void) | null = null;

    startWorldUpdateLoop(
        {
            processQueues() {
                processedAt.push(now);
            },
        },
        20,
        {
            nowMs: () => now,
            setTimeoutFn(callback, delayMs) {
                pendingCallback = callback;
                scheduledDelays.push(delayMs);
                return { id: scheduledDelays.length };
            },
            clearTimeoutFn() {
                // no-op
            },
            maxCatchUpTicks: 4,
        }
    );

    expect(scheduledDelays).toEqual([50]);

    now = 1_050;
    pendingCallback?.();
    expect(processedAt.length).toBe(1);
    expect(scheduledDelays.at(-1)).toBe(50);

    now = 1_250;
    pendingCallback?.();
    expect(processedAt.length).toBe(5);
    expect(scheduledDelays.at(-1)).toBe(50);
});

test('update loop stop clears pending timer and prevents further ticks', () => {
    const cleared: unknown[] = [];
    const processedAt: number[] = [];
    let pendingCallback: (() => void) | null = null;
    let nextHandleId = 0;

    const loop = startWorldUpdateLoop(
        {
            processQueues() {
                processedAt.push(1);
            },
        },
        30,
        {
            nowMs: () => 0,
            setTimeoutFn(callback) {
                pendingCallback = callback;
                nextHandleId += 1;
                return { id: nextHandleId };
            },
            clearTimeoutFn(timerHandle) {
                cleared.push(timerHandle);
            },
        }
    );

    loop.stop();
    pendingCallback?.();

    expect(cleared).toEqual([{ id: 1 }]);
    expect(processedAt).toEqual([]);
});
