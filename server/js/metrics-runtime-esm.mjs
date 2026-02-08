import * as MetricsRuntimeModule from './metrics-runtime.js';
const MetricsRuntime = /** @type {typeof import('./metrics-runtime')} */ (
    'default' in MetricsRuntimeModule ? MetricsRuntimeModule.default : MetricsRuntimeModule
);

export const createMetrics = MetricsRuntime.createMetrics;
export default MetricsRuntime;
