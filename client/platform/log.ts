type LogValue = string | number | boolean | null | undefined | object;
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
    level: LogLevel;

    constructor(level: LogLevel) {
        this.level = level;
    }

    setLevel(level: LogLevel): void {
        this.level = level;
    }

    info(message: LogValue) {
        if (this.level === 'debug' || this.level === 'info') {
            console.info(message);
        }
    }

    warn(message: LogValue) {
        if (this.level === 'debug' || this.level === 'info' || this.level === 'warn') {
            console.warn(message);
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

// Keep client runtime highly observable by default during active development.
const log = new Logger('debug');

export { Logger };
export default log;
