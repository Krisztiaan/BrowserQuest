var Log = function (level) {
    this.level = level;
};

Log.ERROR = 0;
Log.INFO = 1;
Log.DEBUG = 2;

var LEVELS = {
    error: Log.ERROR,
    info: Log.INFO,
    debug: Log.DEBUG,
};

var METHODS = {
    error: 'error',
    info: 'info',
    debug: 'log',
};

Log.prototype._isEnabled = function (level) {
    return this.level >= level;
};

Log.prototype._write = function (method, args) {
    if (typeof console === 'undefined' || !console[method]) {
        return;
    }
    console[method].apply(console, args);
};

Log.prototype.info = function () {
    if (this._isEnabled(Log.INFO)) {
        this._write('info', arguments);
    }
};

Log.prototype.debug = function () {
    if (this._isEnabled(Log.DEBUG)) {
        this._write('log', arguments);
    }
};

Log.prototype.error = function () {
    if (this._isEnabled(Log.ERROR)) {
        this._write('error', arguments);
    }
};

Log.prototype.event = function (levelName, eventName, fields) {
    var level = LEVELS[levelName] !== undefined ? LEVELS[levelName] : Log.INFO;
    if (!this._isEnabled(level)) {
        return;
    }

    var method = METHODS[levelName] || 'info';
    var payload = {
        ts: new Date().toISOString(),
        level: levelName || 'info',
        event: eventName,
    };

    if (fields && typeof fields === 'object' && !Array.isArray(fields)) {
        for (var key in fields) {
            if (Object.prototype.hasOwnProperty.call(fields, key)) {
                payload[key] = fields[key];
            }
        }
    } else if (fields !== undefined) {
        payload.payload = fields;
    }

    this._write(method, [JSON.stringify(payload)]);
};

var singletonLogger = new Log(Log.INFO);

Log.getLogger = function () {
    return singletonLogger;
};

Log.setLevel = function (level) {
    if (level !== Log.ERROR && level !== Log.INFO && level !== Log.DEBUG) {
        singletonLogger.level = Log.INFO;
        return singletonLogger;
    }
    singletonLogger.level = level;
    return singletonLogger;
};

module.exports = Log;
