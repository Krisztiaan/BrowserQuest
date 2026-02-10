import { expect, test } from 'bun:test';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Metrics = require('../../server/js/metrics') as Record<string, unknown>;
import MetricsRuntime from '../../server/js/metrics-runtime';

test('metrics source export keeps class contract', () => {
    expect(typeof Metrics).toBe('function');
});

test('metrics runtime source export keeps runtime contract', () => {
    expect(typeof MetricsRuntime.createMetrics).toBe('function');
});
