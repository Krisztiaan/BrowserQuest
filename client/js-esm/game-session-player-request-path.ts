import Character from './character';

type RequestPathPlayer = {
    target: unknown;
    hasTarget(): boolean;
    setPathRequestResolver(callback: (x: number, y: number) => unknown): void;
};

type PlayerRequestPathHost = {
    player: RequestPathPlayer;
    findPath(player: RequestPathPlayer, x: number, y: number, ignored: Character[]): unknown;
};

export function installPlayerRequestPathHandler(host: PlayerRequestPathHost): void {
    host.player.setPathRequestResolver(function (x, y) {
        const ignored: Character[] = [host.player as Character];

        if (host.player.hasTarget() && host.player.target instanceof Character) {
            ignored.push(host.player.target);
        }

        return host.findPath(host.player, x, y, ignored);
    });
}
