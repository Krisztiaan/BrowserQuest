import { expect, test } from 'bun:test';
import type { PlayerRuntimeConnection, PlayerRuntimeWorldServer } from '../../server/js/player-types';
import {
    PLAYER_CALLBACK_FIELDS,
    PLAYER_CONSTRUCTOR_FIELDS,
    PLAYER_RUNTIME_DEPENDENCY_BOUNDARIES,
    PLAYER_SHADOW_SOURCE_CONTRACT,
} from '../../server/js/player-types';

function hasDuplicates(values: readonly string[]): boolean {
    return new Set(values).size !== values.length;
}

test('player shadow-source contract inventory is deterministic', () => {
    expect(PLAYER_RUNTIME_DEPENDENCY_BOUNDARIES.length).toBe(9);
    expect(hasDuplicates(PLAYER_RUNTIME_DEPENDENCY_BOUNDARIES)).toBe(false);
    expect(PLAYER_RUNTIME_DEPENDENCY_BOUNDARIES).toContain('./character');
    expect(PLAYER_RUNTIME_DEPENDENCY_BOUNDARIES).toContain('./format');

    expect(PLAYER_CONSTRUCTOR_FIELDS.length).toBe(10);
    expect(hasDuplicates(PLAYER_CONSTRUCTOR_FIELDS)).toBe(false);
    expect(PLAYER_CONSTRUCTOR_FIELDS).toContain('connection');
    expect(PLAYER_CONSTRUCTOR_FIELDS).toContain('firepotionTimeout');

    expect(PLAYER_CALLBACK_FIELDS.length).toBe(1);
    expect(hasDuplicates(PLAYER_CALLBACK_FIELDS)).toBe(false);
    expect(PLAYER_CALLBACK_FIELDS).toContain('requestpos_callback');

    expect(PLAYER_SHADOW_SOURCE_CONTRACT.dependencyBoundaries).toEqual(PLAYER_RUNTIME_DEPENDENCY_BOUNDARIES);
    expect(PLAYER_SHADOW_SOURCE_CONTRACT.constructorFields).toEqual(PLAYER_CONSTRUCTOR_FIELDS);
    expect(PLAYER_SHADOW_SOURCE_CONTRACT.callbackFields).toEqual(PLAYER_CALLBACK_FIELDS);
});

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
            return null;
        },
        handleMobHate() {},
        broadcastAttacker() {},
        handleHurtEntity() {},
        removeEntity() {},
        handleOpenedChest() {},
        handlePlayerVanish() {},
        pushRelevantEntityListTo() {},
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
