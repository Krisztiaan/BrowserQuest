import { expect, spyOn, test } from 'bun:test';
import * as visualMovementBridge from '../../../client/ecs/visual-movement-bridge';
import {
    runClientSimulationSystem,
    type ClientSimulationSystemHost,
} from '../../../client/ecs/systems/client-simulation-system';

type InterpolatedNonCharacterFixture = {
    id: number;
    isLoaded: boolean;
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    dirtyCount: number;
    setDirty(): void;
};

function createInterpolatedNonCharacter({
    x,
    y,
    targetX,
    targetY,
}: {
    x: number;
    y: number;
    targetX: number;
    targetY: number;
}): InterpolatedNonCharacterFixture {
    const fixture: InterpolatedNonCharacterFixture = {
        id: 4242,
        isLoaded: true,
        x,
        y,
        targetX,
        targetY,
        dirtyCount: 0,
        setDirty() {
            fixture.dirtyCount += 1;
        },
    };
    return fixture;
}

function createSimulationHost({
    currentTime,
    entity,
}: {
    currentTime: number;
    entity: InterpolatedNonCharacterFixture;
}): ClientSimulationSystemHost {
    return {
        started: true,
        currentTime,
        playerAggroTimer: {
            isOver() {
                return false;
            },
        },
        player: null,
        playerId: null,
        kernel: {
            enqueueClientCommand() {},
            clientMoveInputKeysMask: 0,
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
            callback(entity);
        },
        initAnimatedTiles() {},
        endZoning() {},
        forEachAnimatedTile() {},
        checkOtherDirtyRects() {},
    };
}

test('bridgeEntityRenderPosition sets the render position and marks the entity dirty', () => {
    let dirtyCount = 0;
    const entity = {
        x: 0,
        y: 0,
        setDirty() {
            dirtyCount += 1;
        },
    };

    visualMovementBridge.bridgeEntityRenderPosition(entity, { x: 48, y: 64 });

    expect(entity.x).toBe(48);
    expect(entity.y).toBe(64);
    expect(dirtyCount).toBe(1);
});

test('non-character interpolation routes render position writes through the bridge', () => {
    const bridgeSpy = spyOn(visualMovementBridge, 'bridgeEntityRenderPosition');
    try {
        const item = createInterpolatedNonCharacter({ x: 160, y: 176, targetX: 176, targetY: 176 });

        runClientSimulationSystem(createSimulationHost({ currentTime: 50_000, entity: item }));
        bridgeSpy.mockClear();
        const xBefore = item.x;
        const dirtyBefore = item.dirtyCount;

        runClientSimulationSystem(createSimulationHost({ currentTime: 50_016, entity: item }));

        expect(bridgeSpy).toHaveBeenCalledTimes(1);
        expect(bridgeSpy.mock.calls[0]?.[0]).toBe(item);
        expect(item.x).toBeGreaterThan(xBefore);
        expect(item.x).toBeLessThanOrEqual(176);
        expect(item.y).toBe(176);
        expect(item.dirtyCount).toBeGreaterThan(dirtyBefore);
    } finally {
        bridgeSpy.mockRestore();
    }
});

test('non-character snap recovery also routes through the bridge', () => {
    const bridgeSpy = spyOn(visualMovementBridge, 'bridgeEntityRenderPosition');
    try {
        const item = createInterpolatedNonCharacter({ x: 0, y: 0, targetX: 4000, targetY: 4000 });

        runClientSimulationSystem(createSimulationHost({ currentTime: 60_000, entity: item }));

        expect(bridgeSpy).toHaveBeenCalled();
        expect(item.x).toBe(4000);
        expect(item.y).toBe(4000);
        expect(item.dirtyCount).toBeGreaterThan(0);
    } finally {
        bridgeSpy.mockRestore();
    }
});
