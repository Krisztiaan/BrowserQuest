import Sprite from './sprite';
import type { SpriteKey } from './asset-key-domain';
import type Game from './game';

type SpriteReloadableEntity = {
    sprite: Sprite | null;
    getSpriteName(): SpriteKey;
    setSprite(sprite: Sprite | null): void;
};

function isSpriteReloadableEntity(value: object | null | undefined): value is SpriteReloadableEntity {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const candidate = value as Partial<SpriteReloadableEntity>;
    return typeof candidate.getSpriteName === 'function' && typeof candidate.setSprite === 'function';
}

function getRequiredSprite(game: Game, spriteName: string): Sprite {
    const sprite = game.sprites[spriteName];
    if (!sprite) {
        throw new Error(`Missing sprite in spriteset: ${spriteName}`);
    }
    return sprite;
}

export function loadSpriteForScale(game: Game, name: SpriteKey, scale: number): void {
    const index = scale - 1;

    game.spritesets[index] ??= {};
    game.spritesets[index][name] ??= new Sprite(name, scale);
}

export function loadSpriteScale(game: Game, scale: number): void {
    game.spriteNames.forEach(function (name: SpriteKey) {
        loadSpriteForScale(game, name, scale);
    });
}

export function setSpriteScale(game: Game, scale: number): void {
    if (game.renderer.upscaledRendering) {
        game.sprites = game.spritesets[0] ?? {};
    } else {
        loadSpriteScale(game, scale);
        game.sprites = game.spritesets[scale - 1] ?? {};

        Object.keys(game.entities).forEach(function (id: string) {
            const entity = game.entities[id];
            if (!isSpriteReloadableEntity(entity)) {
                return;
            }
            entity.sprite = null;
            const spriteName = entity.getSpriteName();
            entity.setSprite(getRequiredSprite(game, spriteName));
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
    for (const sprite of Object.values(game.sprites)) {
        if (!sprite.isLoaded) {
            return false;
        }
    }
    return true;
}
