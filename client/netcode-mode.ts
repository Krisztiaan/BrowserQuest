import type { ClientMovementNetcodeMode } from './ecs/world-kernel';

type NetcodeModeGlobals = typeof globalThis & {
    __BQ_NETCODE_MODE__?: string;
};

const NETCODE_MODE_STORAGE_KEY = 'bq_netcode_mode';

function normalizeNetcodeMode(value: string | null | undefined): ClientMovementNetcodeMode | null {
    if (typeof value !== 'string') {
        return null;
    }
    const normalized = value.trim().toLowerCase();
    if (normalized === 'predictive') {
        return 'predictive';
    }
    if (normalized === 'lockstep' || normalized === 'lock-step') {
        return 'lockstep';
    }
    return null;
}

function readQueryNetcodeMode(): ClientMovementNetcodeMode | null {
    try {
        const locationHref = (globalThis as { location?: { href?: string } }).location?.href;
        if (typeof locationHref !== 'string') {
            return null;
        }
        const url = new URL(locationHref);
        return normalizeNetcodeMode(url.searchParams.get('netcode') ?? url.searchParams.get('bqNetcode'));
    } catch (_) {
        return null;
    }
}

function readLocalStorageNetcodeMode(): ClientMovementNetcodeMode | null {
    try {
        const storage = (globalThis as { localStorage?: Pick<Storage, 'getItem'> }).localStorage;
        const raw = storage?.getItem(NETCODE_MODE_STORAGE_KEY) ?? null;
        return normalizeNetcodeMode(raw);
    } catch (_) {
        return null;
    }
}

export function resolveClientMovementNetcodeMode(): ClientMovementNetcodeMode {
    const globalMode = normalizeNetcodeMode((globalThis as NetcodeModeGlobals).__BQ_NETCODE_MODE__);
    if (globalMode) {
        return globalMode;
    }

    const queryMode = readQueryNetcodeMode();
    if (queryMode) {
        return queryMode;
    }

    const storageMode = readLocalStorageNetcodeMode();
    if (storageMode) {
        return storageMode;
    }

    return 'predictive';
}
