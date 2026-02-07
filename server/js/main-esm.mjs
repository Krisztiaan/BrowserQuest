import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { validateConfig } from './config-preflight-esm.mjs';
import Utils from './utils-esm.mjs';

const require = createRequire(import.meta.url);
const defaultConfigPath = './server/config.json';
const customConfigPath = process.argv[2] || './server/config_local.json';

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

    if (!contractMatches) {
        console.error('ESM websocket bridge probe failed: contract mismatch.');
        process.exit(1);
    }
}

await runWebSocketBridgeProbeIfEnabled();

// Compatibility bridge: keep CJS server boot path intact while the ESM entry
// progressively validates and consumes wave-1 ESM modules.
require('./main.js');
