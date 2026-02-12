import type Game from '../game';
import type GameClient from '../gameclient';
import type { GameClientEvents } from '../gameclient';

export type ClientRuntimeContext = Readonly<{
    game: Game;
    client: GameClient;
}>;

export class GameClientEffectRegistry {
    readonly #ctx: ClientRuntimeContext;
    readonly #client: GameClient;

    constructor(ctx: ClientRuntimeContext) {
        this.#ctx = ctx;
        this.#client = ctx.client;
    }

    on<E extends keyof GameClientEvents>(
        eventName: E,
        handler: (ctx: ClientRuntimeContext, ...args: GameClientEvents[E]) => void
    ): void {
        this.#client.on(eventName, (...args: GameClientEvents[E]) => handler(this.#ctx, ...args));
    }
}
