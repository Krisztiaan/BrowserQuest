import { supportsLocalStorage } from './platform/features';
import type { AchievementId } from './achievement-domain';
import { isAchievementId } from './achievement-domain';

const STORAGE_KEY = 'data';

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

class Storage {
    data: StorageData;

    constructor() {
        if (!this.hasLocalStorage()) {
            this.resetData();
            return;
        }

        const rawData = localStorage.getItem(STORAGE_KEY);
        if (!rawData) {
            this.resetData();
            return;
        }

        try {
            this.data = JSON.parse(rawData) as StorageData;
            if (!Array.isArray(this.data.achievements.unlocked)) {
                this.resetData();
                return;
            }
            this.data.achievements.unlocked = this.data.achievements.unlocked.filter((id): id is AchievementId =>
                isAchievementId(id)
            );
        } catch (_error) {
            this.resetData();
        }
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
        if (this.hasLocalStorage()) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        }
    }

    clear(): void {
        if (this.hasLocalStorage()) {
            localStorage.removeItem(STORAGE_KEY);
            this.resetData();
        }
    }

    // Player

    hasAlreadyPlayed(): boolean {
        return this.data.hasAlreadyPlayed;
    }

    initPlayer(name: string): void {
        this.data.hasAlreadyPlayed = true;
        this.setPlayerName(name);
    }
    
    setPlayerName(name: string): void {
        this.data.player.name = name;
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

    // Angry rats
    getRatCount(): number {
        return this.data.achievements.ratCount;
    }

    incrementRatCount(): void {
        if (this.data.achievements.ratCount < 10) {
            this.data.achievements.ratCount++;
            this.save();
        }
    }
    
    // Skull Collector
    getSkeletonCount(): number {
        return this.data.achievements.skeletonCount;
    }

    incrementSkeletonCount(): void {
        if (this.data.achievements.skeletonCount < 10) {
            this.data.achievements.skeletonCount++;
            this.save();
        }
    }

    // Meatshield
    getTotalDamageTaken(): number {
        return this.data.achievements.totalDmg;
    }

    addDamage(damage: number): void {
        if (this.data.achievements.totalDmg < 5000) {
            this.data.achievements.totalDmg += damage;
            this.save();
        }
    }
    
    // Hunter
    getTotalKills(): number {
        return this.data.achievements.totalKills;
    }

    incrementTotalKills(): void {
        if (this.data.achievements.totalKills < 50) {
            this.data.achievements.totalKills++;
            this.save();
        }
    }

    // Still Alive
    getTotalRevives(): number {
        return this.data.achievements.totalRevives;
    }

    incrementRevives(): void {
        if (this.data.achievements.totalRevives < 5) {
            this.data.achievements.totalRevives++;
            this.save();
        }
    }
}

export default Storage;
