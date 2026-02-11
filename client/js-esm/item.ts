
import Entity from './entity';
import Types from '../../shared/js/gametypes-browser';
import type { EntityKind } from '../../shared/js/entity-kind-domain';

type ItemType = 'weapon' | 'armor' | 'object';

export type LootPlayer = {
    switchWeapon: (itemKind: string) => void;
    emitArmorLoot: (itemKind: string) => void;
    startInvincibility: () => void;
};

class Item extends Entity {
    itemKind: string | undefined;
    type: ItemType;
    wasDropped: boolean;
    lootMessage: string;

    constructor(id: string | number, kind: EntityKind, type: ItemType) {
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
            player.switchWeapon(this.itemKind as string);
        } else if (this.type === "armor") {
            player.emitArmorLoot(this.itemKind as string);
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
