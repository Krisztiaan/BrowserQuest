
import Entity from 'entity';
import Types from 'compat/gametypes';

type ItemType = 'weapon' | 'armor' | 'object';

export type LootPlayer = {
    switchWeapon: (itemKind: string) => void;
    armorloot_callback: (itemKind: string) => void;
    startInvincibility: () => void;
};

class Item extends Entity {
    itemKind: string;
    type: ItemType;
    wasDropped: boolean;
    lootMessage: string;

    constructor(id: string | number, kind: number, type: ItemType) {
        super(id, kind);

        this.itemKind = Types.getKindAsString(kind);
        this.type = type;
        this.wasDropped = false;
        this.lootMessage = "";
    }

    hasShadow(): boolean {
        return true;
    }

    onLoot(player: LootPlayer): void {
        if (this.type === "weapon") {
            player.switchWeapon(this.itemKind);
        } else if (this.type === "armor") {
            player.armorloot_callback(this.itemKind);
        }
    }

    getSpriteName(): string {
        return "item-"+ this.itemKind;
    }

    getLootMessage(): string {
        return this.lootMessage;
    }
}

export default Item;
