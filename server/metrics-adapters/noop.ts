import type { RuntimeMetrics, RuntimeWorld } from '../runtime-types';

interface NoopMeta {
    reason?: string;
    invalidFields?: string[];
    error?: string | null;
}

type NoopMetricsAdapter = RuntimeMetrics &
    Readonly<{
        isEnabled: false;
        isReady: false;
        reason: string;
        invalidFields: string[];
        error: string | null;
    }>;

function createNoopMetricsAdapter(meta?: NoopMeta): NoopMetricsAdapter {
    const details = meta ?? {};
    return {
        isEnabled: false,
        isReady: false,
        reason: details.reason ?? 'disabled',
        invalidFields: Array.isArray(details.invalidFields) ? details.invalidFields : [],
        error: details.error ?? null,
        ready: function (callback?: () => void) {
            if (typeof callback === 'function') {
                callback();
            }
        },
        updatePlayerCounters: function (worlds: RuntimeWorld[], updatedCallback?: (totalPlayers: number) => void) {
            if (typeof updatedCallback === 'function') {
                const totalPlayers = worlds.reduce<number>((sum, world) => sum + world.playerCount, 0);
                updatedCallback(totalPlayers);
            }
        },
        updateWorldDistribution: function (_distribution: number[]) {},
        getTotalPlayers: function (callback?: (count: number) => void) {
            if (typeof callback === 'function') {
                callback(0);
            }
        },
    };
}

export { createNoopMetricsAdapter };

export default {
    createNoopMetricsAdapter,
};
