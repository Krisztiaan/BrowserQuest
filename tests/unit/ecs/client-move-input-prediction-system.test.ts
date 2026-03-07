import { expect, test } from 'bun:test';
import Types from '../../../shared/gametypes-browser';
import { entityIdFromWire } from '../../../shared/domain/ids';
import { MOVE_INPUT_KEY_D, MOVE_INPUT_KEY_W } from '../../../shared/protocol/intents';
import { tileToWorldPosCenter } from '../../../shared/world/worldpos';
import { ClientWorldKernel } from '../../../client/ecs/world-kernel';
import { runClientMoveInputPredictionSystem } from '../../../client/ecs/systems/client-move-input-prediction-system';
import { worldCenterToPixelTopLeft } from '../../../client/visual-character-state';

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

    let setVisualCalls = 0;
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
            setVisualDivergenceClass: () => {},
            setVisualRenderTarget: () => {
                setVisualCalls += 1;
            },
            setVisualRenderPosition: () => {
                setVisualCalls += 1;
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

    expect(setVisualCalls).toBe(0);
    expect(kernel.clientPredictedWorldPos).toBeNull();
});

test('move-input prediction updates local player target without render snapping', () => {
    const kernel = new ClientWorldKernel();
    const playerId = entityIdFromWire(2);
    const start = tileToWorldPosCenter(10, 10);
    const setVisualRenderTargetCalls: Array<{ x: number; y: number; mode: string | undefined }> = [];
    let divergenceClass = '';

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
            setVisualDivergenceClass: (next: string) => {
                divergenceClass = next;
            },
            setVisualRenderTarget: (x: number, y: number, mode?: string) => {
                setVisualRenderTargetCalls.push({ x, y, mode });
            },
            setVisualRenderPosition: () => {
                throw new Error('Prediction should not snap local render position during ordinary move input');
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

    expect(setVisualRenderTargetCalls).toHaveLength(1);
    expect(setVisualRenderTargetCalls[0]?.x).toBeGreaterThan(worldCenterToPixelTopLeft(start.x, start.y).x);
    expect(setVisualRenderTargetCalls[0]?.mode).toBe('interpolate');
    expect(divergenceClass).toBe('ordinary');
    expect(kernel.clientPredictedWorldPos).not.toBeNull();
});

test('move-input prediction resumes from the local presentation target instead of older rendered state', () => {
    const kernel = new ClientWorldKernel();
    const playerId = entityIdFromWire(22);
    const start = tileToWorldPosCenter(10, 10);
    let predictedRenderX = 0;

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
            setVisualDivergenceClass: () => {},
            setVisualRenderTarget: (x: number) => {
                predictedRenderX = x;
            },
            setVisualRenderPosition: () => {
                throw new Error('Prediction should not snap local render position while resuming movement');
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

    expect(predictedRenderX).toBeGreaterThan(worldCenterToPixelTopLeft(start.x + 1024, start.y).x);
});

test('move-input prediction ignores tiny authoritative drift inside deadzone', () => {
    const kernel = new ClientWorldKernel();
    const playerId = entityIdFromWire(3);
    const start = tileToWorldPosCenter(10, 10);
    let predictedRenderX = 0;

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
            setVisualDivergenceClass: () => {},
            setVisualRenderTarget: (x: number) => {
                predictedRenderX = x;
            },
            setVisualRenderPosition: () => {
                throw new Error('Prediction should not snap local render position for tiny drift');
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

    expect(predictedRenderX).toBeGreaterThan(worldCenterToPixelTopLeft(start.x + 2 * 256, start.y).x);
    expect(predictedRenderX).toBeLessThan(worldCenterToPixelTopLeft(start.x + 2048, start.y).x);
});

test('move-input prediction treats diagonal authority drift with the same deadzone feel as cardinal drift', () => {
    const kernel = new ClientWorldKernel();
    const playerId = entityIdFromWire(4);
    const start = tileToWorldPosCenter(10, 10);
    let predictedRenderX = 0;
    let predictedRenderY = 0;
    let divergenceClass = '';

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
            setVisualDivergenceClass: (next: string) => {
                divergenceClass = next;
            },
            setVisualRenderTarget: (x: number, y: number) => {
                predictedRenderX = x;
                predictedRenderY = y;
            },
            setVisualRenderPosition: () => {
                throw new Error('Prediction should not snap local render position for diagonal drift');
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

    expect(predictedRenderX).toBe(worldCenterToPixelTopLeft(start.x + 1405, start.y - 1405).x);
    expect(predictedRenderY).toBe(worldCenterToPixelTopLeft(start.x + 1405, start.y - 1405).y);
    expect(divergenceClass).toBe('ordinary');
});
