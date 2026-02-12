class Logger {
    level: 'debug' | 'info' | 'error';

    constructor(level: 'debug' | 'info' | 'error') {
        this.level = level;
    }

    info(message: unknown) {
        if (this.level === 'debug' || this.level === 'info') {
            console.info(message);
        }
    }

    debug(message: unknown) {
        if (this.level === 'debug') {
            console.log(message);
        }
    }

    error(message: unknown, stacktrace?: boolean) {
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
