import type Game from './game';

type SpatialStateOptions = {
    resetEntities?: boolean;
};

export function initializeGameSpatialState(game: Game, options?: SpatialStateOptions): void {
    if (options?.resetEntities) {
        game.entities = {};
    }
    if (game.map) {
        game.kernel.resetClientSpatialState(game.map.grid);
    } else {
        game.kernel.resetClientSpatialState();
    }
}
