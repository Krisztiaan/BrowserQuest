class Log {
    static ERROR = 0;
    static INFO = 1;
    static DEBUG = 2;

    static #LEVELS = {
        error: Log.ERROR,
        info: Log.INFO,
        debug: Log.DEBUG,
    };

    static #METHODS = {
        error: 'error',
        info: 'info',
        debug: 'log',
    };

    static #singletonLogger = new Log(Log.INFO);

    constructor(level) {
        this.level = level;
    }

    static getLogger() {
        return this.#singletonLogger;
    }

    static setLevel(level) {
        if (level !== Log.ERROR && level !== Log.INFO && level !== Log.DEBUG) {
            this.#singletonLogger.level = Log.INFO;
            return this.#singletonLogger;
        }
        this.#singletonLogger.level = level;
        return this.#singletonLogger;
    }

    #isEnabled(level) {
        return this.level >= level;
    }

    #write(method, args) {
        if (typeof console === 'undefined' || !console[method]) {
            return;
        }
        console[method].apply(console, args);
    }

    info(...args) {
        if (this.#isEnabled(Log.INFO)) {
            this.#write('info', args);
        }
    }

    debug(...args) {
        if (this.#isEnabled(Log.DEBUG)) {
            this.#write('log', args);
        }
    }

    error(...args) {
        if (this.#isEnabled(Log.ERROR)) {
            this.#write('error', args);
        }
    }

    event(levelName, eventName, fields) {
        const level = Log.#LEVELS[levelName] !== undefined ? Log.#LEVELS[levelName] : Log.INFO;
        if (!this.#isEnabled(level)) {
            return;
        }

        const method = Log.#METHODS[levelName] || 'info';
        const payload = {
            ts: new Date().toISOString(),
            level: levelName || 'info',
            event: eventName,
        };

        if (fields && typeof fields === 'object' && !Array.isArray(fields)) {
            for (const key in fields) {
                if (Object.prototype.hasOwnProperty.call(fields, key)) {
                    payload[key] = fields[key];
                }
            }
        } else if (fields !== undefined) {
            payload.payload = fields;
        }

        this.#write(method, [JSON.stringify(payload)]);
    }
}

export default Log;
