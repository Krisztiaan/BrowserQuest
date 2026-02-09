const Log = require('./log') as {
    getLogger(): { error(...args: unknown[]): void };
};

const Types = require('../../shared/js/gametypes') as {
    Messages: Record<string, number>;
};
import type { ClientToServerProtocolAction } from '../../shared/js/protocol-contract-types';

const log = Log.getLogger();

type MessageTypeFormat = Array<'n' | 's'>;
type ClientToServerFixedAction = Exclude<ClientToServerProtocolAction, [20, ...number[]]>;
type ClientToServerFixedOpcode = ClientToServerFixedAction[0];
type ClientToServerPayloadFor<TOpcode extends ClientToServerFixedOpcode> =
    Extract<ClientToServerFixedAction, [TOpcode, ...unknown[]]> extends [TOpcode, ...infer TPayload] ? TPayload : never;
type FormatTokenFor<TValue> = TValue extends number ? 'n' : TValue extends string ? 's' : never;
type MessageTypeFormatFor<TPayload extends readonly unknown[]> = {
    [TIndex in keyof TPayload]: FormatTokenFor<TPayload[TIndex]>;
};

type ClientToServerFormatSchema = {
    [TOpcode in ClientToServerFixedOpcode]: MessageTypeFormatFor<ClientToServerPayloadFor<TOpcode>>;
};

const CLIENT_TO_SERVER_FORMAT_SCHEMA: ClientToServerFormatSchema = {
    0: ['s', 'n', 'n'],
    4: ['n', 'n'],
    5: ['n', 'n', 'n'],
    6: ['n'],
    7: ['n'],
    8: ['n'],
    9: ['n'],
    11: ['s'],
    12: ['n'],
    15: ['n', 'n'],
    21: [],
    25: ['n'],
    26: ['n'],
};

function isValidNumberParam(param: unknown): param is number {
    return typeof param === 'number' && Number.isFinite(param) && Number.isSafeInteger(param);
}

function isFixedClientToServerOpcode(type: number): type is ClientToServerFixedOpcode {
    return type in CLIENT_TO_SERVER_FORMAT_SCHEMA;
}

class FormatChecker {
    private formats: ClientToServerFormatSchema;

    constructor() {
        this.formats = CLIENT_TO_SERVER_FORMAT_SCHEMA;
    }

    check(msg: unknown[]): boolean {
        const message = msg.slice(0);
        const type = message[0] as number;

        message.shift();

        if (isFixedClientToServerOpcode(type)) {
            const format = this.formats[type] as MessageTypeFormat;
            if (message.length !== format.length) {
                return false;
            }

            for (let i = 0; i < message.length; i += 1) {
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

exports.FormatChecker = FormatChecker;
exports.check = checker.check.bind(checker);
