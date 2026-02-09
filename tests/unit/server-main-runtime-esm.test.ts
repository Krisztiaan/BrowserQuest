import { expect, test } from 'bun:test';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MainRuntime = require('../../server/js/main-runtime') as Record<string, unknown>;

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
    'triggerFatalTestEvent',
    'createRuntimeCleanup',
] as const;

test('main runtime source export contract stays compatible', () => {
    for (const fnName of expectedFunctions) {
        expect(typeof MainRuntime[fnName]).toBe('function');
    }
});
