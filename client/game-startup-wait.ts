export type StartupWaitOutcome = 'ready' | 'map_error' | 'timeout' | 'pending';

export const GAME_STARTUP_WAIT_MAX_MS = 20_000;

export function resolveStartupWaitOutcome({
    mapLoaded,
    spritesLoaded,
    mapLoadError,
    elapsedMs,
    maxWaitMs = GAME_STARTUP_WAIT_MAX_MS,
}: {
    mapLoaded: boolean;
    spritesLoaded: boolean;
    mapLoadError: string | null | undefined;
    elapsedMs: number;
    maxWaitMs?: number;
}): StartupWaitOutcome {
    if (mapLoaded && spritesLoaded) {
        return 'ready';
    }
    if (typeof mapLoadError === 'string' && mapLoadError.trim().length > 0) {
        return 'map_error';
    }
    if (elapsedMs >= maxWaitMs) {
        return 'timeout';
    }
    return 'pending';
}

