import Metrics from '../metrics';
import type { RuntimeEventFields, RuntimeMetrics } from '../runtime-types';

interface MemcacheAdapterOptions {
    onReady?: () => void;
    onUnavailable?: (reason: string, fields?: RuntimeEventFields) => void;
}

function createMemcacheMetricsAdapter(
    config: ConstructorParameters<typeof Metrics>[0],
    options?: MemcacheAdapterOptions
): RuntimeMetrics {
    return new Metrics(config, options);
}

export { createMemcacheMetricsAdapter };

export default {
    createMemcacheMetricsAdapter,
};
