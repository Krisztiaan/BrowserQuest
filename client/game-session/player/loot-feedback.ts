import type { EntityKind } from '../../../shared/entity-kind-domain';

type LootFeedbackItem = {
    type: 'armor' | 'weapon' | 'object' | string;
    kind: EntityKind;
};

type LootFeedbackHost = {
    tryUnlockingAchievement(id: 'FAT_LOOT' | 'A_TRUE_WARRIOR' | 'FOR_SCIENCE' | 'FOXY'): void;
    playSound(sound: 'firefox' | 'heal' | 'loot'): void;
    isCake(kind: EntityKind): boolean;
    isFirePotion(kind: EntityKind): boolean;
    isHealingItem(kind: EntityKind): boolean;
};

type LootFeedbackContext = {
    host: LootFeedbackHost;
    item: LootFeedbackItem;
};

type LootFeedbackRule = {
    matches(context: LootFeedbackContext): boolean;
    apply(context: LootFeedbackContext): void;
};

const LOOT_ACHIEVEMENT_RULES: LootFeedbackRule[] = [
    {
        matches({ item }) {
            return item.type === 'armor';
        },
        apply({ host }) {
            host.tryUnlockingAchievement('FAT_LOOT');
        },
    },
    {
        matches({ item }) {
            return item.type === 'weapon';
        },
        apply({ host }) {
            host.tryUnlockingAchievement('A_TRUE_WARRIOR');
        },
    },
    {
        matches({ host, item }) {
            return host.isCake(item.kind);
        },
        apply({ host }) {
            host.tryUnlockingAchievement('FOR_SCIENCE');
        },
    },
    {
        matches({ host, item }) {
            return host.isFirePotion(item.kind);
        },
        apply({ host }) {
            host.tryUnlockingAchievement('FOXY');
            host.playSound('firefox');
        },
    },
];

const LOOT_SOUND_RULES: LootFeedbackRule[] = [
    {
        matches({ host, item }) {
            return host.isHealingItem(item.kind);
        },
        apply({ host }) {
            host.playSound('heal');
        },
    },
];

export function applyLootFeedback(host: LootFeedbackHost, item: LootFeedbackItem): void {
    const context: LootFeedbackContext = { host, item };

    for (let i = 0; i < LOOT_ACHIEVEMENT_RULES.length; i += 1) {
        const rule = LOOT_ACHIEVEMENT_RULES[i];
        if (rule && rule.matches(context)) {
            rule.apply(context);
        }
    }

    const soundRule = LOOT_SOUND_RULES.find((rule) => rule.matches(context));
    if (soundRule) {
        soundRule.apply(context);
    } else {
        host.playSound('loot');
    }
}
