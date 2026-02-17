import { expect, test } from 'bun:test';
import * as RuntimeModule from '../../../server/runtime';

test('server runtime module exports startup/runtime helpers', () => {
    expect(typeof RuntimeModule.main).toBe('function');
    expect(typeof RuntimeModule.getWorldDistribution).toBe('function');
    expect(typeof RuntimeModule.createRuntimeDependencies).toBe('function');
    expect(typeof RuntimeModule.createServerAndMetrics).toBe('function');
    expect(typeof RuntimeModule.createWorlds).toBe('function');
    expect(typeof RuntimeModule.createPopulationChangeHandler).toBe('function');
    expect(typeof RuntimeModule.installWorldPopulationHooks).toBe('function');
    expect(typeof RuntimeModule.initializeMetricsPopulation).toBe('function');
    expect(typeof RuntimeModule.createServerEventEmitter).toBe('function');
    expect(typeof RuntimeModule.createPopulationCheckTimer).toBe('function');
    expect(typeof RuntimeModule.createPopulationCheckCleanup).toBe('function');
    expect(typeof RuntimeModule.createFatalReporter).toBe('function');
    expect(typeof RuntimeModule.installFatalHandlers).toBe('function');
    expect(typeof RuntimeModule.installShutdownHandlers).toBe('function');
    expect(typeof RuntimeModule.triggerFatalTestEvent).toBe('function');
    expect(typeof RuntimeModule.createRuntimeCleanup).toBe('function');
});
