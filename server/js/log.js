// AUTO-GENERATED from server/js/log.cts via bun run build:log.
// Do not edit server/js/log.js directly.

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Log {
    static ERROR = 0;
    static INFO = 1;
    static DEBUG = 2;
    static getLogger() {
        return singletonLogger;
    }
    static setLevel(level) {
        if (level !== Log.ERROR && level !== Log.INFO && level !== Log.DEBUG) {
            singletonLogger.level = Log.INFO;
            return singletonLogger;
        }
        singletonLogger.level = level;
        return singletonLogger;
    }
    level;
    constructor(level) {
        this.level = level;
    }
    _isEnabled(level) {
        return this.level >= level;
    }
    _write(method, args) {
        if (typeof console === 'undefined' || !console[method]) {
            return;
        }
        console[method](...args);
    }
    info(...args) {
        if (this._isEnabled(Log.INFO)) {
            this._write('info', args);
        }
    }
    debug(...args) {
        if (this._isEnabled(Log.DEBUG)) {
            this._write('log', args);
        }
    }
    error(...args) {
        if (this._isEnabled(Log.ERROR)) {
            this._write('error', args);
        }
    }
    event(levelName, eventName, fields) {
        const resolvedLevelName = normalizeLevelName(levelName);
        const level = LEVELS[resolvedLevelName] !== undefined ? LEVELS[resolvedLevelName] : Log.INFO;
        if (!this._isEnabled(level)) {
            return;
        }
        const method = METHODS[resolvedLevelName] || 'info';
        const payload = {
            ts: new Date().toISOString(),
            level: levelName || 'info',
            event: eventName,
        };
        if (fields && typeof fields === 'object' && !Array.isArray(fields)) {
            for (const key of Object.keys(fields)) {
                if (Object.prototype.hasOwnProperty.call(fields, key)) {
                    payload[key] = fields[key];
                }
            }
        }
        else if (fields !== undefined) {
            payload.payload = fields;
        }
        this._write(method, [JSON.stringify(payload)]);
    }
}
function normalizeLevelName(levelName) {
    if (levelName === 'error' || levelName === 'info' || levelName === 'debug') {
        return levelName;
    }
    return levelName;
}
const LEVELS = {
    error: Log.ERROR,
    info: Log.INFO,
    debug: Log.DEBUG,
};
const METHODS = {
    error: 'error',
    info: 'info',
    debug: 'log',
};
const singletonLogger = new Log(Log.INFO);
module.exports = Log;
