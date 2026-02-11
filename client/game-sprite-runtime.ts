import Sprite from './sprite';
import type { SpriteKey } from './asset-key-domain';
import type Game from './game';

type SpriteReloadableEntity = {
    sprite: Sprite | null;
    getSpriteName(): SpriteKey;
    setSprite(sprite: Sprite | null): void;
};

export function loadSpriteForScale(game: Game, name: SpriteKey, scale: number): void {
    const index = scale - 1;

    if (!game.spritesets[index]) {
        game.spritesets[index] = {};
    }
    if (!game.spritesets[index][name]) {
        game.spritesets[index][name] = new Sprite(name, scale);
    }
}

export function loadSpriteScale(game: Game, scale: number): void {
    game.spriteNames.forEach(function (name: SpriteKey) {
        loadSpriteForScale(game, name, scale);
    });
}

export function setSpriteScale(game: Game, scale: number): void {
    if (game.renderer.upscaledRendering) {
        game.sprites = game.spritesets[0] || {};
    } else {
        loadSpriteScale(game, scale);
        game.sprites = game.spritesets[scale - 1] || {};

        Object.keys(game.entities).forEach(function (id: string) {
            const entity = game.entities[id] as unknown as SpriteReloadableEntity;
            entity.sprite = null;
            entity.setSprite(game.sprites[entity.getSpriteName()]);
        });
        game.initHurtSprites();
        game.initShadows();
        game.initCursors();
    }
}

export function loadSprites(game: Game): void {
    game.spritesets = [];
    game.spritesets[0] = {};
    game.spritesets[1] = {};
    game.spritesets[2] = {};
    if (game.renderer.upscaledRendering) {
        loadSpriteScale(game, 1);
        return;
    }
    loadSpriteScale(game, game.renderer.scale);
}

export function areSpritesLoaded(game: Game): boolean {
    if (
        Object.keys(game.sprites).some(function (name: string) {
            return !game.sprites[name].isLoaded;
        })
    ) {
        return false;
    }
    return true;
}
