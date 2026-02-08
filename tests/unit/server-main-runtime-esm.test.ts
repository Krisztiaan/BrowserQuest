import { expect, test } from 'bun:test';
import MainRuntimeEsm, {
    createFatalReporter as createFatalReporterEsm,
    createPopulationChangeHandler as createPopulationChangeHandlerEsm,
    createPopulationCheckCleanup as createPopulationCheckCleanupEsm,
    createPopulationCheckTimer as createPopulationCheckTimerEsm,
    createRuntimeCleanup as createRuntimeCleanupEsm,
    createServerAndMetrics as createServerAndMetricsEsm,
    createServerEventEmitter as createServerEventEmitterEsm,
    createRuntimeDependencies as createRuntimeDependenciesEsm,
    createWorlds as createWorldsEsm,
    getWorldDistribution as getWorldDistributionEsm,
    initializeMetricsPopulation as initializeMetricsPopulationEsm,
    installFatalHandlers as installFatalHandlersEsm,
    installWorldPopulationHooks as installWorldPopulationHooksEsm,
    main as mainEsm,
    triggerFatalTestEvent as triggerFatalTestEventEsm,
} from '../../server/js/main-runtime-esm.mjs';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MainRuntimeCjs = require('../../server/js/main-runtime');

test('main runtime esm mirror exports cjs runtime contract', () => {
    expect(Object.keys(MainRuntimeEsm).sort()).toEqual(Object.keys(MainRuntimeCjs).sort());
    expect(typeof mainEsm).toBe('function');
    expect(typeof getWorldDistributionEsm).toBe('function');
    expect(typeof createRuntimeDependenciesEsm).toBe('function');
    expect(typeof createServerAndMetricsEsm).toBe('function');
    expect(typeof createWorldsEsm).toBe('function');
    expect(typeof createPopulationChangeHandlerEsm).toBe('function');
    expect(typeof installWorldPopulationHooksEsm).toBe('function');
    expect(typeof initializeMetricsPopulationEsm).toBe('function');
    expect(typeof createServerEventEmitterEsm).toBe('function');
    expect(typeof createPopulationCheckTimerEsm).toBe('function');
    expect(typeof createPopulationCheckCleanupEsm).toBe('function');
    expect(typeof createFatalReporterEsm).toBe('function');
    expect(typeof installFatalHandlersEsm).toBe('function');
    expect(typeof triggerFatalTestEventEsm).toBe('function');
    expect(typeof createRuntimeCleanupEsm).toBe('function');
    expect(mainEsm).toBe(MainRuntimeEsm.main);
    expect(getWorldDistributionEsm).toBe(MainRuntimeEsm.getWorldDistribution);
    expect(createRuntimeDependenciesEsm).toBe(MainRuntimeEsm.createRuntimeDependencies);
    expect(createServerAndMetricsEsm).toBe(MainRuntimeEsm.createServerAndMetrics);
    expect(createWorldsEsm).toBe(MainRuntimeEsm.createWorlds);
    expect(createPopulationChangeHandlerEsm).toBe(MainRuntimeEsm.createPopulationChangeHandler);
    expect(installWorldPopulationHooksEsm).toBe(MainRuntimeEsm.installWorldPopulationHooks);
    expect(initializeMetricsPopulationEsm).toBe(MainRuntimeEsm.initializeMetricsPopulation);
    expect(createServerEventEmitterEsm).toBe(MainRuntimeEsm.createServerEventEmitter);
    expect(createPopulationCheckTimerEsm).toBe(MainRuntimeEsm.createPopulationCheckTimer);
    expect(createPopulationCheckCleanupEsm).toBe(MainRuntimeEsm.createPopulationCheckCleanup);
    expect(createFatalReporterEsm).toBe(MainRuntimeEsm.createFatalReporter);
    expect(installFatalHandlersEsm).toBe(MainRuntimeEsm.installFatalHandlers);
    expect(triggerFatalTestEventEsm).toBe(MainRuntimeEsm.triggerFatalTestEvent);
    expect(createRuntimeCleanupEsm).toBe(MainRuntimeEsm.createRuntimeCleanup);
});
