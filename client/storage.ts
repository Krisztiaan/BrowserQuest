import { supportsLocalStorage } from './platform/features';
import type { AchievementId } from './achievement-domain';
import { isAchievementId } from './achievement-domain';

export const STORAGE_KEY = 'username';
const LEGACY_STORAGE_KEY = 'data';
export const USERNAME_COOKIE_KEY = 'bq_username';
const USERNAME_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

type PlayerStorage = {
    name: string;
    weapon: string;
    armor: string;
    image: string;
};

type AchievementStorage = {
    unlocked: AchievementId[];
    ratCount: number;
    skeletonCount: number;
    totalKills: number;
    totalDmg: number;
    totalRevives: number;
};

type StorageData = {
    hasAlreadyPlayed: boolean;
    player: PlayerStorage;
    achievements: AchievementStorage;
};

const MAX_RAT_COUNT = 10;
const MAX_SKELETON_COUNT = 10;
const MAX_TOTAL_KILLS = 50;
const MAX_TOTAL_DAMAGE = 5000;
const MAX_TOTAL_REVIVES = 5;

function sanitizePlayerName(value: string | null | undefined): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function canUseCookies(): boolean {
    return typeof document !== 'undefined' && typeof document.cookie === 'string';
}

function getCookieRawValue(name: string): string | null {
    if (!canUseCookies()) {
        return null;
    }
    const cookiePrefix = `${name}=`;
    const cookies = document.cookie.split(';');
    for (let index = 0; index < cookies.length; index += 1) {
        const cookieEntry = cookies[index]?.trim() ?? '';
        if (cookieEntry.startsWith(cookiePrefix)) {
            return cookieEntry.slice(cookiePrefix.length);
        }
    }
    return null;
}

export function readUsernameCookie(): string | null {
    const raw = getCookieRawValue(USERNAME_COOKIE_KEY);
    if (raw === null) {
        return null;
    }
    try {
        return sanitizePlayerName(decodeURIComponent(raw));
    } catch {
        return null;
    }
}

export function writeUsernameCookie(name: string): void {
    if (!canUseCookies()) {
        return;
    }
    const trimmedName = sanitizePlayerName(name);
    if (trimmedName === null) {
        clearUsernameCookie();
        return;
    }
    document.cookie = `${USERNAME_COOKIE_KEY}=${encodeURIComponent(trimmedName)}; Max-Age=${USERNAME_COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax`;
}

export function clearUsernameCookie(): void {
    if (!canUseCookies()) {
        return;
    }
    document.cookie = `${USERNAME_COOKIE_KEY}=; Max-Age=0; Path=/; SameSite=Lax`;
}

function clampCounter(value: number, max: number): number {
    if (!Number.isFinite(value)) {
        return 0;
    }
    const safe = Math.max(0, Math.trunc(value));
    return Math.min(max, safe);
}

function sanitizeUnlockedIds(ids: number[]): AchievementId[] {
    const seen = new Set<number>();
    const unlocked: AchievementId[] = [];
    for (let i = 0; i < ids.length; i += 1) {
        const id = ids[i];
        if (!isAchievementId(id) || seen.has(id)) {
            continue;
        }
        seen.add(id);
        unlocked.push(id);
    }
    unlocked.sort((a, b) => a - b);
    return unlocked;
}

class Storage {
    data: StorageData;

    constructor() {
        this.resetData();

        const storedUsername = this.readStoredUsername();
        if (storedUsername !== null) {
            this.data.hasAlreadyPlayed = true;
            this.data.player.name = storedUsername;
            writeUsernameCookie(storedUsername);
        }
    }

    private readStoredUsername(): string | null {
        if (this.hasLocalStorage()) {
            const directUsername = sanitizePlayerName(localStorage.getItem(STORAGE_KEY));
            if (directUsername !== null) {
                return directUsername;
            }

            const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
            if (legacyRaw) {
                let legacyName: string | null = null;
                try {
                    const parsed = JSON.parse(legacyRaw) as
                        | {
                              name?: unknown;
                              player?: { name?: unknown };
                              achievements?: { unlocked?: unknown[] };
                          }
                        | null;
                    if (parsed && typeof parsed === 'object') {
                        legacyName = sanitizePlayerName(
                            typeof parsed.name === 'string' ? parsed.name : parsed.player?.name
                        );

                        if (Array.isArray(parsed.achievements?.unlocked)) {
                            this.data.achievements.unlocked = parsed.achievements.unlocked.filter(
                                (id): id is AchievementId => isAchievementId(id)
                            );
                        }
                    }
                } catch (_error) {
                    legacyName = null;
                }

                if (legacyName !== null) {
                    localStorage.setItem(STORAGE_KEY, legacyName);
                    localStorage.removeItem(LEGACY_STORAGE_KEY);
                    return legacyName;
                }
            }
        }

        return readUsernameCookie();
    }

    resetData(): void {
        this.data = {
            hasAlreadyPlayed: false,
            player: {
                name: "",
                weapon: "",
                armor: "",
                image: ""
            },
            achievements: {
                unlocked: [],
                ratCount: 0,
                skeletonCount: 0,
                totalKills: 0,
                totalDmg: 0,
                totalRevives: 0
            }
        };
    }

    hasLocalStorage(): boolean {
        return supportsLocalStorage();
    }

    save(): void {
        const playerName = this.data.player.name.trim();
        if (playerName.length > 0) {
            writeUsernameCookie(playerName);
        } else {
            clearUsernameCookie();
        }

        if (this.hasLocalStorage()) {
            if (playerName.length > 0) {
                localStorage.setItem(STORAGE_KEY, playerName);
            } else {
                localStorage.removeItem(STORAGE_KEY);
            }
        }
    }

    clear(): void {
        clearUsernameCookie();
        if (this.hasLocalStorage()) {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(LEGACY_STORAGE_KEY);
        }
        this.resetData();
    }

    // Player

    hasAlreadyPlayed(): boolean {
        return this.data.hasAlreadyPlayed;
    }

    initPlayer(name: string): void {
        this.setPlayerName(name);
    }
    
    setPlayerName(name: string): void {
        const trimmed = name.trim();
        this.data.player.name = trimmed;
        this.data.hasAlreadyPlayed = trimmed.length > 0;
        this.save();
    }

    setPlayerImage(img: string): void {
        this.data.player.image = img;
        this.save();
    }

    setPlayerArmor(armor: string): void {
        this.data.player.armor = armor;
        this.save();
    }

    setPlayerWeapon(weapon: string): void {
        this.data.player.weapon = weapon;
        this.save();
    }

    savePlayer(img: string, armor: string, weapon: string): void {
        this.setPlayerImage(img);
        this.setPlayerArmor(armor);
        this.setPlayerWeapon(weapon);
    }

    // Achievements

    hasUnlockedAchievement(id: AchievementId): boolean {
        return this.data.achievements.unlocked.includes(id);
    }

    unlockAchievement(id: AchievementId): boolean {
        if (!this.hasUnlockedAchievement(id)) {
            this.data.achievements.unlocked.push(id);
            this.save();
            return true;
        }
        return false;
    }

    getAchievementCount(): number {
        return this.data.achievements.unlocked.length;
    }

    applyAchievementProgressSnapshot({
        unlockedIds,
        ratCount,
        skeletonCount,
        totalKills,
        totalDmg,
        totalRevives,
    }: {
        unlockedIds: number[];
        ratCount: number;
        skeletonCount: number;
        totalKills: number;
        totalDmg: number;
        totalRevives: number;
    }): void {
        this.data.achievements.unlocked = sanitizeUnlockedIds(unlockedIds);
        this.data.achievements.ratCount = clampCounter(ratCount, MAX_RAT_COUNT);
        this.data.achievements.skeletonCount = clampCounter(skeletonCount, MAX_SKELETON_COUNT);
        this.data.achievements.totalKills = clampCounter(totalKills, MAX_TOTAL_KILLS);
        this.data.achievements.totalDmg = clampCounter(totalDmg, MAX_TOTAL_DAMAGE);
        this.data.achievements.totalRevives = clampCounter(totalRevives, MAX_TOTAL_REVIVES);
        this.save();
    }

    // Angry rats
    getRatCount(): number {
        return this.data.achievements.ratCount;
    }

    incrementRatCount(): void {
        if (this.data.achievements.ratCount < MAX_RAT_COUNT) {
            this.data.achievements.ratCount++;
            this.save();
        }
    }
    
    // Skull Collector
    getSkeletonCount(): number {
        return this.data.achievements.skeletonCount;
    }

    incrementSkeletonCount(): void {
        if (this.data.achievements.skeletonCount < MAX_SKELETON_COUNT) {
            this.data.achievements.skeletonCount++;
            this.save();
        }
    }

    // Meatshield
    getTotalDamageTaken(): number {
        return this.data.achievements.totalDmg;
    }

    addDamage(damage: number): void {
        if (this.data.achievements.totalDmg < MAX_TOTAL_DAMAGE) {
            this.data.achievements.totalDmg += damage;
            this.save();
        }
    }
    
    // Hunter
    getTotalKills(): number {
        return this.data.achievements.totalKills;
    }

    incrementTotalKills(): void {
        if (this.data.achievements.totalKills < MAX_TOTAL_KILLS) {
            this.data.achievements.totalKills++;
            this.save();
        }
    }

    // Still Alive
    getTotalRevives(): number {
        return this.data.achievements.totalRevives;
    }

    incrementRevives(): void {
        if (this.data.achievements.totalRevives < MAX_TOTAL_REVIVES) {
            this.data.achievements.totalRevives++;
            this.save();
        }
    }
}

export default Storage;
