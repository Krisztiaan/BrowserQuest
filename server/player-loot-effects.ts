import type { EntityKind } from '../shared/entity-kind-domain';
import Messages from './message';
import Types from '../shared/gametypes-browser';

type LootEntity = {
    kind: EntityKind;
};

type LootEffectPlayer = {
    armor: EntityKind;
    firepotionTimeout: ReturnType<typeof setTimeout> | null;
    maxHitPoints: number;
    updateHitPoints(): void;
    broadcast(message: unknown): void;
    equip(item: EntityKind): unknown;
    send(message: unknown): void;
    hasFullHealth(): boolean;
    regenHealthBy(amount: number): void;
    health(): unknown;
    equipItem(item: LootEntity): void;
    server: {
        pushToPlayer(player: LootEffectPlayer, message: unknown): void;
    };
};

type LootEffectContext = {
    player: LootEffectPlayer;
    droppedItem: LootEntity;
};

type LootEffectRule = {
    matches(context: LootEffectContext): boolean;
    apply(context: LootEffectContext): void;
};

const HEALING_ITEM_POINTS_BY_KIND: Partial<Record<EntityKind, number>> = {
    [Types.Entities.FLASK]: 40,
    [Types.Entities.BURGER]: 100,
};

const PLAYER_LOOT_EFFECT_RULES: LootEffectRule[] = [
    {
        matches({ droppedItem }) {
            return droppedItem.kind === Types.Entities.FIREPOTION;
        },
        apply({ player }) {
            player.updateHitPoints();
            player.broadcast(player.equip(Types.Entities.FIREFOX));
            player.firepotionTimeout = setTimeout(function () {
                player.broadcast(player.equip(player.armor));
                player.firepotionTimeout = null;
            }, 15000);
            player.send(new Messages.HitPoints(player.maxHitPoints).serialize());
        },
    },
    {
        matches({ droppedItem }) {
            return typeof HEALING_ITEM_POINTS_BY_KIND[droppedItem.kind] === 'number';
        },
        apply({ player, droppedItem }) {
            const healingPoints = HEALING_ITEM_POINTS_BY_KIND[droppedItem.kind];
            if (typeof healingPoints === 'number' && !player.hasFullHealth()) {
                player.regenHealthBy(healingPoints);
                player.server.pushToPlayer(player, player.health());
            }
        },
    },
    {
        matches({ droppedItem }) {
            return Types.isArmor(droppedItem.kind) || Types.isWeapon(droppedItem.kind);
        },
        apply({ player, droppedItem }) {
            player.equipItem(droppedItem);
            player.broadcast(player.equip(droppedItem.kind));
        },
    },
];

export function applyPlayerLootEffect(player: LootEffectPlayer, droppedItem: LootEntity): boolean {
    const context: LootEffectContext = { player, droppedItem };

    for (let i = 0; i < PLAYER_LOOT_EFFECT_RULES.length; i += 1) {
        const rule = PLAYER_LOOT_EFFECT_RULES[i];
        if (rule && rule.matches(context)) {
            rule.apply(context);
            return true;
        }
    }

    return false;
}
