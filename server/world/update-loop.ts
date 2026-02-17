type UpdateLoopWorld = {
    processQueues(): void;
};

type UpdateLoopTimerHandle = ReturnType<typeof setTimeout> | number;

type UpdateLoopDependencies = {
    nowMs?: () => number;
    setTimeoutFn?: (callback: () => void, delayMs: number) => UpdateLoopTimerHandle;
    clearTimeoutFn?: (timerHandle: UpdateLoopTimerHandle) => void;
    maxCatchUpTicks?: number;
};

type UpdateLoopHandle = {
    stop(): void;
};

export const DEFAULT_WORLD_UPDATES_PER_SECOND = 30;
const DEFAULT_MAX_CATCH_UP_TICKS = 4;

function normalizeUpdatesPerSecond(updatesPerSecond: number | undefined): number {
    if (typeof updatesPerSecond !== 'number' || !Number.isFinite(updatesPerSecond)) {
        return DEFAULT_WORLD_UPDATES_PER_SECOND;
    }
    const rounded = Math.floor(updatesPerSecond);
    if (rounded <= 0) {
        return DEFAULT_WORLD_UPDATES_PER_SECOND;
    }
    return rounded;
}

function normalizeDelayMs(delayMs: number): number {
    if (!Number.isFinite(delayMs) || delayMs <= 0) {
        return 0;
    }
    return Math.max(0, Math.round(delayMs));
}

export function startWorldUpdateLoop(
    world: UpdateLoopWorld,
    updatesPerSecond: number,
    dependencies?: UpdateLoopDependencies
): UpdateLoopHandle {
    const runtimeDeps = dependencies ?? {};
    const nowMs = runtimeDeps.nowMs ?? (() => Date.now());
    const setTimeoutFn =
        runtimeDeps.setTimeoutFn ??
        function (callback: () => void, delayMs: number) {
            return setTimeout(callback, delayMs);
        };
    const clearTimeoutFn =
        runtimeDeps.clearTimeoutFn ??
        function (timerHandle: UpdateLoopTimerHandle) {
            clearTimeout(timerHandle);
        };
    const maxCatchUpTicksRaw = runtimeDeps.maxCatchUpTicks;
    const maxCatchUpTicks =
        typeof maxCatchUpTicksRaw === 'number' && Number.isInteger(maxCatchUpTicksRaw) && maxCatchUpTicksRaw > 0
            ? maxCatchUpTicksRaw
            : DEFAULT_MAX_CATCH_UP_TICKS;

    const normalizedUps = normalizeUpdatesPerSecond(updatesPerSecond);
    const tickIntervalMs = 1000 / normalizedUps;

    let stopped = false;
    let timerHandle: UpdateLoopTimerHandle | null = null;
    let nextTickAtMs = nowMs() + tickIntervalMs;

    const scheduleNextTick = (): void => {
        if (stopped) {
            return;
        }

        const now = nowMs();
        const delayMs = normalizeDelayMs(nextTickAtMs - now);
        timerHandle = setTimeoutFn(runTick, delayMs);
    };

    const runTick = (): void => {
        if (stopped) {
            return;
        }

        const now = nowMs();
        const behindTicksRaw = Math.floor((now - nextTickAtMs) / tickIntervalMs);
        const behindTicks = Math.max(0, behindTicksRaw);
        const ticksToProcess = Math.min(maxCatchUpTicks, 1 + behindTicks);

        for (let tickIndex = 0; tickIndex < ticksToProcess; tickIndex += 1) {
            world.processQueues();
        }

        nextTickAtMs += tickIntervalMs * ticksToProcess;
        if (nextTickAtMs < now - tickIntervalMs * maxCatchUpTicks) {
            nextTickAtMs = now + tickIntervalMs;
        }

        scheduleNextTick();
    };

    scheduleNextTick();

    return {
        stop(): void {
            if (stopped) {
                return;
            }
            stopped = true;
            if (timerHandle !== null) {
                clearTimeoutFn(timerHandle);
                timerHandle = null;
            }
        },
    };
}

export function resolveWorldUpdatesPerSecond(updatesPerSecond: number | undefined): number {
    return normalizeUpdatesPerSecond(updatesPerSecond);
}
