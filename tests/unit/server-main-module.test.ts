import { expect, test } from 'bun:test';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MainModule = require('../../server/js/main');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const MainRuntimeModule = require('../../server/js/main-runtime');

test('server main module exports shared startup helpers', () => {
    expect(typeof MainModule.main).toBe('function');
    expect(typeof MainModule.getConfigFile).toBe('function');
    expect(typeof MainModule.getWorldDistribution).toBe('function');
    expect(typeof MainModule.createRuntimeDependencies).toBe('function');
    expect(typeof MainModule.createServerAndMetrics).toBe('function');
    expect(typeof MainModule.createWorlds).toBe('function');
    expect(typeof MainModule.createServerEventEmitter).toBe('function');
    expect(typeof MainModule.createPopulationCheckTimer).toBe('function');
    expect(typeof MainModule.createPopulationCheckCleanup).toBe('function');
    expect(typeof MainModule.createFatalReporter).toBe('function');
    expect(typeof MainModule.installFatalHandlers).toBe('function');
    expect(typeof MainModule.triggerFatalTestEvent).toBe('function');
    expect(typeof MainModule.createRuntimeCleanup).toBe('function');
    expect(MainModule.main).toBe(MainRuntimeModule.main);
    expect(MainModule.getWorldDistribution).toBe(MainRuntimeModule.getWorldDistribution);
    expect(MainModule.createRuntimeDependencies).toBe(MainRuntimeModule.createRuntimeDependencies);
    expect(MainModule.createServerAndMetrics).toBe(MainRuntimeModule.createServerAndMetrics);
    expect(MainModule.createWorlds).toBe(MainRuntimeModule.createWorlds);
    expect(MainModule.createServerEventEmitter).toBe(MainRuntimeModule.createServerEventEmitter);
    expect(MainModule.createPopulationCheckTimer).toBe(MainRuntimeModule.createPopulationCheckTimer);
    expect(MainModule.createPopulationCheckCleanup).toBe(MainRuntimeModule.createPopulationCheckCleanup);
    expect(MainModule.createFatalReporter).toBe(MainRuntimeModule.createFatalReporter);
    expect(MainModule.installFatalHandlers).toBe(MainRuntimeModule.installFatalHandlers);
    expect(MainModule.triggerFatalTestEvent).toBe(MainRuntimeModule.triggerFatalTestEvent);
    expect(MainModule.createRuntimeCleanup).toBe(MainRuntimeModule.createRuntimeCleanup);
});
