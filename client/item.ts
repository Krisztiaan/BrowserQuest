import Entity from './entity';
import Types from '../shared/gametypes-browser';
import type { EntityKind } from '../shared/entity-kind-domain';

type ItemType = 'weapon' | 'armor' | 'object';

export type LootPlayer = {
    switchWeapon: (itemKind: string) => void;
    emitArmorLoot: (itemKind: string) => void;
    startInvincibility: () => void;
};

class Item extends Entity {
    itemKind: string;
    type: ItemType;
    wasDropped: boolean;
    lootMessage: string;

    constructor(id: string | number, kind: EntityKind, type: ItemType) {
        super(id, kind);
        const kindName = Types.getKindAsString(kind);
        if (!kindName) {
            throw new Error(`Unknown item kind: ${String(kind)}`);
        }
        this.itemKind = kindName;
        this.type = type;
        this.wasDropped = false;
        this.lootMessage = '';
    }

    override hasShadow(): boolean {
        return true;
    }

    onLoot(player: LootPlayer): void {
        if (this.type === 'weapon') {
            player.switchWeapon(this.itemKind);
        } else if (this.type === 'armor') {
            player.emitArmorLoot(this.itemKind);
        }
    }

    override getSpriteName(): string {
        return 'item-' + this.itemKind;
    }

    getLootMessage(): string {
        return this.lootMessage;
    }
}

export default Item;
