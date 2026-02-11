import type Game from './game';

type SpatialStateOptions = {
    resetEntities?: boolean;
    includeItemGrid?: boolean;
};

export function initializeGameSpatialState(game: Game, options?: SpatialStateOptions): void {
    if (options?.resetEntities) {
        game.entities = {};
    }

    game.initEntityGrid();
    if (options?.includeItemGrid) {
        game.initItemGrid();
    }
    game.initPathingGrid();
    game.initRenderingGrid();
}
