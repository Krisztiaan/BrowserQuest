class Logger {
    [key: string]: any;

    constructor(level) {
        this.level = level;
    }

    info(message) {
        if ((this.level === 'debug' || this.level === 'info') && globalThis.console) {
            console.info(message);
        }
    }

    debug(message) {
        if (this.level === 'debug' && globalThis.console) {
            console.log(message);
        }
    }

    error(message, stacktrace?) {
        if (!globalThis.console) return;
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
