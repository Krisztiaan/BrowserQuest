export const ACHIEVEMENT_ID_BY_KEY = {
    A_TRUE_WARRIOR: 1,
    INTO_THE_WILD: 2,
    ANGRY_RATS: 3,
    SMALL_TALK: 4,
    FAT_LOOT: 5,
    UNDERGROUND: 6,
    AT_WORLDS_END: 7,
    COWARD: 8,
    TOMB_RAIDER: 9,
    SKULL_COLLECTOR: 10,
    NINJA_LOOT: 11,
    NO_MANS_LAND: 12,
    HUNTER: 13,
    STILL_ALIVE: 14,
    MEATSHIELD: 15,
    HOT_SPOT: 16,
    HERO: 17,
    FOXY: 18,
    FOR_SCIENCE: 19,
    RICKROLLD: 20,
} as const;

export type AchievementKey = keyof typeof ACHIEVEMENT_ID_BY_KEY;
export type AchievementId = (typeof ACHIEVEMENT_ID_BY_KEY)[AchievementKey];

const ACHIEVEMENT_ID_SET = new Set<number>(Object.values(ACHIEVEMENT_ID_BY_KEY));

type AchievementIdCandidate = number | string | boolean | bigint | object | null | undefined;

export function isAchievementId(value: AchievementIdCandidate): value is AchievementId {
    return typeof value === 'number' && ACHIEVEMENT_ID_SET.has(value);
}
