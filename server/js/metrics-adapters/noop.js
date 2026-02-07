function createNoopMetricsAdapter(meta) {
    var details = meta || {};
    return {
        isEnabled: false,
        isReady: false,
        reason: details.reason || "disabled",
        invalidFields: Array.isArray(details.invalidFields) ? details.invalidFields : [],
        error: details.error || null,
        ready: function(callback) {
            if(typeof callback === "function") {
                callback();
            }
        },
        updatePlayerCounters: function(worlds, updatedCallback) {
            if(typeof updatedCallback === "function") {
                var totalPlayers = Array.isArray(worlds)
                    ? worlds.reduce(function(sum, world) {
                        return sum + (world && Number.isFinite(world.playerCount) ? world.playerCount : 0);
                    }, 0)
                    : 0;
                updatedCallback(totalPlayers);
            }
        },
        updateWorldDistribution: function() {},
        getOpenWorldCount: function(callback) {
            if(typeof callback === "function") {
                callback(null);
            }
        },
        getTotalPlayers: function(callback) {
            if(typeof callback === "function") {
                callback(null);
            }
        }
    };
}

module.exports = {
    createNoopMetricsAdapter: createNoopMetricsAdapter
};
