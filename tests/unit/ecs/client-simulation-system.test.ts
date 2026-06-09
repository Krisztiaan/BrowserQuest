import { expect, test } from 'bun:test';
import Character from '../../../client/character';
import {
    runClientSimulationSystem,
    type ClientSimulationSystemHost,
} from '../../../client/ecs/systems/client-simulation-system';
import Types from '../../../shared/gametypes-browser';
import { entityIdFromWire } from '../../../shared/domain/ids';
import { setEntityGrid } from '../../support/mmo/client-gameplay';

function createSimulationHost({
    currentTime,
    player,
    playerId,
    entities,
    clientMoveInputKeysMask = 0,
    map = null,
    renderer = null,
    camera,
}: {
    currentTime: number;
    player: Character | null;
    playerId: number | null;
    entities: Character[];
    clientMoveInputKeysMask?: number;
    map?: ClientSimulationSystemHost['map'];
    renderer?: ClientSimulationSystemHost['renderer'];
    camera?: ClientSimulationSystemHost['camera'];
}): ClientSimulationSystemHost {
    return {
        started: true,
        currentTime,
        playerAggroTimer: {
            isOver() {
                return false;
            },
        },
        player,
        playerId: playerId !== null ? entityIdFromWire(playerId) : null,
        kernel: {
            enqueueClientCommand() {},
            clientMoveInputKeysMask,
            clientMovePlan: null,
        },
        map,
        renderer,
        camera: camera ?? {
            x: 0,
            y: 0,
            gridW: 30,
            gridH: 20,
            setPosition() {},
        },
        currentZoning: null,
        zoningOrientation: null,
        sparksAnimation: null,
        targetAnimation: null,
        bubbleManager: null,
        infoManager: {
            update() {},
        },
        forEachEntity(callback) {
            for (const entity of entities) {
                callback(entity);
            }
        },
        initAnimatedTiles() {},
        endZoning() {},
        forEachAnimatedTile() {},
        checkOtherDirtyRects() {},
    };
}

function createLoadedCharacter(id: number): Character {
    const character = new Character(id, Types.Entities.WARRIOR);
    character.isLoaded = true;
    setEntityGrid(character, 10, 10);
    return character;
}

test('client simulation gives the local player a stronger presentation catch-up while input is active', () => {
    const localPlayer = createLoadedCharacter(9001);
    const remotePlayer = createLoadedCharacter(9002);

    const localWarmup = createSimulationHost({
        currentTime: 20_000,
        player: localPlayer,
        playerId: 9001,
        entities: [localPlayer],
        clientMoveInputKeysMask: 1,
    });
    runClientSimulationSystem(localWarmup);

    localPlayer.setVisualRenderPosition(160, 160, { velocityX: 0, velocityY: 0, mode: 'interpolate' });
    localPlayer.setVisualRenderTarget(176, 160, 'interpolate');

    const localActive = createSimulationHost({
        currentTime: 20_016,
        player: localPlayer,
        playerId: 9001,
        entities: [localPlayer],
        clientMoveInputKeysMask: 1,
    });
    runClientSimulationSystem(localActive);

    const remoteWarmup = createSimulationHost({
        currentTime: 21_000,
        player: null,
        playerId: null,
        entities: [remotePlayer],
    });
    runClientSimulationSystem(remoteWarmup);

    remotePlayer.setVisualRenderPosition(160, 160, { velocityX: 0, velocityY: 0, mode: 'interpolate' });
    remotePlayer.setVisualRenderTarget(176, 160, 'interpolate');

    const remoteUpdate = createSimulationHost({
        currentTime: 21_016,
        player: null,
        playerId: null,
        entities: [remotePlayer],
    });
    runClientSimulationSystem(remoteUpdate);

    expect(localPlayer.x).toBeGreaterThan(remotePlayer.x);
    expect(localPlayer.x).toBeGreaterThan(166);
    expect(remotePlayer.x).toBeLessThan(164);
    expect(localPlayer.x - remotePlayer.x).toBeGreaterThan(2);
});

test('client simulation updates camera follow after local visual interpolation for the frame', () => {
    const localPlayer = createLoadedCharacter(9010);
    let cameraX = 0;
    let cameraY = 0;
    const testCamera: NonNullable<ClientSimulationSystemHost['camera']> = {
        x: 0,
        y: 0,
        gridW: 30,
        gridH: 20,
        setPosition(x: number, y: number) {
            cameraX = x;
            cameraY = y;
            testCamera.x = x;
            testCamera.y = y;
        },
    };
    const host = createSimulationHost({
        currentTime: 22_000,
        player: localPlayer,
        playerId: 9010,
        entities: [localPlayer],
        clientMoveInputKeysMask: 1,
        map: {
            grid: Array.from({ length: 100 }, () => Array.from({ length: 100 }, () => 0)),
        },
        renderer: {
            FPS: 60,
            mobile: false,
            tablet: false,
            scale: 1,
            getWidth() {
                return 160;
            },
            getHeight() {
                return 160;
            },
            renderStaticCanvases() {},
            getTileBoundingRect() {
                return { x: 0, y: 0, w: 0, h: 0, left: 0, right: 0, top: 0, bottom: 0 };
            },
        },
        camera: testCamera,
    });

    runClientSimulationSystem(host);

    localPlayer.setVisualRenderPosition(160, 160, { velocityX: 0, velocityY: 0, mode: 'interpolate' });
    localPlayer.setVisualRenderTarget(176, 160, 'interpolate');

    const oldDesiredCameraX = 80;
    cameraX = oldDesiredCameraX;
    cameraY = 80;
    testCamera.x = oldDesiredCameraX;
    testCamera.y = 80;
    runClientSimulationSystem({
        ...host,
        currentTime: 22_016,
    });

    expect(localPlayer.x).toBeGreaterThan(166);
    expect(cameraX).toBeGreaterThan(oldDesiredCameraX);
    expect(cameraY).toBeGreaterThanOrEqual(80);
});

test('client simulation camera bounds prefer full map dimensions over the current grid slice', () => {
    const localPlayer = createLoadedCharacter(9011);
    let cameraX = 160;
    let cameraY = 80;
    const testCamera: NonNullable<ClientSimulationSystemHost['camera']> = {
        x: cameraX,
        y: cameraY,
        gridW: 30,
        gridH: 20,
        setPosition(x: number, y: number) {
            cameraX = x;
            cameraY = y;
            testCamera.x = x;
            testCamera.y = y;
        },
    };

    localPlayer.setVisualRenderPosition(400, 160, { velocityX: 0, velocityY: 0, mode: 'interpolate' });
    localPlayer.setVisualRenderTarget(400, 160, 'interpolate');

    runClientSimulationSystem(createSimulationHost({
        currentTime: 23_000,
        player: localPlayer,
        playerId: 9011,
        entities: [localPlayer],
        map: {
            grid: Array.from({ length: 20 }, () => Array.from({ length: 20 }, () => 0)),
            width: 100,
            height: 100,
        },
        renderer: {
            FPS: 60,
            mobile: false,
            tablet: false,
            scale: 1,
            getWidth() {
                return 160;
            },
            getHeight() {
                return 160;
            },
            renderStaticCanvases() {},
            getTileBoundingRect() {
                return { x: 0, y: 0, w: 0, h: 0, left: 0, right: 0, top: 0, bottom: 0 };
            },
        },
        camera: testCamera,
    }));

    expect(cameraX).toBeGreaterThan(160);
    expect(cameraY).toBeGreaterThanOrEqual(80);
});
