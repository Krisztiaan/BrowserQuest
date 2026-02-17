type LogValue = string | number | boolean | null | undefined | object;
type LogLevel = 'debug' | 'info' | 'error';

type LogGlobals = typeof globalThis & {
    __BQ_LOG_LEVEL__?: string;
    localStorage?: Pick<Storage, 'getItem'>;
    location?: { href?: string };
};

function parseLogLevel(value: string | null | undefined): LogLevel | null {
    if (!value) {
        return null;
    }
    const normalized = value.trim().toLowerCase();
    if (normalized === 'debug' || normalized === 'info' || normalized === 'error') {
        return normalized;
    }
    return null;
}

function readQueryLogLevel(globals: LogGlobals): LogLevel | null {
    try {
        const href = globals.location?.href;
        if (typeof href !== 'string') {
            return null;
        }
        const url = new URL(href);
        return (
            parseLogLevel(url.searchParams.get('logLevel'))
            ?? parseLogLevel(url.searchParams.get('bqLogLevel'))
            ?? (url.searchParams.has('debug') ? 'debug' : null)
        );
    } catch (_) {
        return null;
    }
}

function readStorageLogLevel(globals: LogGlobals): LogLevel | null {
    try {
        const raw = globals.localStorage?.getItem('bq_log_level');
        return parseLogLevel(raw);
    } catch (_) {
        return null;
    }
}

function resolveDefaultLogLevel(): LogLevel {
    const globals = globalThis as LogGlobals;
    return (
        parseLogLevel(globals.__BQ_LOG_LEVEL__)
        ?? readQueryLogLevel(globals)
        ?? readStorageLogLevel(globals)
        ?? 'info'
    );
}

class Logger {
    level: LogLevel;

    constructor(level: LogLevel) {
        this.level = level;
    }

    info(message: LogValue) {
        if (this.level === 'debug' || this.level === 'info') {
            console.info(message);
        }
    }

    debug(message: LogValue) {
        if (this.level === 'debug') {
            console.log(message);
        }
    }

    error(message: LogValue, stacktrace?: boolean) {
        console.error(message);
        if (stacktrace === true) {
            console.error(new Error().stack);
            console.error('-----------------------------');
        }
    }
}

const log = new Logger(resolveDefaultLogLevel());

export { Logger };
export default log;
