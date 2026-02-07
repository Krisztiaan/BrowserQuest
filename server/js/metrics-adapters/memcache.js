var Metrics = require('../metrics');

function createMemcacheMetricsAdapter(config, options) {
    var adapterOptions = options || {};
    var metrics = new Metrics(config, adapterOptions);
    metrics.isEnabled = true;

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
