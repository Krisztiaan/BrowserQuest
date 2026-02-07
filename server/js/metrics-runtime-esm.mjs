import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const MetricsRuntime = require('./metrics-runtime');

export const createMetrics = MetricsRuntime.createMetrics;
export default MetricsRuntime;
