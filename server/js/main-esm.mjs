import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { validateConfig } from './config-preflight-esm.mjs';
import { createRuntimeDependencies, main as startServer } from './main-runtime-esm.mjs';
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

async function runWebSocketBridgeProbeIfEnabled() {
    if (process.env.BQ_ESM_WS_BRIDGE_PROBE !== '1') {
        return;
    }

    const wsCjs = require('./ws');
    const wsEsm = await import('./ws-esm.mjs');
    const contractMatches =
        wsEsm.default &&
        wsEsm.default.CLOSE_CODES === wsEsm.CLOSE_CODES &&
        wsEsm.default.MultiVersionWebsocketServer === wsEsm.MultiVersionWebsocketServer &&
        wsEsm.default.wsWebSocketConnection === wsEsm.wsWebSocketConnection &&
        typeof wsEsm.MultiVersionWebsocketServer === 'function' &&
        typeof wsEsm.wsWebSocketConnection === 'function' &&
        wsEsm.CLOSE_CODES.NORMAL === wsCjs.CLOSE_CODES.NORMAL &&
        wsEsm.CLOSE_CODES.UNSUPPORTED_DATA === wsCjs.CLOSE_CODES.UNSUPPORTED_DATA &&
        wsEsm.CLOSE_CODES.INVALID_PAYLOAD === wsCjs.CLOSE_CODES.INVALID_PAYLOAD;
    const forceFail = process.env.BQ_ESM_WS_BRIDGE_PROBE_FORCE_FAIL === '1';

    if (!contractMatches || forceFail) {
        emitProbeEvent('error', {
            status: 'failed',
            reason: forceFail ? 'forced_failure' : 'contract_mismatch',
        });
        process.exit(1);
    }

    emitProbeEvent('info', {
        status: 'ok',
    });
}

await runWebSocketBridgeProbeIfEnabled();

async function createStartupRuntimeOptions() {
    if (process.env.BQ_ESM_WS_RUNTIME !== '1') {
        return undefined;
    }

    const wsEsm = await import('./ws-esm.mjs');
    emitStructuredEvent('info', 'server.esm.ws_runtime_mode', {
        mode: 'esm',
    });

    return {
        dependencies: createRuntimeDependencies({
            ws: wsEsm.default,
        }),
    };
}

const runtimeOptions = await createStartupRuntimeOptions();

// Compatibility bridge: run the shared CJS startup path with validated config.
startServer(activeConfig, runtimeOptions);
