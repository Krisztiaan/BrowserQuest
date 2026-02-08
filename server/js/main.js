// AUTO-GENERATED from server/js/main.cts via bun run build:main.
// Do not edit server/js/main.js directly.

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require('node:fs');
const MainRuntime = require('./main-runtime');
function getConfigFile(path, callback) {
    fs.readFile(path, 'utf8', (err, jsonString) => {
        if (err) {
            console.error('Could not open config file:', err.path);
            callback(null);
            return;
        }
        try {
            callback(JSON.parse(jsonString));
        }
        catch (parseErr) {
            const message = parseErr instanceof Error ? parseErr.message : String(parseErr);
            console.error('Could not parse config file:', path, message);
            callback(null);
        }
    });
}
if (require.main === module) {
    const defaultConfigPath = './server/config.json';
    let customConfigPath = './server/config_local.json';
    process.argv.forEach((val, index) => {
        if (index === 2) {
            customConfigPath = val;
        }
    });
    getConfigFile(defaultConfigPath, (defaultConfig) => {
        getConfigFile(customConfigPath, (localConfig) => {
            if (localConfig) {
                MainRuntime.main(localConfig);
            }
            else if (defaultConfig) {
                MainRuntime.main(defaultConfig);
            }
            else {
                console.error('Server cannot start without any configuration file.');
                process.exit(1);
            }
        });
    });
}
module.exports = {
    main: MainRuntime.main,
    getConfigFile,
    getWorldDistribution: MainRuntime.getWorldDistribution,
    createRuntimeDependencies: MainRuntime.createRuntimeDependencies,
    createServerAndMetrics: MainRuntime.createServerAndMetrics,
    createWorlds: MainRuntime.createWorlds,
    createPopulationChangeHandler: MainRuntime.createPopulationChangeHandler,
    installWorldPopulationHooks: MainRuntime.installWorldPopulationHooks,
    initializeMetricsPopulation: MainRuntime.initializeMetricsPopulation,
    createServerEventEmitter: MainRuntime.createServerEventEmitter,
    createPopulationCheckTimer: MainRuntime.createPopulationCheckTimer,
    createPopulationCheckCleanup: MainRuntime.createPopulationCheckCleanup,
    createFatalReporter: MainRuntime.createFatalReporter,
    installFatalHandlers: MainRuntime.installFatalHandlers,
    triggerFatalTestEvent: MainRuntime.triggerFatalTestEvent,
    createRuntimeCleanup: MainRuntime.createRuntimeCleanup,
};
