import { expect, test } from 'bun:test';
import type { PlayerRuntimeConnection, PlayerRuntimeWorldServer } from '../../server/player-types';

test('player runtime seam interfaces accept compatibility shapes', () => {
    const connection: PlayerRuntimeConnection = {
        id: 'connection-id',
        listen() {},
        onClose() {},
        send() {},
        sendUTF8() {},
        close() {},
        closeInvalidPayload() {},
    };

    const worldServer: PlayerRuntimeWorldServer = {
        addPlayer() {},
        emit() {},
        isValidPosition() {
            return true;
        },
        getEntityById() {
            return undefined;
        },
        removeEntity() {},
        pushToPlayer() {},
        map: {
            getCheckpoint() {
                return null;
            },
        },
    };

    expect(connection.id).toBe('connection-id');
    expect(worldServer.isValidPosition(1, 2)).toBe(true);
});
