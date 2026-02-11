import type Game from '../../game';
import GameClient from '../../gameclient';
import { installGameSessionBootstrapHandlers } from '../connection/bootstrap';
import { registerWelcomeSessionHandlersFromGame } from '../welcome/registrar';

export function initializeGameSessionConnection(game: Game, startedCallback: () => void): void {
    const runtimeConfig = game.app.config && game.app.config.server ? game.app.config.server : null;
    game.client = new GameClient(game.host, game.port);
    game.client.connect(runtimeConfig ? runtimeConfig.dispatcher : false);

    installGameSessionBootstrapHandlers(game, game.client);
    registerWelcomeSessionHandlersFromGame(game, startedCallback);
}
