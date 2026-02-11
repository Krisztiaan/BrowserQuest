import { installPlayerCosmeticHandlers } from './cosmetics';

type MovedPlayerAnchor = {
    id: string | number;
    x: number;
    y: number;
};

type PlayerCosmeticsBuilderGame = {
    player: {
        on(eventName: 'hasMoved', callback: (player: MovedPlayerAnchor) => void): void;
        on(eventName: 'armorLoot', callback: (armorName: string) => void): void;
        on(eventName: 'switchItem', callback: () => void): void;
        on(eventName: 'invincible', callback: () => void): void;
        switchArmor(sprite: unknown): void;
        getArmorName(): string;
        getWeaponName(): string;
    };
    sprites: Record<string, unknown>;
    renderer: {
        getPlayerImage(callback: (playerImage: string) => void): void;
    } | null;
    storage: {
        savePlayer(playerImage: string, armorName: string, weaponName: string): void;
    };
    emit(eventName: 'playerEquipmentChange'): void;
    emit(eventName: 'playerInvincible'): void;
    assignBubbleTo(player: MovedPlayerAnchor): void;
};

export function installPlayerCosmeticHandlersFromGame(game: PlayerCosmeticsBuilderGame): void {
    installPlayerCosmeticHandlers({
        player: game.player,
        assignBubbleTo(player) {
            game.assignBubbleTo(player);
        },
        getSprite(name) {
            return game.sprites[name];
        },
        getPlayerImage(callback) {
            game.renderer?.getPlayerImage(callback);
        },
        savePlayer(playerImage, armorName, weaponName) {
            game.storage.savePlayer(playerImage, armorName, weaponName);
        },
        onEquipmentChanged() {
            game.emit('playerEquipmentChange');
        },
        onPlayerInvincible() {
            game.emit('playerInvincible');
        },
    });
}
