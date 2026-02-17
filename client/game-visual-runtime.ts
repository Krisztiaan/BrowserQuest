import Animation from './animation';
import Types from '../shared/gametypes-browser';
import type { EntityKind } from '../shared/entity-kind-domain';
import type Game from './game';

function requireSprite(game: Game, key: string) {
    const sprite = game.sprites[key];
    if (!sprite) {
        throw new Error(`Missing sprite asset: ${key}`);
    }
    return sprite;
}

export function initGameShadows(game: Game): void {
    game.shadows = {};
    game.shadows.small = requireSprite(game, 'shadow16');
}

export function initGameCursors(game: Game): void {
    game.cursors.hand = requireSprite(game, 'hand');
    game.cursors.sword = requireSprite(game, 'sword');
    game.cursors.loot = requireSprite(game, 'loot');
    game.cursors.target = requireSprite(game, 'target');
    game.cursors.arrow = requireSprite(game, 'arrow');
    game.cursors.talk = requireSprite(game, 'talk');
}

export function initGameAnimations(game: Game): void {
    game.targetAnimation = new Animation('idle_down', 4, 0, 16, 16);
    game.targetAnimation.setSpeed(50);

    game.sparksAnimation = new Animation('idle_down', 6, 0, 16, 16);
    game.sparksAnimation.setSpeed(120);
}

export function initGameHurtSprites(game: Game): void {
    Types.forEachArmorKind(function (_kind: EntityKind, kindName: string) {
        requireSprite(game, kindName).createHurtSprite();
    });
}

export function initGameSilhouettes(game: Game): void {
    Types.forEachMobOrNpcKind(function (_kind: EntityKind, kindName: string) {
        requireSprite(game, kindName).createSilhouette();
    });
    requireSprite(game, 'chest').createSilhouette();
    requireSprite(game, 'item-cake').createSilhouette();
}
