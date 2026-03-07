import { expect, test } from 'bun:test';
import Character from '../../client/character';
import {
    bridgeCharacterInterpolatedLocomotion,
    bridgeCharacterPathLocomotion,
    bridgeCharacterRenderPosition,
    bridgeCharacterRenderTarget,
    bridgeCharacterWorldUpdate,
} from '../../client/ecs/visual-movement-bridge';
import Types from '../../shared/gametypes-browser';

test('visual movement bridge updates character visual state and legacy render fields together', () => {
    const character = new Character('bridge-test', Types.Entities.WARRIOR);

    bridgeCharacterRenderPosition(character, {
        x: 160,
        y: 176,
        velocityX: 2,
        velocityY: 1,
        mode: 'interpolate',
    });
    bridgeCharacterRenderTarget(character, {
        x: 192,
        y: 176,
        mode: 'interpolate',
    });

    expect(character.visualState.renderX).toBe(160);
    expect(character.visualState.renderY).toBe(176);
    expect(character.visualState.targetRenderX).toBe(192);
    expect(character.visualState.targetRenderY).toBe(176);
    expect(character.x).toBe(160);
    expect(character.y).toBe(176);
    expect(character.targetX).toBe(192);
    expect(character.targetY).toBe(176);
    expect(character.visualState.visualMoveMode).toBe('interpolate');
});

test('visual movement bridge maps divergence classes into explicit recovery behavior', () => {
    const character = new Character('bridge-divergence', Types.Entities.WARRIOR);

    bridgeCharacterWorldUpdate(character, {
        worldX: 10 * 16 * 256 + 8 * 256,
        worldY: 12 * 16 * 256 + 8 * 256,
        divergenceClass: 'ordinary',
    });
    expect(character.visualState.visualDivergenceClass).toBe('ordinary');
    expect(character.visualState.visualMoveMode).toBe('interpolate');

    bridgeCharacterWorldUpdate(character, {
        worldX: 40 * 16 * 256 + 8 * 256,
        worldY: 12 * 16 * 256 + 8 * 256,
        divergenceClass: 'remote_discontinuity',
    });
    expect(character.visualState.visualDivergenceClass).toBe('remote_discontinuity');
    expect(character.visualState.visualMoveMode).toBe('snap');
});

test('visual movement bridge owns sticky path-facing and interpolated locomotion states', () => {
    const character = new Character('bridge-locomotion', Types.Entities.WARRIOR);
    character.orientation = Types.Orientations.RIGHT;

    bridgeCharacterPathLocomotion(character, { dx: 1, dy: 0, nextDx: 0, nextDy: 1 });
    expect(character.orientation).toBe(Types.Orientations.RIGHT);
    expect(character.visualState.visualLocomotionState).toBe('walk');

    bridgeCharacterInterpolatedLocomotion(character, { movedX: 0, movedY: 0, movingThresholdPx: 0.05 });
    expect(character.visualState.visualLocomotionState).toBe('idle');
});
