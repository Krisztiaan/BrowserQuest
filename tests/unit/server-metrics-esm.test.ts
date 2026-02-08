import { expect, test } from 'bun:test';
import MetricsEsm, { Metrics as MetricsNamedEsm } from '../../server/js/metrics-esm.mjs';
import MetricsRuntimeEsm, { createMetrics as createMetricsEsm } from '../../server/js/metrics-runtime-esm.mjs';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MetricsCjs = require('../../server/js/metrics');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const MetricsRuntimeCjs = require('../../server/js/metrics-runtime');

test('metrics esm mirror exports cjs metrics class contract', () => {
    expect(typeof MetricsEsm).toBe('function');
    expect(MetricsEsm.name).toBe(MetricsCjs.name);
    expect(MetricsNamedEsm).toBe(MetricsEsm);
});

test('metrics runtime esm mirror exports cjs runtime contract', () => {
    expect(Object.keys(MetricsRuntimeEsm).sort()).toEqual(Object.keys(MetricsRuntimeCjs).sort());
    expect(typeof createMetricsEsm).toBe('function');
    expect(createMetricsEsm.name).toBe(MetricsRuntimeCjs.createMetrics.name);
    expect(createMetricsEsm).toBe(MetricsRuntimeEsm.createMetrics);
});
