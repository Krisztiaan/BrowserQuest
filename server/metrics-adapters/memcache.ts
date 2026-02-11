interface MetricsAdapter {
    isEnabled: boolean;
    ready(callback?: () => void): void;
    [key: string]: unknown;
}

import * as MetricsModule from '../metrics';

const Metrics = ((MetricsModule as unknown as { default?: unknown }).default
    ? (MetricsModule as unknown as { default: unknown }).default
    : MetricsModule) as new (config: unknown, options?: unknown) => MetricsAdapter;

interface MemcacheAdapterOptions {
    onReady?: () => void;
}

function createMemcacheMetricsAdapter(
    config: Record<string, unknown>,
    options?: MemcacheAdapterOptions
): MetricsAdapter {
    const adapterOptions = options || {};
    const metrics = new Metrics(config, adapterOptions);
    metrics.isEnabled = true;

    if (typeof adapterOptions.onReady === 'function') {
        const originalReady = metrics.ready;
        metrics.ready = function (callback?: () => void) {
            originalReady.call(metrics, function () {
                adapterOptions.onReady?.();
                if (typeof callback === 'function') {
                    callback();
                }
            });
        };
    }

    return metrics;
}

export { createMemcacheMetricsAdapter };

export default {
    createMemcacheMetricsAdapter,
};
