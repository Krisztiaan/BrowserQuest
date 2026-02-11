import { expect, test } from 'bun:test';
import { applyLootFeedback } from '../../client/game-session/player/loot-feedback';
import Types from '../../shared/gametypes-browser';

test('applyLootFeedback triggers achievements and sound for firepotion', () => {
    const achievements: string[] = [];
    const sounds: string[] = [];

    applyLootFeedback(
        {
            tryUnlockingAchievement(id) {
                achievements.push(id);
            },
            playSound(sound) {
                sounds.push(sound);
            },
            isCake(kind) {
                return kind === Types.Entities.CAKE;
            },
            isFirePotion(kind) {
                return kind === Types.Entities.FIREPOTION;
            },
            isHealingItem(kind) {
                return Types.isHealingItem(kind);
            },
        },
        {
            type: 'object',
            kind: Types.Entities.FIREPOTION,
        }
    );

    expect(achievements.includes('FOXY')).toBe(true);
    expect(sounds).toEqual(['firefox', 'loot']);
});

test('applyLootFeedback triggers armor/weapon achievements and heal sound', () => {
    const achievements: string[] = [];
    const sounds: string[] = [];

    applyLootFeedback(
        {
            tryUnlockingAchievement(id) {
                achievements.push(id);
            },
            playSound(sound) {
                sounds.push(sound);
            },
            isCake(kind) {
                return kind === Types.Entities.CAKE;
            },
            isFirePotion(kind) {
                return kind === Types.Entities.FIREPOTION;
            },
            isHealingItem(kind) {
                return Types.isHealingItem(kind);
            },
        },
        {
            type: 'armor',
            kind: Types.Entities.FLASK,
        }
    );

    expect(achievements).toEqual(['FAT_LOOT']);
    expect(sounds).toEqual(['heal']);
});
