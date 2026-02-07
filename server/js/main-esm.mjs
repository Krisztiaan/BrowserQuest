import { createRequire } from 'node:module';
import { runWebSocketBridgeProbeIfEnabled } from './main-esm-bridge-probe.mjs';
import { resolveActiveConfig } from './main-esm-config-source.mjs';
import { ensureConfigPreflightValid, ensureConfigSourcePresent } from './main-esm-preflight-failures.mjs';
import { runStartupWithConfig } from './main-esm-startup-runner.mjs';
import { validateConfig } from './config-preflight-esm.mjs';
import { createRuntimeDependencies, main as startServer } from './main-runtime-esm.mjs';
import { resolveStartupRuntimeOptions } from './main-esm-runtime-options.mjs';
import Utils from './utils-esm.mjs';

const require = createRequire(import.meta.url);
const defaultConfigPath = './server/config.json';
const customConfigPath = process.argv[2] || './server/config_local.json';

function emitStructuredEvent(level, event, fields) {
    const payload = JSON.stringify({
        ts: new Date().toISOString(),
        level,
        event,
        ...fields,
    });

    if (level === 'error') {
        console.error(payload);
        return;
    }
    console.info(payload);
}

function emitProbeEvent(level, fields) {
    emitStructuredEvent(level, 'server.esm.ws_bridge_probe', fields);
}

const configSource = await resolveActiveConfig({
    defaultConfigPath,
    customConfigPath,
});
const activeConfig = configSource.activeConfig;

ensureConfigSourcePresent({
    activeConfig,
    emitError: (message) => console.error(message),
    fail: (code) => process.exit(code),
});

if (activeConfig) {
    ensureConfigPreflightValid({
        activeConfig,
        validateConfig,
        limitUtf8Bytes: Utils.limitUtf8Bytes,
        emitError: (message) => console.error(message),
        fail: (code) => process.exit(code),
    });
}

await runStartupWithConfig({
    activeConfig,
    env: process.env,
    emitStructuredEvent,
    emitProbeEvent,
    requireWsCjs: () => require('./ws'),
    importWsEsm: () => import('./ws-esm.mjs'),
    createRuntimeDependencies,
    startServer,
    fail: (code) => process.exit(code),
    runBridgeProbeFn: runWebSocketBridgeProbeIfEnabled,
    resolveRuntimeOptionsFn: resolveStartupRuntimeOptions,
});
