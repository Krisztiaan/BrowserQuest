import { expect, test } from 'bun:test';
import * as MainRuntimeModule from '../../server/js/main-runtime';

const MainRuntime = MainRuntimeModule as Record<string, unknown>;

const expectedFunctions = [
    'main',
    'getWorldDistribution',
    'createRuntimeDependencies',
    'createServerAndMetrics',
    'createWorlds',
    'createPopulationChangeHandler',
    'installWorldPopulationHooks',
    'initializeMetricsPopulation',
    'createServerEventEmitter',
    'createPopulationCheckTimer',
    'createPopulationCheckCleanup',
    'createFatalReporter',
    'installFatalHandlers',
    'installShutdownHandlers',
    'triggerFatalTestEvent',
    'createRuntimeCleanup',
] as const;

test('main runtime source export contract stays compatible', () => {
    for (const fnName of expectedFunctions) {
        expect(typeof MainRuntime[fnName]).toBe('function');
    }
});
