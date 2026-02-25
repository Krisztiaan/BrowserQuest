import { expect, test } from 'bun:test';
import Types from '../../../shared/gametypes-browser';
import { entityIdFromWire } from '../../../shared/domain/ids';
import { MOVE_INPUT_KEY_D } from '../../../shared/protocol/intents';
import { tileToWorldPosCenter } from '../../../shared/world/worldpos';
import { ClientWorldKernel } from '../../../client/ecs/world-kernel';
import { runClientMoveInputPredictionSystem } from '../../../client/ecs/systems/client-move-input-prediction-system';

test('move-input prediction does not move local player in lockstep mode', () => {
    const kernel = new ClientWorldKernel();
    const playerId = entityIdFromWire(1);
    const start = tileToWorldPosCenter(10, 10);

    kernel.upsertFromSpawnSnapshot({
        id: 1,
        kind: Types.Entities.WARRIOR,
        x: 10,
        y: 10,
        extras: {
            type: 'player',
            name: 'K',
            orientation: Types.Orientations.DOWN,
            armor: Types.Entities.CLOTHARMOR,
            weapon: Types.Entities.SWORD1,
        },
    });
    kernel.setWorldPosition(playerId, start.x, start.y);
    kernel.pressClientMoveInputKey(MOVE_INPUT_KEY_D);
    kernel.setClientMovementNetcodeMode('lockstep');

    let setWorldPositionSubCalls = 0;
    runClientMoveInputPredictionSystem({
        started: true,
        currentTime: 1_000,
        kernel,
        playerId,
        player: {
            gridX: 10,
            gridY: 10,
            worldX: start.x,
            worldY: start.y,
            isDead: false,
            isOnPlateau: false,
            isMoving: () => false,
            setWorldPositionSub: () => {
                setWorldPositionSubCalls += 1;
            },
        },
        map: {
            isOutOfBounds: () => false,
            isColliding: () => false,
            isPlateau: () => false,
            width: 100,
            height: 100,
        },
        isZoning: () => false,
        isZoningTile: () => false,
    });

    expect(setWorldPositionSubCalls).toBe(0);
    expect(kernel.clientPredictedWorldPos).toBeNull();
});
