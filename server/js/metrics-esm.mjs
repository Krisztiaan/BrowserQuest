import * as MetricsModule from './metrics.js';
const Metrics = /** @type {typeof import('./metrics')} */ (
    'default' in MetricsModule ? MetricsModule.default : MetricsModule
);

export { Metrics };
export default Metrics;
