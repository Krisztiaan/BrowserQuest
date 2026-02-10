type DamageInfoType = 'received' | 'healed';

type HealthPlayer = {
    hitPoints: number;
    isDead: boolean;
    invincible: boolean;
    x: number;
    y: number;
    die(): void;
    hurt(): void;
};

type PlayerChangeHealthHost<TPlayer extends HealthPlayer> = {
    player: TPlayer | null;
    points: number;
    isRegen: boolean;
    addDamageInfo(value: number | string, x: number, y: number, type: DamageInfoType): void;
    playHurtSound(): void;
    addStoredDamage(value: number): void;
    unlockMeatshieldAchievement(): void;
    onPlayerHurt(): void;
    updateBars(): void;
};

export function handlePlayerChangeHealth<TPlayer extends HealthPlayer>(host: PlayerChangeHealthHost<TPlayer>): void {
    const player = host.player;
    if (!player || player.isDead || player.invincible) {
        return;
    }

    const isHurt = host.points <= player.hitPoints;
    const diff = host.points - player.hitPoints;
    player.hitPoints = host.points;

    if (player.hitPoints <= 0) {
        player.die();
    }

    if (isHurt) {
        player.hurt();
        host.addDamageInfo(diff, player.x, player.y - 15, 'received');
        host.playHurtSound();
        host.addStoredDamage(-diff);
        host.unlockMeatshieldAchievement();
        host.onPlayerHurt();
    } else if (!host.isRegen) {
        host.addDamageInfo('+' + diff, player.x, player.y - 15, 'healed');
    }

    host.updateBars();
}
