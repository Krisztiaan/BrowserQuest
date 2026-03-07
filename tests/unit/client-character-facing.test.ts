import { expect, test } from 'bun:test';
import Character from '../../client/character';
import Types from '../../shared/gametypes-browser';

function attachTestSprite(character: Character): void {
    const image = {} as CanvasImageSource;
    character.setSprite({
        image,
        isLoaded: true,
        offsetX: 0,
        offsetY: 0,
        width: 16,
        height: 16,
        name: 'test',
        silhouetteSprite: {
            image,
            isLoaded: true,
            offsetX: 0,
            offsetY: 0,
            width: 16,
            height: 16,
        },
        getHurtSprite: () => undefined,
        createAnimations: () => ({
            idle_down: {
                name: 'idle_down',
                reset() {},
                setSpeed() {},
                setCount() {},
            },
            idle_right: {
                name: 'idle_right',
                reset() {},
                setSpeed() {},
                setCount() {},
            },
            idle_up: {
                name: 'idle_up',
                reset() {},
                setSpeed() {},
                setCount() {},
            },
            walk_down: {
                name: 'walk_down',
                reset() {},
                setSpeed() {},
                setCount() {},
            },
            walk_right: {
                name: 'walk_right',
                reset() {},
                setSpeed() {},
                setCount() {},
            },
            walk_up: {
                name: 'walk_up',
                reset() {},
                setSpeed() {},
                setCount() {},
            },
            atk_down: {
                name: 'atk_down',
                reset() {},
                setSpeed() {},
                setCount() {},
            },
            atk_right: {
                name: 'atk_right',
                reset() {},
                setSpeed() {},
                setCount() {},
            },
            atk_up: {
                name: 'atk_up',
                reset() {},
                setSpeed() {},
                setCount() {},
            },
        }),
    });
}

test('stair-step diagonal movement keeps facing sticky instead of alternating every tile', () => {
    const character = new Character('c1', Types.Entities.WARRIOR);
    attachTestSprite(character);
    character.setGridPosition(10, 10);
    character.orientation = Types.Orientations.RIGHT;
    character.path = [
        [10, 10],
        [11, 10],
        [11, 11],
        [12, 11],
        [12, 12],
    ];

    character.step = 1;
    character.updateMovement();
    expect(character.orientation).toBe(Types.Orientations.RIGHT);
    expect(character.visualState.visualLocomotionState).toBe('walk');

    character.step = 2;
    character.updateMovement();
    expect(character.orientation).toBe(Types.Orientations.RIGHT);

    character.step = 3;
    character.updateMovement();
    expect(character.orientation).toBe(Types.Orientations.RIGHT);
});

test('movement facing still turns once the path becomes clearly cardinal', () => {
    const character = new Character('c2', Types.Entities.WARRIOR);
    attachTestSprite(character);
    character.setGridPosition(10, 10);
    character.orientation = Types.Orientations.RIGHT;
    character.path = [
        [10, 10],
        [11, 10],
        [11, 9],
        [11, 8],
    ];

    character.step = 1;
    character.updateMovement();
    expect(character.orientation).toBe(Types.Orientations.RIGHT);

    character.step = 2;
    character.updateMovement();
    expect(character.orientation).toBe(Types.Orientations.UP);
    expect(character.visualState.visualLocomotionState).toBe('walk');
});

test('visual character state can diverge from target render state without collapsing legacy render fields', () => {
    const character = new Character('c3', Types.Entities.WARRIOR);
    attachTestSprite(character);
    character.setGridPosition(10, 10);

    character.setVisualRenderPosition(160, 160, { velocityX: 2, velocityY: 0, mode: 'interpolate' });
    character.setVisualRenderTarget(176, 160, 'interpolate');

    expect(character.visualState.renderX).toBe(160);
    expect(character.visualState.targetRenderX).toBe(176);
    expect(character.x).toBe(160);
    expect(character.targetX).toBe(176);
    expect(character.visualState.visualMoveMode).toBe('interpolate');
});

test('ordinary movement visuals own stop-start churn without losing the visual locomotion contract', () => {
    const character = new Character('c4', Types.Entities.WARRIOR);
    attachTestSprite(character);
    character.setGridPosition(10, 10);

    character.applyOrdinaryMovementVisuals(1, 0);
    expect(character.orientation).toBe(Types.Orientations.RIGHT);
    expect(character.visualState.visualLocomotionState).toBe('walk');

    character.applyOrdinaryIdleVisuals();
    expect(character.visualState.visualLocomotionState).toBe('idle');

    character.applyOrdinaryMovementVisuals(0, -1);
    expect(character.orientation).toBe(Types.Orientations.UP);
    expect(character.visualState.visualLocomotionState).toBe('walk');
});

test('explicit turn overrides remain allowed outside ordinary movement ownership', () => {
    const character = new Character('c5', Types.Entities.WARRIOR);
    attachTestSprite(character);
    character.setGridPosition(10, 10);

    character.applyOrdinaryMovementVisuals(1, 0);
    character.turnTo(Types.Orientations.LEFT);

    expect(character.orientation).toBe(Types.Orientations.LEFT);
    expect(character.visualState.renderFacing).toBe(Types.Orientations.LEFT);
    expect(character.visualState.visualLocomotionState).toBe('idle');
});
