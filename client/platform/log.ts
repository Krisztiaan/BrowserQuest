type LogValue = string | number | boolean | null | undefined | object;

class Logger {
    level: 'debug' | 'info' | 'error';

    constructor(level: 'debug' | 'info' | 'error') {
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

const log = new Logger('debug');

export { Logger };
export default log;
