import Item from './item';
import type { LootPlayer } from './item';
import Types from '../shared/gametypes-browser';
import type { EntityKind } from '../shared/entity-kind-domain';
import { requireItemPrefab } from '../shared/content/prefabs';

type ItemCtor = new (id: string | number) => Item;
type ItemCategory = 'weapon' | 'armor' | 'object';

type ItemDefinition = {
    kind: EntityKind;
    type: ItemCategory;
    onLoot?: (player: LootPlayer) => void;
};

function createItemCtor(definition: ItemDefinition): ItemCtor {
    return class extends Item {
        constructor(id: string | number) {
            super(id, definition.kind, definition.type);
            this.lootMessage = requireItemPrefab(definition.kind).lootMessage;
        }

        override onLoot(player: LootPlayer): void {
            super.onLoot(player);
            definition.onLoot?.(player);
        }
    };
}

const Items: Record<string, ItemCtor> = {
    Sword2: createItemCtor({ kind: Types.Entities.SWORD2, type: 'weapon' }),
    Axe: createItemCtor({ kind: Types.Entities.AXE, type: 'weapon' }),
    RedSword: createItemCtor({ kind: Types.Entities.REDSWORD, type: 'weapon' }),
    BlueSword: createItemCtor({ kind: Types.Entities.BLUESWORD, type: 'weapon' }),
    GoldenSword: createItemCtor({ kind: Types.Entities.GOLDENSWORD, type: 'weapon' }),
    MorningStar: createItemCtor({ kind: Types.Entities.MORNINGSTAR, type: 'weapon' }),
    LeatherArmor: createItemCtor({ kind: Types.Entities.LEATHERARMOR, type: 'armor' }),
    MailArmor: createItemCtor({ kind: Types.Entities.MAILARMOR, type: 'armor' }),
    PlateArmor: createItemCtor({ kind: Types.Entities.PLATEARMOR, type: 'armor' }),
    RedArmor: createItemCtor({ kind: Types.Entities.REDARMOR, type: 'armor' }),
    GoldenArmor: createItemCtor({ kind: Types.Entities.GOLDENARMOR, type: 'armor' }),
    Flask: createItemCtor({ kind: Types.Entities.FLASK, type: 'object' }),
    Cake: createItemCtor({ kind: Types.Entities.CAKE, type: 'object' }),
    Burger: createItemCtor({ kind: Types.Entities.BURGER, type: 'object' }),
    FirePotion: createItemCtor({
        kind: Types.Entities.FIREPOTION,
        type: 'object',
        onLoot(player) {
            player.startInvincibility();
        },
    }),
};

export default Items;
