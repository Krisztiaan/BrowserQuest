type LogLevelName = 'error' | 'info' | 'debug';
type ConsoleMethod = 'error' | 'info' | 'log';

export const ERROR = 0;
export const INFO = 1;
export const DEBUG = 2;

type RuntimeLogger = {
    level: number;
    info(...args: unknown[]): void;
    debug(...args: unknown[]): void;
    error(...args: unknown[]): void;
    event(levelName: string, eventName: string, fields?: unknown): void;
};

const LEVELS: Record<LogLevelName, number> = {
    error: ERROR,
    info: INFO,
    debug: DEBUG,
};

const METHODS: Record<LogLevelName, ConsoleMethod> = {
    error: 'error',
    info: 'info',
    debug: 'log',
};

function normalizeLevelName(levelName: string): LogLevelName | null {
    if (levelName === 'error' || levelName === 'info' || levelName === 'debug') {
        return levelName;
    }
    return null;
}

function write(method: ConsoleMethod, args: unknown[]): void {
    if (typeof console === 'undefined' || typeof console[method] !== 'function') {
        return;
    }
    console[method](...args);
}

const logger: RuntimeLogger = {
    level: INFO,

    info(...args: unknown[]): void {
        if (logger.level >= INFO) {
            write('info', args);
        }
    },

    debug(...args: unknown[]): void {
        if (logger.level >= DEBUG) {
            write('log', args);
        }
    },

    error(...args: unknown[]): void {
        if (logger.level >= ERROR) {
            write('error', args);
        }
    },

    event(levelName: string, eventName: string, fields?: unknown): void {
        const resolvedLevelName = normalizeLevelName(levelName);
        const level = resolvedLevelName ? LEVELS[resolvedLevelName] : INFO;

        if (logger.level < level) {
            return;
        }

        const method = resolvedLevelName ? METHODS[resolvedLevelName] : 'info';
        const payload: Record<string, unknown> = {
            ts: new Date().toISOString(),
            level: levelName || 'info',
            event: eventName,
        };

        if (fields && typeof fields === 'object' && !Array.isArray(fields)) {
            Object.assign(payload, fields);
        } else if (fields !== undefined) {
            payload.payload = fields;
        }

        write(method, [JSON.stringify(payload)]);
    },
};

function getLogger(): RuntimeLogger {
    return logger;
}

function setLevel(level: number): RuntimeLogger {
    if (level !== ERROR && level !== INFO && level !== DEBUG) {
        logger.level = INFO;
        return logger;
    }

    logger.level = level;
    return logger;
}

const Log = {
    ERROR,
    INFO,
    DEBUG,
    getLogger,
    setLevel,
};

export { getLogger, setLevel };
export default Log;
