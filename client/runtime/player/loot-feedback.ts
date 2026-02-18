import type { EntityKind } from '../../../shared/entity-kind-domain';
import type { AudioSoundKey } from '../../asset-key-domain';

type LootFeedbackHost = {
    tryUnlockingAchievement(id: string): void;
    playSound(sound: AudioSoundKey): void;
    isCake(kind: EntityKind): boolean;
    isFirePotion(kind: EntityKind): boolean;
    isHealingItem(kind: EntityKind): boolean;
};

type LootFeedbackItem = {
    type: string;
    kind: EntityKind;
};

export function applyLootFeedback(host: LootFeedbackHost, item: LootFeedbackItem): void {
    if (host.isFirePotion(item.kind)) {
        host.tryUnlockingAchievement('FOXY');
        host.playSound('firefox');
        host.playSound('loot');
        return;
    }

    if (item.type === 'armor' || item.type === 'weapon') {
        host.tryUnlockingAchievement('FAT_LOOT');
    }

    if (host.isHealingItem(item.kind) && !host.isCake(item.kind)) {
        host.playSound('heal');
    }
}
