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
    expect(MainRuntimeEsm).toBe(MainRuntimeCjs);
    expect(mainEsm).toBe(MainRuntimeCjs.main);
    expect(getWorldDistributionEsm).toBe(MainRuntimeCjs.getWorldDistribution);
    expect(createRuntimeDependenciesEsm).toBe(MainRuntimeCjs.createRuntimeDependencies);
    expect(createServerAndMetricsEsm).toBe(MainRuntimeCjs.createServerAndMetrics);
    expect(createWorldsEsm).toBe(MainRuntimeCjs.createWorlds);
    expect(createPopulationChangeHandlerEsm).toBe(MainRuntimeCjs.createPopulationChangeHandler);
    expect(installWorldPopulationHooksEsm).toBe(MainRuntimeCjs.installWorldPopulationHooks);
    expect(initializeMetricsPopulationEsm).toBe(MainRuntimeCjs.initializeMetricsPopulation);
    expect(createServerEventEmitterEsm).toBe(MainRuntimeCjs.createServerEventEmitter);
    expect(createPopulationCheckTimerEsm).toBe(MainRuntimeCjs.createPopulationCheckTimer);
    expect(createPopulationCheckCleanupEsm).toBe(MainRuntimeCjs.createPopulationCheckCleanup);
    expect(createFatalReporterEsm).toBe(MainRuntimeCjs.createFatalReporter);
    expect(installFatalHandlersEsm).toBe(MainRuntimeCjs.installFatalHandlers);
    expect(triggerFatalTestEventEsm).toBe(MainRuntimeCjs.triggerFatalTestEvent);
    expect(createRuntimeCleanupEsm).toBe(MainRuntimeCjs.createRuntimeCleanup);
});
