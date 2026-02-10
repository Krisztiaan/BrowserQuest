import Types from '../../shared/js/gametypes';
import { checkClientToServerProtocolAction, isFixedClientToServerOpcode } from '../../shared/js/protocol-schema';
import Log from './log';

const log = Log.getLogger();

class FormatChecker {
    check(msg: unknown[]): boolean {
        if (checkClientToServerProtocolAction(msg)) {
            return true;
        }

        if (msg.length === 0 || typeof msg[0] !== 'number') {
            return false;
        }

        const opcode = msg[0];
        if (!isFixedClientToServerOpcode(opcode) && opcode !== Types.Messages.WHO) {
            log.error('Unknown message type: ' + opcode);
        }
        return false;
    }
}

const checker = new FormatChecker();

const check = checker.check.bind(checker);

export { FormatChecker, check };
export default { FormatChecker, check };
