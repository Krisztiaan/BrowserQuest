import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { runWebSocketBridgeProbeIfEnabled } from './main-esm-bridge-probe.mjs';
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

async function getConfigFile(configPath) {
    try {
        const raw = await fs.readFile(configPath, 'utf8');
        return JSON.parse(raw);
    } catch (_) {
        return null;
    }
}

const defaultConfig = await getConfigFile(defaultConfigPath);
const localConfig = await getConfigFile(customConfigPath);
const activeConfig = localConfig || defaultConfig;

if (!activeConfig) {
    console.error('Server cannot start without any configuration file.');
    process.exit(1);
}

const validationResult = validateConfig(activeConfig);
if (!validationResult.isValid) {
    const compactErrors = Utils.limitUtf8Bytes(JSON.stringify(validationResult.errors), 512);
    console.error(`ESM preflight: invalid server configuration: ${compactErrors}`);
    process.exit(1);
}

await runWebSocketBridgeProbeIfEnabled({
    env: process.env,
    emitProbeEvent,
    requireWsCjs: () => require('./ws'),
    importWsEsm: () => import('./ws-esm.mjs'),
    fail: (code) => process.exit(code),
});

const runtimeOptions = await resolveStartupRuntimeOptions({
    env: process.env,
    emitStructuredEvent,
    importWsEsm: () => import('./ws-esm.mjs'),
    createRuntimeDependencies,
    fail: (code) => process.exit(code),
});

// Compatibility bridge: run the shared CJS startup path with validated config.
startServer(activeConfig, runtimeOptions);
