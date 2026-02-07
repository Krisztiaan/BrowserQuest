import { expect, test } from 'bun:test';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MainModule = require('../../server/js/main');

test('server main module exports shared startup helpers', () => {
    expect(typeof MainModule.main).toBe('function');
    expect(typeof MainModule.getConfigFile).toBe('function');
    expect(typeof MainModule.getWorldDistribution).toBe('function');
});
