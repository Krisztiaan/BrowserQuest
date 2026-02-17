import Log from './log';
import FormatModule from './format';
import Types from '../shared/gametypes-browser';
import type { ClientToServerProtocolAction } from '../shared/protocol/types';
import { HANDSHAKE_CONTROL } from '../shared/connection-status';
import type { EntityId } from '../shared/domain/ids';
import { translateClientActionToCommand } from './player-session-command-translation';
import type { Command } from './ecs/commands';
import type { PersistedPlayerProfile } from './player-persistence';

const check = FormatModule.check as (payload: ClientToServerProtocolAction) => boolean;
const log = Log.getLogger();

type SessionConnection = {
    id: string;
    accountNameKey?: string;
    listen(callback: (message: ClientToServerProtocolAction) => void): void;
    onClose(callback: () => void): void;
    sendUTF8(payload: string): void;
    close(reason?: string): void;
    closeInvalidPayload?(reason: string): void;
};

type SessionWorld = {
    isPlayerActive(playerId: EntityId): boolean;
    enqueueCommand(command: Command): void;
    getConnectionPlayerById(playerId: EntityId): {
        isDead?: boolean;
        firepotionTimeout?: ReturnType<typeof setTimeout> | null;
        emit(eventName: 'exit'): void;
    } | null;
    resolveHelloProfile?(params: {
        connectionId: string;
        requestedName: string;
        authenticatedAccountNameKey?: string;
    }): Readonly<{ accepted: boolean; reason?: string; profile?: PersistedPlayerProfile }>;
    releaseSessionClaim?(connectionId: string): void;
};

export function attachWorldConnectionSession({
    connection,
    world,
    playerId,
}: {
    connection: SessionConnection;
    world: SessionWorld;
    playerId: EntityId;
}): void {
    const closeInvalidPayload = (reason: string): void => {
        if (typeof connection.closeInvalidPayload === 'function') {
            connection.closeInvalidPayload(reason);
        } else {
            connection.close(reason);
        }
    };

    let disconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    const resetTimeout = (): void => {
        if (disconnectTimeout) {
            clearTimeout(disconnectTimeout);
        }
        disconnectTimeout = setTimeout(() => {
            connection.sendUTF8(HANDSHAKE_CONTROL.TIMEOUT);
            connection.close('Player was idle for too long');
        }, 1000 * 60 * 15);
    };

    connection.listen((message: ClientToServerProtocolAction) => {
        const action = message[0];

        log.debug('Received: ' + message);
        if (!check(message)) {
            closeInvalidPayload('Invalid ' + Types.getMessageTypeAsString(action) + ' message format: ' + message);
            return;
        }

        const hasEnteredGame = world.isPlayerActive(playerId);
        const connectionPlayer = hasEnteredGame ? world.getConnectionPlayerById(playerId) : null;
        const playerIsDead = connectionPlayer?.isDead === true;
        if (!hasEnteredGame && action !== Types.Messages.HELLO) {
            closeInvalidPayload('Invalid handshake message: ' + message);
            return;
        }

        if (hasEnteredGame && action === Types.Messages.HELLO && !playerIsDead) {
            closeInvalidPayload('Cannot initiate handshake twice: ' + message);
            return;
        }

        resetTimeout();
        let command = translateClientActionToCommand(
            { connectionId: connection.id, playerId },
            message,
            closeInvalidPayload
        );
        if (command?.type === 'HELLO') {
            let resolved:
                | Readonly<{ accepted: boolean; reason?: string; profile?: PersistedPlayerProfile }>
                | undefined;
            try {
                resolved = world.resolveHelloProfile?.({
                    connectionId: connection.id,
                    requestedName: command.name,
                    authenticatedAccountNameKey: connection.accountNameKey,
                });
            } catch (error) {
                log.error('Failed to resolve HELLO profile: ' + String(error));
                connection.close('Unable to load player profile.');
                return;
            }
            if (resolved && !resolved.accepted) {
                connection.close(resolved.reason ?? 'Unable to enter world.');
                return;
            }
            if (resolved?.profile) {
                command = {
                    ...command,
                    profile: resolved.profile,
                };
            }
        }
        if (command) {
            world.enqueueCommand(command);
        }
    });

    connection.onClose(() => {
        world.releaseSessionClaim?.(connection.id);
        if (disconnectTimeout) {
            clearTimeout(disconnectTimeout);
            disconnectTimeout = null;
        }

        const player = world.getConnectionPlayerById(playerId);
        if (player) {
            if (player.firepotionTimeout) {
                clearTimeout(player.firepotionTimeout);
            }
            player.emit('exit');
        }
    });

    resetTimeout();
    connection.sendUTF8(HANDSHAKE_CONTROL.GO);
}
