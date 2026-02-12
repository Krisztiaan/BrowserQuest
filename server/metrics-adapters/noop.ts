interface NoopMeta {
    reason?: string;
    invalidFields?: unknown;
    error?: unknown;
}

function isUnknownArray(value: unknown): value is unknown[] {
    return Array.isArray(value);
}

type NoopMetricsAdapter = Readonly<{
    isEnabled: false;
    isReady: false;
    reason: string;
    invalidFields: unknown[];
    error: unknown;
    ready: (callback?: () => void) => void;
    updatePlayerCounters: (worlds: unknown, updatedCallback?: (totalPlayers: number) => void) => void;
    updateWorldDistribution: () => void;
    getOpenWorldCount: (callback?: (count: null) => void) => void;
    getTotalPlayers: (callback?: (count: null) => void) => void;
}>;

function createNoopMetricsAdapter(meta?: NoopMeta): NoopMetricsAdapter {
    const details = meta ?? {};
    return {
        isEnabled: false,
        isReady: false,
        reason: details.reason ?? 'disabled',
        invalidFields: isUnknownArray(details.invalidFields) ? details.invalidFields : [],
        error: details.error ?? null,
        ready: function (callback?: () => void) {
            if (typeof callback === 'function') {
                callback();
            }
        },
        updatePlayerCounters: function (worlds: unknown, updatedCallback?: (totalPlayers: number) => void) {
            if (typeof updatedCallback === 'function') {
                const totalPlayers = isUnknownArray(worlds)
                    ? worlds.reduce<number>((sum, world) => {
                          if (!world || typeof world !== 'object') {
                              return sum;
                          }
                          const count = (world as { playerCount?: unknown }).playerCount;
                          if (typeof count === 'number' && Number.isFinite(count)) {
                              return sum + count;
                          }
                          return sum;
                      }, 0)
                    : 0;
                updatedCallback(totalPlayers);
            }
        },
        updateWorldDistribution: function () {},
        getOpenWorldCount: function (callback?: (count: null) => void) {
            if (typeof callback === 'function') {
                callback(null);
            }
        },
        getTotalPlayers: function (callback?: (count: null) => void) {
            if (typeof callback === 'function') {
                callback(null);
            }
        },
    };
}

export { createNoopMetricsAdapter };

export default {
    createNoopMetricsAdapter,
};
