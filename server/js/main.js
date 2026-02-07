
var fs = require('fs'),
    MainRuntime = require('./main-runtime');

function getConfigFile(path, callback) {
    fs.readFile(path, 'utf8', function(err, json_string) {
        if(err) {
            console.error("Could not open config file:", err.path);
            callback(null);
        } else {
            try {
                callback(JSON.parse(json_string));
            } catch(parseErr) {
                console.error("Could not parse config file:", path, parseErr.message);
                callback(null);
            }
        }
    });
}

if(require.main === module) {
    var defaultConfigPath = './server/config.json',
        customConfigPath = './server/config_local.json';

    process.argv.forEach(function (val, index, array) {
        if(index === 2) {
            customConfigPath = val;
        }
    });

    getConfigFile(defaultConfigPath, function(defaultConfig) {
        getConfigFile(customConfigPath, function(localConfig) {
            if(localConfig) {
                MainRuntime.main(localConfig);
            } else if(defaultConfig) {
                MainRuntime.main(defaultConfig);
            } else {
                console.error("Server cannot start without any configuration file.");
                process.exit(1);
            }
        });
    });
}

module.exports = {
    main: MainRuntime.main,
    getConfigFile: getConfigFile,
    getWorldDistribution: MainRuntime.getWorldDistribution
};
