type MovedPlayerAnchor = {
    id: string | number;
    x: number;
    y: number;
};

type CosmeticPlayer = {
    on(eventName: 'hasMoved', callback: (player: MovedPlayerAnchor) => void): void;
    on(eventName: 'armorLoot', callback: (armorName: string) => void): void;
    on(eventName: 'switchItem', callback: () => void): void;
    on(eventName: 'invincible', callback: () => void): void;
    switchArmor(sprite: unknown): void;
    getArmorName(): string;
    getWeaponName(): string;
};

type CosmeticHost = {
    player: CosmeticPlayer;
    assignBubbleTo(player: MovedPlayerAnchor): void;
    getSprite(name: string): unknown;
    getPlayerImage(callback: (playerImage: string) => void): void;
    savePlayer(playerImage: string, armorName: string, weaponName: string): void;
    onEquipmentChanged(): void;
    onPlayerInvincible(): void;
};

export function installPlayerCosmeticHandlers(host: CosmeticHost): void {
    host.player.on('hasMoved', function (player) {
        host.assignBubbleTo(player);
    });

    host.player.on('armorLoot', function (armorName) {
        host.player.switchArmor(host.getSprite(armorName));
    });

    host.player.on('switchItem', function () {
        host.getPlayerImage(function (playerImage) {
            host.savePlayer(playerImage, host.player.getArmorName(), host.player.getWeaponName());
        });
        host.onEquipmentChanged();
    });

    host.player.on('invincible', function () {
        host.onPlayerInvincible();
        host.player.switchArmor(host.getSprite('firefox'));
    });
}
