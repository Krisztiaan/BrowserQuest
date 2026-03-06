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
}: {
    currentTime: number;
    player: Character | null;
    playerId: number | null;
    entities: Character[];
    clientMoveInputKeysMask?: number;
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
        map: null,
        renderer: null,
        camera: {
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

    localPlayer.x = 160;
    localPlayer.y = 160;
    localPlayer.targetX = 176;
    localPlayer.targetY = 160;

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

    remotePlayer.x = 160;
    remotePlayer.y = 160;
    remotePlayer.targetX = 176;
    remotePlayer.targetY = 160;

    const remoteUpdate = createSimulationHost({
        currentTime: 21_016,
        player: null,
        playerId: null,
        entities: [remotePlayer],
    });
    runClientSimulationSystem(remoteUpdate);

    expect(localPlayer.x).toBeGreaterThan(remotePlayer.x);
    expect(localPlayer.x).toBeGreaterThan(166);
    expect(remotePlayer.x).toBeLessThan(163.5);
});
