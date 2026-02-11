import Animation from './animation';
import Types from '../../shared/js/gametypes-browser';
import type { EntityKind } from '../../shared/js/entity-kind-domain';
import type Game from './game';

export function initGameShadows(game: Game): void {
    game.shadows = {};
    game.shadows.small = game.sprites.shadow16;
}

export function initGameCursors(game: Game): void {
    game.cursors.hand = game.sprites.hand;
    game.cursors.sword = game.sprites.sword;
    game.cursors.loot = game.sprites.loot;
    game.cursors.target = game.sprites.target;
    game.cursors.arrow = game.sprites.arrow;
    game.cursors.talk = game.sprites.talk;
}

export function initGameAnimations(game: Game): void {
    game.targetAnimation = new Animation('idle_down', 4, 0, 16, 16);
    game.targetAnimation.setSpeed(50);

    game.sparksAnimation = new Animation('idle_down', 6, 0, 16, 16);
    game.sparksAnimation.setSpeed(120);
}

export function initGameHurtSprites(game: Game): void {
    Types.forEachArmorKind(function (_kind: EntityKind, kindName: string) {
        game.sprites[kindName].createHurtSprite();
    });
}

export function initGameSilhouettes(game: Game): void {
    Types.forEachMobOrNpcKind(function (_kind: EntityKind, kindName: string) {
        game.sprites[kindName].createSilhouette();
    });
    game.sprites.chest.createSilhouette();
    game.sprites['item-cake'].createSilhouette();
}
