var Metrics = require('../metrics');

function createMemcacheMetricsAdapter(config, options) {
    var metrics = new Metrics(config);
    metrics.isEnabled = true;
    var adapterOptions = options || {};

    if(typeof adapterOptions.onReady === "function") {
        var originalReady = metrics.ready;
        metrics.ready = function(callback) {
            originalReady.call(metrics, function() {
                adapterOptions.onReady();
                if(typeof callback === "function") {
                    callback();
                }
            });
        };
    }

    return metrics;
}

module.exports = {
    createMemcacheMetricsAdapter: createMemcacheMetricsAdapter
};
