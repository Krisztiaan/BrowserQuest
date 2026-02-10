type MaxHitPointPlayer = {
    maxHitPoints: number;
    hitPoints: number;
};

type PlayerMaxHitPointsHost<TPlayer extends MaxHitPointPlayer> = {
    player: TPlayer;
    hp: number;
    updateBars(): void;
};

export function handlePlayerMaxHitPoints<TPlayer extends MaxHitPointPlayer>(
    host: PlayerMaxHitPointsHost<TPlayer>
): void {
    host.player.maxHitPoints = host.hp;
    host.player.hitPoints = host.hp;
    host.updateBars();
}
