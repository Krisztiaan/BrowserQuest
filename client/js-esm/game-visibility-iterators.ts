import Mob from './mob';
import type Game from './game';

type GameEntity = Game['entities'][string];
type AnimatedGameTile = NonNullable<Game['animatedTiles']>[number];

export function forEachGameEntity(game: Game, callback: (entity: GameEntity) => void): void {
    Object.keys(game.entities).forEach(function (id: string) {
        callback(game.entities[id]);
    });
}

export function forEachGameMob(game: Game, callback: (mob: Mob) => void): void {
    Object.keys(game.entities).forEach(function (id: string) {
        const entity = game.entities[id];
        if (entity instanceof Mob) {
            callback(entity);
        }
    });
}

export function forEachEntityByDepthInView(game: Game, callback: (entity: GameEntity) => void): void {
    const map = game.map;

    game.camera.forEachVisiblePosition(
        function (x: number, y: number) {
            if (!map.isOutOfBounds(x, y)) {
                const entities = game.renderingGrid?.[y]?.[x];
                if (entities) {
                    Object.keys(entities).forEach(function (id: string) {
                        callback(entities[id]);
                    });
                }
            }
        },
        game.renderer.mobile ? 0 : 2
    );
}

export function forEachVisibleGameTileIndex(
    game: Game,
    callback: (tileIndex: number) => void,
    extra: number
): void {
    const map = game.map;

    game.camera.forEachVisiblePosition(function (x: number, y: number) {
        if (!map.isOutOfBounds(x, y)) {
            callback(map.GridPositionToTileIndex(x, y) - 1);
        }
    }, extra);
}

export function forEachVisibleGameTile(
    game: Game,
    callback: (tileId: number, tileIndex: number) => void,
    extra: number
): void {
    const map = game.map;

    if (!map.isLoaded) {
        return;
    }

    forEachVisibleGameTileIndex(
        game,
        function (tileIndex: number) {
            const tileData = map.data[tileIndex];
            if (Array.isArray(tileData)) {
                tileData.forEach(function (id: number) {
                    callback(id - 1, tileIndex);
                });
                return;
            }

            if (!Number.isNaN(tileData - 1)) {
                callback(tileData - 1, tileIndex);
            }
        },
        extra
    );
}

export function forEachAnimatedGameTile(game: Game, callback: (tile: AnimatedGameTile) => void): void {
    if (!game.animatedTiles) {
        return;
    }

    game.animatedTiles.forEach(function (tile: AnimatedGameTile) {
        callback(tile);
    });
}
