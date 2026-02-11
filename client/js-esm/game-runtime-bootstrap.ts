import Pathfinder from './pathfinder';
import type Game from './game';
import { initializeGameSpatialState } from './game-spatial-state';

export function bootstrapGameRuntime(game: Game, onStarted: () => void): void {
    if (!game.renderer || !game.map) {
        throw new Error('Cannot bootstrap game runtime without renderer and map');
    }

    game.loadAudio();

    game.initMusicAreas();
    game.initAchievements();
    game.initCursors();
    game.initAnimations();
    game.initShadows();
    game.initHurtSprites();

    if (!game.renderer.mobile && !game.renderer.tablet && game.renderer.upscaledRendering) {
        game.initSilhouettes();
    }

    initializeGameSpatialState(game, { includeItemGrid: true });

    game.setPathfinder(new Pathfinder(game.map.width, game.map.height));

    game.initPlayer();
    game.setCursor('hand');

    game.connect(onStarted);
}
