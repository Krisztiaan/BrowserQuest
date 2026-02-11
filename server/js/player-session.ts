import Log from './log';
import FormatModule from './format';
import { createPlayerSessionActionDispatcher } from './player-session-dispatch';
import Types from '../../shared/js/gametypes-browser';
import type { ClientToServerProtocolAction } from '../../shared/js/protocol-contract-types';
import { HANDSHAKE_CONTROL } from '../../shared/js/connection-status';
import type Player from './player';

const check = FormatModule.check as (payload: ClientToServerProtocolAction) => boolean;
const log = Log.getLogger();

export function attachPlayerSession(player: Player): void {
    const closeInvalidPayload = (reason: string): void => {
        if (typeof player.connection.closeInvalidPayload === 'function') {
            player.connection.closeInvalidPayload(reason);
        } else {
            player.connection.close(reason);
        }
    };
    const dispatchAction = createPlayerSessionActionDispatcher(player, closeInvalidPayload);

    player.connection.listen((message: ClientToServerProtocolAction) => {
        const action = message[0];

        log.debug('Received: ' + message);
        if (!check(message)) {
            closeInvalidPayload('Invalid ' + Types.getMessageTypeAsString(action) + ' message format: ' + message);
            return;
        }

        if (!player.hasEnteredGame && action !== Types.Messages.HELLO) {
            closeInvalidPayload('Invalid handshake message: ' + message);
            return;
        }

        if (player.hasEnteredGame && !player.isDead && action === Types.Messages.HELLO) {
            closeInvalidPayload('Cannot initiate handshake twice: ' + message);
            return;
        }

        player.resetTimeout();
        if (!dispatchAction(message)) {
            player.emit('message', message);
        }
    });

    player.connection.onClose(() => {
        if (player.firepotionTimeout) {
            clearTimeout(player.firepotionTimeout);
        }
        if (player.disconnectTimeout) {
            clearTimeout(player.disconnectTimeout);
        }
        player.emit('exit');
    });

    player.connection.sendUTF8(HANDSHAKE_CONTROL.GO);
}
