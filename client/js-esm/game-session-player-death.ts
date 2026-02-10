type DeathAttacker = {
    disengage(): void;
    idle(): void;
};

type DeathPlayer = {
    id: string | number;
    gridX: number;
    gridY: number;
    on(eventName: 'death', callback: () => void): void;
    stopBlinking(): void;
    setSprite(sprite: unknown): void;
    animate(name: string, speed: number, count: number, callback: () => void): void;
    forEachAttacker(callback: (attacker: DeathAttacker) => void): void;
};

type PlayerDeathHost = {
    player: DeathPlayer;
    getDeathSprite(): unknown;
    removePlayerEntity(player: DeathPlayer): void;
    removePlayerFromRenderingGrid(player: DeathPlayer, x: number, y: number): void;
    disableClient(): void;
    onPlayerRemoved(): void;
    schedulePlayerDeathCallback(delayMs: number): void;
    fadeOutMusic(): void;
    playDeathSound(): void;
    logInfo(message: string): void;
};

export function installPlayerDeathHandler(host: PlayerDeathHost): void {
    host.player.on('death', function () {
        host.logInfo(host.player.id + ' is dead');

        host.player.stopBlinking();
        host.player.setSprite(host.getDeathSprite());
        host.player.animate('death', 120, 1, function () {
            host.logInfo(host.player.id + ' was removed');
            host.removePlayerEntity(host.player);
            host.removePlayerFromRenderingGrid(host.player, host.player.gridX, host.player.gridY);
            host.onPlayerRemoved();
            host.disableClient();
            host.schedulePlayerDeathCallback(1000);
        });

        host.player.forEachAttacker(function (attacker) {
            attacker.disengage();
            attacker.idle();
        });

        host.fadeOutMusic();
        host.playDeathSound();
    });
}
