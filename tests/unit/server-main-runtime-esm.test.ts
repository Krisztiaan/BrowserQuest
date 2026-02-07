import { expect, test } from 'bun:test';
import MainRuntimeEsm, {
    createServerAndMetrics as createServerAndMetricsEsm,
    createRuntimeDependencies as createRuntimeDependenciesEsm,
    createWorlds as createWorldsEsm,
    getWorldDistribution as getWorldDistributionEsm,
    main as mainEsm,
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
});
