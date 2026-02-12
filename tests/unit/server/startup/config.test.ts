import { expect, test } from 'bun:test';
import { loadConfigFile, resolveActiveConfig } from '../../../../server/startup/config';

test('config source resolver prefers local config over default config', async () => {
    const defaultConfig = { port: 8000, source: 'default' };
    const localConfig = { port: 9000, source: 'local' };

    const resolved = await resolveActiveConfig({
        defaultConfigPath: '/default.json',
        customConfigPath: '/local.json',
        loadConfigFileFn: (path) => {
            if (path === '/default.json') {
                return Promise.resolve(defaultConfig);
            }
            if (path === '/local.json') {
                return Promise.resolve(localConfig);
            }
            return Promise.resolve(null);
        },
    });

    expect(resolved.defaultConfig).toEqual(defaultConfig);
    expect(resolved.localConfig).toEqual(localConfig);
    expect(resolved.activeConfig).toEqual(localConfig);
});

test('config source resolver falls back to default config when local is missing', async () => {
    const defaultConfig = { port: 8000, source: 'default' };

    const resolved = await resolveActiveConfig({
        defaultConfigPath: '/default.json',
        customConfigPath: '/local.json',
        loadConfigFileFn: (path) => {
            if (path === '/default.json') {
                return Promise.resolve(defaultConfig);
            }
            return Promise.resolve(null);
        },
    });

    expect(resolved.defaultConfig).toEqual(defaultConfig);
    expect(resolved.localConfig).toBeNull();
    expect(resolved.activeConfig).toEqual(defaultConfig);
});

test('config source resolver returns null active config when both sources are missing', async () => {
    const resolved = await resolveActiveConfig({
        defaultConfigPath: '/default.json',
        customConfigPath: '/local.json',
        loadConfigFileFn: () => Promise.resolve(null),
    });

    expect(resolved.defaultConfig).toBeNull();
    expect(resolved.localConfig).toBeNull();
    expect(resolved.activeConfig).toBeNull();
});

test('loadConfigFile parses valid json and returns null on read/parse failures', async () => {
    const validConfig = await loadConfigFile('/valid.json', () => Promise.resolve('{"port":8000}'));
    expect(validConfig).toEqual({ port: 8000 });

    const invalidConfig = await loadConfigFile('/invalid.json', () => Promise.resolve('{'));
    expect(invalidConfig).toBeNull();

    const missingConfig = await loadConfigFile('/missing.json', () => Promise.reject(new Error('ENOENT')));
    expect(missingConfig).toBeNull();
});
