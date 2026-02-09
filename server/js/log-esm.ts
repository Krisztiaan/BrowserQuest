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
    level: number;

    constructor(level: number) {
        this.level = level;
    }

    static getLogger() {
        return this.#singletonLogger;
    }

    static setLevel(level: number) {
        if (level !== Log.ERROR && level !== Log.INFO && level !== Log.DEBUG) {
            this.#singletonLogger.level = Log.INFO;
            return this.#singletonLogger;
        }
        this.#singletonLogger.level = level;
        return this.#singletonLogger;
    }

    #isEnabled(level: number): boolean {
        return this.level >= level;
    }

    #write(method: 'error' | 'info' | 'log', args: unknown[]): void {
        if (typeof console === 'undefined' || typeof console[method] !== 'function') {
            return;
        }
        console[method].apply(console, args);
    }

    info(...args: unknown[]): void {
        if (this.#isEnabled(Log.INFO)) {
            this.#write('info', args);
        }
    }

    debug(...args: unknown[]): void {
        if (this.#isEnabled(Log.DEBUG)) {
            this.#write('log', args);
        }
    }

    error(...args: unknown[]): void {
        if (this.#isEnabled(Log.ERROR)) {
            this.#write('error', args);
        }
    }

    event(levelName: string, eventName: string, fields: unknown): void {
        const level = Log.#LEVELS[levelName] !== undefined ? Log.#LEVELS[levelName] : Log.INFO;
        if (!this.#isEnabled(level)) {
            return;
        }

        const method = Log.#METHODS[levelName] || 'info';
        const payload: Record<string, unknown> = {
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
