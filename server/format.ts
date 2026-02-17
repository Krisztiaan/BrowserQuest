import { isClientToServerProtocolAction } from '../shared/protocol/registry';
import { isKnownClientToServerOpcode } from '../shared/protocol/schema';
import type { ProtocolActionValue } from '../shared/protocol/types';
import Log from './log';

const log = Log.getLogger();

class FormatChecker {
    check(msg: ProtocolActionValue[]): boolean {
        if (isClientToServerProtocolAction(msg)) {
            return true;
        }

        if (msg.length === 0 || typeof msg[0] !== 'number') {
            return false;
        }

        const opcode = msg[0];
        if (!isKnownClientToServerOpcode(opcode)) {
            log.error('Unknown message type: ' + opcode);
        }
        return false;
    }
}

const checker = new FormatChecker();

const check = (msg: ProtocolActionValue[]): boolean => checker.check(msg);

export { FormatChecker, check };
export default { FormatChecker, check };
