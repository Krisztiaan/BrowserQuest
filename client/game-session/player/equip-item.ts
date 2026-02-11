import type { EntityKind } from '../../../shared/entity-kind-domain';

type EquipPlayer = {
    setSprite(sprite: unknown): void;
    setWeaponName?(name: string): void;
};

type PlayerEquipItemHost<TPlayer extends EquipPlayer> = {
    player: TPlayer | null;
    itemKind: EntityKind;
    getItemName(kind: EntityKind): string;
    isArmor(kind: EntityKind): boolean;
    isWeapon(kind: EntityKind): boolean;
    getSprite(itemName: string): unknown;
};

export function handlePlayerEquipItem<TPlayer extends EquipPlayer>(host: PlayerEquipItemHost<TPlayer>): void {
    if (!host.player) {
        return;
    }

    const itemName = host.getItemName(host.itemKind);
    if (host.isArmor(host.itemKind)) {
        host.player.setSprite(host.getSprite(itemName));
    } else if (host.isWeapon(host.itemKind) && host.player.setWeaponName) {
        host.player.setWeaponName(itemName);
    }
}
