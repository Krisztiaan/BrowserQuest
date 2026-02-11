import Item from './item';
import type { LootPlayer } from './item';
import Types from '../shared/gametypes-browser';
import type { EntityKind } from '../shared/entity-kind-domain';
import { ITEM_LOOT_MESSAGES } from './item-loot-messages.generated';

type ItemCtor = new (id: string | number) => Item;
type ItemCategory = 'weapon' | 'armor' | 'object';
type ItemLootMessageKey = keyof typeof ITEM_LOOT_MESSAGES;

type ItemDefinition = {
    kind: EntityKind;
    type: ItemCategory;
    lootMessageKey: ItemLootMessageKey;
    onLoot?: (player: LootPlayer) => void;
};

function createItemCtor(definition: ItemDefinition): ItemCtor {
    return class extends Item {
        constructor(id: string | number) {
            super(id, definition.kind, definition.type);
            this.lootMessage = ITEM_LOOT_MESSAGES[definition.lootMessageKey];
        }

        override onLoot(player: LootPlayer): void {
            super.onLoot(player);
            definition.onLoot?.(player);
        }
    };
}

const Items: Record<string, ItemCtor> = {
    Sword2: createItemCtor({ kind: Types.Entities.SWORD2, type: 'weapon', lootMessageKey: 'sword2' }),
    Axe: createItemCtor({ kind: Types.Entities.AXE, type: 'weapon', lootMessageKey: 'axe' }),
    RedSword: createItemCtor({ kind: Types.Entities.REDSWORD, type: 'weapon', lootMessageKey: 'redsword' }),
    BlueSword: createItemCtor({ kind: Types.Entities.BLUESWORD, type: 'weapon', lootMessageKey: 'bluesword' }),
    GoldenSword: createItemCtor({ kind: Types.Entities.GOLDENSWORD, type: 'weapon', lootMessageKey: 'goldensword' }),
    MorningStar: createItemCtor({ kind: Types.Entities.MORNINGSTAR, type: 'weapon', lootMessageKey: 'morningstar' }),
    LeatherArmor: createItemCtor({ kind: Types.Entities.LEATHERARMOR, type: 'armor', lootMessageKey: 'leatherarmor' }),
    MailArmor: createItemCtor({ kind: Types.Entities.MAILARMOR, type: 'armor', lootMessageKey: 'mailarmor' }),
    PlateArmor: createItemCtor({ kind: Types.Entities.PLATEARMOR, type: 'armor', lootMessageKey: 'platearmor' }),
    RedArmor: createItemCtor({ kind: Types.Entities.REDARMOR, type: 'armor', lootMessageKey: 'redarmor' }),
    GoldenArmor: createItemCtor({ kind: Types.Entities.GOLDENARMOR, type: 'armor', lootMessageKey: 'goldenarmor' }),
    Flask: createItemCtor({ kind: Types.Entities.FLASK, type: 'object', lootMessageKey: 'flask' }),
    Cake: createItemCtor({ kind: Types.Entities.CAKE, type: 'object', lootMessageKey: 'cake' }),
    Burger: createItemCtor({ kind: Types.Entities.BURGER, type: 'object', lootMessageKey: 'burger' }),
    FirePotion: createItemCtor({
        kind: Types.Entities.FIREPOTION,
        type: 'object',
        lootMessageKey: 'firepotion',
        onLoot(player) {
            player.startInvincibility();
        },
    }),
};

export default Items;
