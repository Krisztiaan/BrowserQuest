type DebugFlag = 'clicks' | 'doors' | 'moves';

function readQueryFlag(queryKey: string): boolean {
    try {
        const url = typeof globalThis.location?.href === 'string' ? new URL(globalThis.location.href) : null;
        if (!url) {
            return false;
        }
        const value = url.searchParams.get(queryKey);
        if (value === null) {
            return false;
        }
        if (value === '' || value === '1' || value === 'true' || value === 'yes' || value === 'on') {
            return true;
        }
        return false;
    } catch (_) {
        return false;
    }
}

function readLocalStorageFlag(storageKey: string): boolean {
    try {
        const raw = globalThis.localStorage?.getItem(storageKey);
        if (!raw) {
            return false;
        }
        const trimmed = raw.trim().toLowerCase();
        return trimmed === '1' || trimmed === 'true' || trimmed === 'yes' || trimmed === 'on';
    } catch (_) {
        return false;
    }
}

export function isDebugFlagEnabled(flag: DebugFlag): boolean {
    if (flag === 'clicks') {
        const globalFlag = (globalThis as unknown as { __BQ_DEBUG_CLICKS__?: unknown }).__BQ_DEBUG_CLICKS__;
        if (globalFlag === true) {
            return true;
        }
        return readQueryFlag('debugClicks') || readQueryFlag('bqDebugClicks') || readLocalStorageFlag('bq_debug_clicks');
    }

    if (flag === 'moves') {
        const globalFlag = (globalThis as unknown as { __BQ_DEBUG_MOVES__?: unknown }).__BQ_DEBUG_MOVES__;
        if (globalFlag === true) {
            return true;
        }
        return readQueryFlag('debugMoves') || readQueryFlag('bqDebugMoves') || readLocalStorageFlag('bq_debug_moves');
    }

    const globalFlag = (globalThis as unknown as { __BQ_DEBUG_DOORS__?: unknown }).__BQ_DEBUG_DOORS__;
    if (globalFlag === true) {
        return true;
    }
    return readQueryFlag('debugDoors') || readQueryFlag('bqDebugDoors') || readLocalStorageFlag('bq_debug_doors');
}

export function debugClicks(message: string, payload?: unknown): void {
    if (!isDebugFlagEnabled('clicks')) {
        return;
    }
    // console.debug is often filtered by default; keep logs visible when debug is explicitly enabled.
    // eslint-disable-next-line no-console
    console.log('[bq.click]', message, payload ?? null);
}

export function debugDoors(message: string, payload?: unknown): void {
    if (!isDebugFlagEnabled('doors') && !isDebugFlagEnabled('clicks')) {
        return;
    }
    // eslint-disable-next-line no-console
    console.log('[bq.door]', message, payload ?? null);
}

export function debugMoves(message: string, payload?: unknown): void {
    if (!isDebugFlagEnabled('moves')) {
        return;
    }
    // eslint-disable-next-line no-console
    console.log('[bq.move]', message, payload ?? null);
}
