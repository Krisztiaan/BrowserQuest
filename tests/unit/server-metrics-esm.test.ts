import { expect, test } from 'bun:test';
import Metrics from '../../server/js/metrics';
import MetricsRuntime from '../../server/js/metrics-runtime';

test('metrics source export keeps class contract', () => {
    expect(typeof Metrics).toBe('function');
});

test('metrics runtime source export keeps runtime contract', () => {
    expect(typeof MetricsRuntime.createMetrics).toBe('function');
});
