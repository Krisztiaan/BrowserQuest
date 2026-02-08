type LogLevelName = 'error' | 'info' | 'debug';
type ConsoleMethod = 'error' | 'info' | 'log';

interface EventPayload {
    ts: string;
    level: string;
    event: string;
    [key: string]: unknown;
}

class Log {
    static ERROR = 0;
    static INFO = 1;
    static DEBUG = 2;

    static getLogger(): Log {
        return singletonLogger;
    }

    static setLevel(level: number): Log {
        if (level !== Log.ERROR && level !== Log.INFO && level !== Log.DEBUG) {
            singletonLogger.level = Log.INFO;
            return singletonLogger;
        }
        singletonLogger.level = level;
        return singletonLogger;
    }

    level: number;

    constructor(level: number) {
        this.level = level;
    }

    private _isEnabled(level: number): boolean {
        return this.level >= level;
    }

    private _write(method: ConsoleMethod, args: unknown[]): void {
        if (typeof console === 'undefined' || !console[method]) {
            return;
        }
        (console[method] as (...values: unknown[]) => void)(...args);
    }

    info(...args: unknown[]): void {
        if (this._isEnabled(Log.INFO)) {
            this._write('info', args);
        }
    }

    debug(...args: unknown[]): void {
        if (this._isEnabled(Log.DEBUG)) {
            this._write('log', args);
        }
    }

    error(...args: unknown[]): void {
        if (this._isEnabled(Log.ERROR)) {
            this._write('error', args);
        }
    }

    event(levelName: string, eventName: string, fields?: unknown): void {
        const resolvedLevelName = normalizeLevelName(levelName);
        const level = LEVELS[resolvedLevelName] !== undefined ? LEVELS[resolvedLevelName] : Log.INFO;

        if (!this._isEnabled(level)) {
            return;
        }

        const method = METHODS[resolvedLevelName] || 'info';
        const payload: EventPayload = {
            ts: new Date().toISOString(),
            level: levelName || 'info',
            event: eventName,
        };

        if (fields && typeof fields === 'object' && !Array.isArray(fields)) {
            for (const key of Object.keys(fields)) {
                if (Object.prototype.hasOwnProperty.call(fields, key)) {
                    payload[key] = (fields as Record<string, unknown>)[key];
                }
            }
        } else if (fields !== undefined) {
            payload.payload = fields;
        }

        this._write(method, [JSON.stringify(payload)]);
    }
}

function normalizeLevelName(levelName: string): LogLevelName | string {
    if (levelName === 'error' || levelName === 'info' || levelName === 'debug') {
        return levelName;
    }
    return levelName;
}

const LEVELS: Record<LogLevelName, number> = {
    error: Log.ERROR,
    info: Log.INFO,
    debug: Log.DEBUG,
};

const METHODS: Record<LogLevelName, ConsoleMethod> = {
    error: 'error',
    info: 'info',
    debug: 'log',
};

const singletonLogger = new Log(Log.INFO);

module.exports = Log;
