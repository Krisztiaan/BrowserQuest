import { expect, test } from 'bun:test';
import { ACHIEVEMENT_ID_BY_KEY, isAchievementId } from '../../client/achievement-domain';

test('achievement key/id domain remains stable and unique', () => {
    const ids = Object.values(ACHIEVEMENT_ID_BY_KEY);
    const uniqueIds = new Set(ids);

    expect(ids.length).toBe(20);
    expect(uniqueIds.size).toBe(ids.length);
    expect(ACHIEVEMENT_ID_BY_KEY.A_TRUE_WARRIOR).toBe(1);
    expect(ACHIEVEMENT_ID_BY_KEY.RICKROLLD).toBe(20);
});

test('achievement id guard accepts only known ids', () => {
    expect(isAchievementId(1)).toBe(true);
    expect(isAchievementId(20)).toBe(true);
    expect(isAchievementId(0)).toBe(false);
    expect(isAchievementId(999)).toBe(false);
    expect(isAchievementId('1')).toBe(false);
});
