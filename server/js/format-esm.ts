import Log from './log-esm.ts';
import Types from '../../shared/js/gametypes-esm.ts';

const log = Log.getLogger();

function isValidNumberParam(param) {
    return typeof param === 'number' && Number.isFinite(param) && Number.isSafeInteger(param);
}

export class FormatChecker {
    constructor() {
        this.formats = [];
        this.formats[Types.Messages.HELLO] = ['s', 'n', 'n'];
        this.formats[Types.Messages.MOVE] = ['n', 'n'];
        this.formats[Types.Messages.LOOTMOVE] = ['n', 'n', 'n'];
        this.formats[Types.Messages.AGGRO] = ['n'];
        this.formats[Types.Messages.ATTACK] = ['n'];
        this.formats[Types.Messages.HIT] = ['n'];
        this.formats[Types.Messages.HURT] = ['n'];
        this.formats[Types.Messages.CHAT] = ['s'];
        this.formats[Types.Messages.LOOT] = ['n'];
        this.formats[Types.Messages.TELEPORT] = ['n', 'n'];
        this.formats[Types.Messages.ZONE] = [];
        this.formats[Types.Messages.OPEN] = ['n'];
        this.formats[Types.Messages.CHECK] = ['n'];
    }

    check(msg) {
        const message = msg.slice(0);
        const type = message[0];
        const format = this.formats[type];

        message.shift();

        if (format) {
            if (message.length !== format.length) {
                return false;
            }

            for (let i = 0, n = message.length; i < n; i += 1) {
                if (format[i] === 'n' && !isValidNumberParam(message[i])) {
                    return false;
                }
                if (format[i] === 's' && typeof message[i] !== 'string') {
                    return false;
                }
            }
            return true;
        }

        if (type === Types.Messages.WHO) {
            return message.length > 0 && message.every((param) => isValidNumberParam(param));
        }

        log.error('Unknown message type: ' + type);
        return false;
    }
}

const checker = new FormatChecker();

export function check(msg) {
    return checker.check(msg);
}

export default {
    FormatChecker,
    check,
};
