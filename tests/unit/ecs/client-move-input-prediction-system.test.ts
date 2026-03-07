import { expect, test } from 'bun:test';
import Types from '../../../shared/gametypes-browser';
import { entityIdFromWire } from '../../../shared/domain/ids';
import { MOVE_INPUT_KEY_D, MOVE_INPUT_KEY_W } from '../../../shared/protocol/intents';
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
        currentTime: 1_100,
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

test('move-input prediction updates local player target without render snapping', () => {
    const kernel = new ClientWorldKernel();
    const playerId = entityIdFromWire(2);
    const start = tileToWorldPosCenter(10, 10);
    const setWorldPositionSubCalls: Array<{ worldX: number; worldY: number; snapRender: boolean }> = [];

    kernel.upsertFromSpawnSnapshot({
        id: 2,
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

    runClientMoveInputPredictionSystem({
        started: true,
        currentTime: 1_400,
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
            setWorldPositionSub: (worldX: number, worldY: number, options?: { snapRender?: boolean }) => {
                setWorldPositionSubCalls.push({ worldX, worldY, snapRender: options?.snapRender === true });
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

    expect(setWorldPositionSubCalls).toHaveLength(1);
    expect(setWorldPositionSubCalls[0]?.worldX).toBeGreaterThan(start.x);
    expect(setWorldPositionSubCalls[0]?.snapRender).toBe(false);
    expect(kernel.clientPredictedWorldPos).not.toBeNull();
});

test('move-input prediction resumes from the local presentation target instead of older rendered state', () => {
    const kernel = new ClientWorldKernel();
    const playerId = entityIdFromWire(22);
    const start = tileToWorldPosCenter(10, 10);
    let predictedWorldX = 0;

    kernel.upsertFromSpawnSnapshot({
        id: 22,
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
    kernel.setClientPresentationTargetWorldPosition(playerId, start.x + 1024, start.y);
    kernel.pressClientMoveInputKey(MOVE_INPUT_KEY_D);

    runClientMoveInputPredictionSystem({
        started: true,
        currentTime: 1_500,
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
            setWorldPositionSub: (worldX: number) => {
                predictedWorldX = worldX;
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

    expect(predictedWorldX).toBeGreaterThan(start.x + 1024);
});

test('move-input prediction ignores tiny authoritative drift inside deadzone', () => {
    const kernel = new ClientWorldKernel();
    const playerId = entityIdFromWire(3);
    const start = tileToWorldPosCenter(10, 10);
    let predictedWorldX = 0;

    kernel.upsertFromSpawnSnapshot({
        id: 3,
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
    kernel.setWorldPosition(playerId, start.x + 2 * 256, start.y);
    kernel.pressClientMoveInputKey(MOVE_INPUT_KEY_D);

    runClientMoveInputPredictionSystem({
        started: true,
        currentTime: 1_600,
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
            setWorldPositionSub: (worldX: number) => {
                predictedWorldX = worldX;
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

    expect(predictedWorldX).toBeGreaterThan(start.x + 2 * 256);
    expect(predictedWorldX).toBeLessThan(start.x + 2048);
});

test('move-input prediction treats diagonal authority drift with the same deadzone feel as cardinal drift', () => {
    const kernel = new ClientWorldKernel();
    const playerId = entityIdFromWire(4);
    const start = tileToWorldPosCenter(10, 10);
    let predictedWorldX = 0;
    let predictedWorldY = 0;

    kernel.upsertFromSpawnSnapshot({
        id: 4,
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
    kernel.setWorldPosition(playerId, start.x + 748, start.y - 748);
    kernel.pressClientMoveInputKey(MOVE_INPUT_KEY_D);
    kernel.pressClientMoveInputKey(MOVE_INPUT_KEY_W);

    runClientMoveInputPredictionSystem({
        started: true,
        currentTime: 1_800,
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
            setWorldPositionSub: (worldX: number, worldY: number) => {
                predictedWorldX = worldX;
                predictedWorldY = worldY;
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

    expect(predictedWorldX).toBe(start.x + 1405);
    expect(predictedWorldY).toBe(start.y - 1405);
});
