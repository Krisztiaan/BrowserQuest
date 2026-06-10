import { expect, test } from 'bun:test';
import Types from '../../../shared/gametypes-browser';
import { entityIdFromWire } from '../../../shared/domain/ids';
import { MOVE_INPUT_KEY_D, MOVE_INPUT_KEY_W } from '../../../shared/protocol/intents';
import { tileToWorldPosCenter } from '../../../shared/world/worldpos';
import { ClientWorldKernel } from '../../../client/ecs/world-kernel';
import {
    resetClientMovePosOutboxForTests,
    runClientMoveInputPredictionSystem,
} from '../../../client/ecs/systems/client-move-input-prediction-system';
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
            setLogicalWorldPositionSub: () => {},
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
    let logicalWorldX = start.x;
    let logicalWorldY = start.y;
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
            setLogicalWorldPositionSub: (worldX: number, worldY: number) => {
                logicalWorldX = worldX;
                logicalWorldY = worldY;
            },
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
    expect(logicalWorldX).toBe(kernel.clientPredictedWorldPos?.x);
    expect(logicalWorldY).toBe(kernel.clientPredictedWorldPos?.y);
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
            setLogicalWorldPositionSub: () => {},
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
            setLogicalWorldPositionSub: () => {},
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
            setLogicalWorldPositionSub: () => {},
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

function createOwnedModeHarness(wireId: number, startTile: { x: number; y: number }) {
    const kernel = new ClientWorldKernel();
    const playerId = entityIdFromWire(wireId);
    const start = tileToWorldPosCenter(startTile.x, startTile.y);
    kernel.upsertFromSpawnSnapshot({
        id: wireId,
        kind: Types.Entities.WARRIOR,
        x: startTile.x,
        y: startTile.y,
        extras: {
            type: 'player',
            name: 'K',
            orientation: Types.Orientations.DOWN,
            armor: Types.Entities.CLOTHARMOR,
            weapon: Types.Entities.SWORD1,
        },
    });
    kernel.setWorldPosition(playerId, start.x, start.y);
    kernel.clientMovePosIntentSupported = true;

    const run = (currentTime: number) =>
        runClientMoveInputPredictionSystem({
            started: true,
            currentTime,
            kernel,
            playerId,
            player: {
                gridX: startTile.x,
                gridY: startTile.y,
                worldX: start.x,
                worldY: start.y,
                orientation: Types.Orientations.DOWN,
                isDead: false,
                isOnPlateau: false,
                isMoving: () => false,
                setVisualFacing: () => {},
                walk: () => {},
                idle: () => {},
                setLogicalWorldPositionSub: () => {},
                setVisualDivergenceClass: () => {},
                setVisualRenderTarget: () => {},
                setVisualRenderPosition: () => {},
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

    return { kernel, playerId, start, run };
}

function drainMovePosCommands(kernel: ClientWorldKernel) {
    return kernel
        .drainClientCommands()
        .filter((cmd): cmd is Extract<typeof cmd, { type: 'clientSendMovePos' }> => cmd.type === 'clientSendMovePos');
}

test('owned movement streams move.pos while keys are held and skips move.input reconciliation pull', () => {
    resetClientMovePosOutboxForTests();
    const { kernel, run, start } = createOwnedModeHarness(31, { x: 10, y: 10 });

    // Authoritative echo lags behind: owned mode must not get pulled toward it.
    kernel.setWorldPosition(entityIdFromWire(31), start.x - 512, start.y);
    kernel.pressClientMoveInputKey(MOVE_INPUT_KEY_D);
    run(10_000);

    const sent = drainMovePosCommands(kernel);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.moving).toBe(true);
    expect(sent[0]?.facing).toBe(Types.Orientations.RIGHT);
    // Pure prediction: moved right from the seed, unaffected by the lagging echo.
    expect(sent[0]?.x).toBeGreaterThan(start.x);
    expect(kernel.clientPredictedWorldPos?.x).toBe(sent[0]?.x);
});

test('owned movement throttles position-only updates to the send interval', () => {
    resetClientMovePosOutboxForTests();
    const { kernel, run } = createOwnedModeHarness(32, { x: 10, y: 10 });

    kernel.pressClientMoveInputKey(MOVE_INPUT_KEY_D);
    run(20_000);
    run(20_016); // 16ms later: position changed but inside the 50ms window
    const burst = drainMovePosCommands(kernel);
    expect(burst).toHaveLength(1);

    run(20_064); // past the window: next sample goes out
    expect(drainMovePosCommands(kernel)).toHaveLength(1);
});

test('owned movement publishes a final moving=false update when keys are released', () => {
    resetClientMovePosOutboxForTests();
    const { kernel, run } = createOwnedModeHarness(33, { x: 10, y: 10 });

    kernel.pressClientMoveInputKey(MOVE_INPUT_KEY_D);
    run(30_000);
    const moving = drainMovePosCommands(kernel);
    expect(moving).toHaveLength(1);

    kernel.releaseClientMoveInputKey(MOVE_INPUT_KEY_D);
    run(30_032);
    run(30_048); // idle frames after the stop must not re-send
    const stopped = drainMovePosCommands(kernel);
    expect(stopped).toHaveLength(1);
    expect(stopped[0]?.moving).toBe(false);
    expect(stopped[0]?.x).toBe(moving[0]?.x ?? 0);
});

test('owned movement stays silent and resets the stream while corrections suppress local ownership', () => {
    resetClientMovePosOutboxForTests();
    const { kernel, run } = createOwnedModeHarness(34, { x: 10, y: 10 });

    kernel.pressClientMoveInputKey(MOVE_INPUT_KEY_D);
    kernel.clientMovementSuppressed = true;
    run(40_000);
    expect(drainMovePosCommands(kernel)).toHaveLength(0);

    kernel.clientMovementSuppressed = false;
    run(40_016);
    const resumed = drainMovePosCommands(kernel);
    expect(resumed).toHaveLength(1);
    expect(resumed[0]?.moving).toBe(true);
});
