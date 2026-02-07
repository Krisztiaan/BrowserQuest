import { expect, test } from 'bun:test';
import MetricsEsm, { Metrics as MetricsNamedEsm } from '../../server/js/metrics-esm.mjs';
import MetricsRuntimeEsm, { createMetrics as createMetricsEsm } from '../../server/js/metrics-runtime-esm.mjs';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MetricsCjs = require('../../server/js/metrics');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const MetricsRuntimeCjs = require('../../server/js/metrics-runtime');

test('metrics esm mirror exports cjs metrics class contract', () => {
    expect(MetricsEsm).toBe(MetricsCjs);
    expect(MetricsNamedEsm).toBe(MetricsCjs);
});

test('metrics runtime esm mirror exports cjs runtime contract', () => {
    expect(MetricsRuntimeEsm).toBe(MetricsRuntimeCjs);
    expect(createMetricsEsm).toBe(MetricsRuntimeCjs.createMetrics);
});
