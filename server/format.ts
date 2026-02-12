import Types from '../shared/gametypes-browser';
import { isClientToServerProtocolAction } from '../shared/protocol/registry';
import { isFixedClientToServerOpcode } from '../shared/protocol/schema';
import Log from './log';

const log = Log.getLogger();

class FormatChecker {
    check(msg: unknown[]): boolean {
        if (isClientToServerProtocolAction(msg)) {
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

const check = (msg: unknown[]): boolean => checker.check(msg);

export { FormatChecker, check };
export default { FormatChecker, check };
