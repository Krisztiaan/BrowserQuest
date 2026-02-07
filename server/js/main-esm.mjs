import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { validateConfig } from './config-preflight-esm.mjs';
import { main as startServer } from './main-runtime-esm.mjs';
import Utils from './utils-esm.mjs';

const require = createRequire(import.meta.url);
const defaultConfigPath = './server/config.json';
const customConfigPath = process.argv[2] || './server/config_local.json';

function emitProbeEvent(level, fields) {
    const payload = JSON.stringify({
        ts: new Date().toISOString(),
        level,
        event: 'server.esm.ws_bridge_probe',
        ...fields,
    });

    if (level === 'error') {
        console.error(payload);
        return;
    }
    console.info(payload);
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
        wsEsm.default === wsCjs &&
        wsEsm.CLOSE_CODES === wsCjs.CLOSE_CODES &&
        wsEsm.MultiVersionWebsocketServer === wsCjs.MultiVersionWebsocketServer &&
        wsEsm.wsWebSocketConnection === wsCjs.wsWebSocketConnection;
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

// Compatibility bridge: run the shared CJS startup path with validated config.
startServer(activeConfig);
