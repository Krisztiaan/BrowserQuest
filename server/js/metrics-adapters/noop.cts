interface NoopMeta {
    reason?: string;
    invalidFields?: unknown;
    error?: unknown;
}

function createNoopMetricsAdapter(meta?: NoopMeta): unknown {
    const details = meta || {};
    return {
        isEnabled: false,
        isReady: false,
        reason: details.reason || 'disabled',
        invalidFields: Array.isArray(details.invalidFields) ? details.invalidFields : [],
        error: details.error || null,
        ready: function (callback?: () => void) {
            if (typeof callback === 'function') {
                callback();
            }
        },
        updatePlayerCounters: function (worlds: unknown, updatedCallback?: (totalPlayers: number) => void) {
            if (typeof updatedCallback === 'function') {
                const totalPlayers = Array.isArray(worlds)
                    ? worlds.reduce(function (sum, world) {
                          return sum + (world && Number.isFinite((world as { playerCount?: unknown }).playerCount)
                              ? Number((world as { playerCount?: unknown }).playerCount)
                              : 0);
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

module.exports = {
    createNoopMetricsAdapter: createNoopMetricsAdapter,
};
