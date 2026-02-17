type DebugFlag = 'clicks' | 'doors' | 'moves';
type DebugPayload = string | number | boolean | null | DebugPayload[] | { [key: string]: DebugPayload };

type DebugFlagGlobals = typeof globalThis & {
    __BQ_DEBUG_CLICKS__?: boolean;
    __BQ_DEBUG_MOVES__?: boolean;
    __BQ_DEBUG_DOORS__?: boolean;
};

function readGlobalDebugFlag(flag: '__BQ_DEBUG_CLICKS__' | '__BQ_DEBUG_MOVES__' | '__BQ_DEBUG_DOORS__'): boolean {
    const globals = globalThis as DebugFlagGlobals;
    return globals[flag] === true;
}

function readQueryFlag(queryKey: string): boolean {
    try {
        const locationHref = (globalThis as { location?: { href?: string } }).location?.href;
        const url = typeof locationHref === 'string' ? new URL(locationHref) : null;
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
        const storage = (globalThis as { localStorage?: Pick<Storage, 'getItem'> }).localStorage;
        const raw = storage?.getItem(storageKey);
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
        if (readGlobalDebugFlag('__BQ_DEBUG_CLICKS__')) {
            return true;
        }
        return readQueryFlag('debugClicks') || readQueryFlag('bqDebugClicks') || readLocalStorageFlag('bq_debug_clicks');
    }

    if (flag === 'moves') {
        if (readGlobalDebugFlag('__BQ_DEBUG_MOVES__')) {
            return true;
        }
        return readQueryFlag('debugMoves') || readQueryFlag('bqDebugMoves') || readLocalStorageFlag('bq_debug_moves');
    }

    if (readGlobalDebugFlag('__BQ_DEBUG_DOORS__')) {
        return true;
    }
    return readQueryFlag('debugDoors') || readQueryFlag('bqDebugDoors') || readLocalStorageFlag('bq_debug_doors');
}

export function debugClicks(message: string, payload?: DebugPayload): void {
    if (!isDebugFlagEnabled('clicks')) {
        return;
    }
    // console.debug is often filtered by default; keep logs visible when debug is explicitly enabled.
    console.log('[bq.click]', message, payload ?? null);
}

export function debugDoors(message: string, payload?: DebugPayload): void {
    if (!isDebugFlagEnabled('doors') && !isDebugFlagEnabled('clicks')) {
        return;
    }
    console.log('[bq.door]', message, payload ?? null);
}

export function debugMoves(message: string, payload?: DebugPayload): void {
    if (!isDebugFlagEnabled('moves')) {
        return;
    }
    console.log('[bq.move]', message, payload ?? null);
}
