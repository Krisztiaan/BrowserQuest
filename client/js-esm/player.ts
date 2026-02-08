import Character from 'character';
import Exceptions from 'exceptions';
import log from 'compat/log';
import Types from 'compat/gametypes';

type PlayerSprite = {
    id: string;
    name: string;
};

type LootItem = {
    id: string | number;
    kind: number;
    type: 'armor' | 'weapon' | 'object' | string;
    onLoot: (player: Player) => void;
};

class Player extends Character {
    static MAX_LEVEL = 10;

    nameOffsetY: number;

    spriteName: string;
    weaponName: string | null;
    dirtyRect: unknown;
    isOnPlateau: boolean;
    lastCheckpoint: { id: string | number } | null;

    isLootMoving: boolean;
    isSwitchingWeapon: boolean;
    isSwitchingArmor: boolean;
    switchingWeapon: boolean;

    currentArmorSprite: PlayerSprite | null;
    invincible: boolean;
    invincibleTimeout: ReturnType<typeof setTimeout> | null;

    armorloot_callback: ((armor: string) => void) | null;
    switch_callback: (() => void) | null;
    invincible_callback: (() => void) | null;

    constructor(id: string | number, name: string, kind: number) {
        super(id, kind);

        this.name = name;

        // Renderer
        this.nameOffsetY = -10;

        // sprites
        this.spriteName = 'clotharmor';
        this.weaponName = 'sword1';
        this.dirtyRect = null;
        this.isOnPlateau = false;
        this.lastCheckpoint = null;

        // modes
        this.isLootMoving = false;
        this.isSwitchingWeapon = true;
        this.isSwitchingArmor = false;
        this.switchingWeapon = false;

        this.currentArmorSprite = null;
        this.invincible = false;
        this.invincibleTimeout = null;

        this.armorloot_callback = null;
        this.switch_callback = null;
        this.invincible_callback = null;
    }

    loot(item: LootItem | null): void {
        if (item) {
            let rank: number | null = null;
            let currentRank: number | null = null;
            let msg = '';
            let currentArmorName: string;

            if (this.currentArmorSprite) {
                currentArmorName = this.currentArmorSprite.name;
            } else {
                currentArmorName = this.spriteName;
            }

            if (item.type === 'armor') {
                rank = Types.getArmorRank(item.kind);
                currentRank = Types.getArmorRank(Types.getKindFromString(currentArmorName));
                msg = 'You are wearing a better armor';
            } else if (item.type === 'weapon') {
                rank = Types.getWeaponRank(item.kind);
                currentRank = Types.getWeaponRank(Types.getKindFromString(this.weaponName || 'sword1'));
                msg = 'You are wielding a better weapon';
            }

            if (rank && currentRank) {
                if (rank === currentRank) {
                    throw new Exceptions.LootException('You already have this ' + item.type);
                } else if (rank <= currentRank) {
                    throw new Exceptions.LootException(msg);
                }
            }

            log.info('Player ' + this.id + ' has looted ' + item.id);
            if (Types.isArmor(item.kind) && this.invincible) {
                this.stopInvincibility();
            }
            item.onLoot(this);
        }
    }

    // Returns true if the character is currently walking towards an item in order to loot it.
    isMovingToLoot(): boolean {
        return this.isLootMoving;
    }

    getSpriteName(): string {
        return this.spriteName;
    }

    setSpriteName(name: string): void {
        this.spriteName = name;
    }

    getArmorName(): string {
        const sprite = this.getArmorSprite();
        return sprite.id;
    }

    getArmorSprite(): PlayerSprite {
        if (this.invincible && this.currentArmorSprite) {
            return this.currentArmorSprite;
        }
        return this.sprite as unknown as PlayerSprite;
    }

    getWeaponName(): string | null {
        return this.weaponName;
    }

    setWeaponName(name: string | null): void {
        this.weaponName = name;
    }

    hasWeapon(): boolean {
        return this.weaponName !== null;
    }

    switchWeapon(newWeaponName: string): void {
        let count = 14;
        let value = false;
        let blanking: ReturnType<typeof setInterval> | null = null;

        const toggle = function (): boolean {
            value = !value;
            return value;
        };

        if (newWeaponName !== this.getWeaponName()) {
            if (this.isSwitchingWeapon) {
                if (blanking) {
                    clearInterval(blanking);
                }
            }

            this.switchingWeapon = true;
            blanking = setInterval(() => {
                if (toggle()) {
                    this.setWeaponName(newWeaponName);
                } else {
                    this.setWeaponName(null);
                }

                count -= 1;
                if (count === 1) {
                    clearInterval(blanking);
                    this.switchingWeapon = false;

                    if (this.switch_callback) {
                        this.switch_callback();
                    }
                }
            }, 90);
        }
    }

    switchArmor(newArmorSprite: PlayerSprite | null): void {
        let count = 14;
        let value = false;
        let blanking: ReturnType<typeof setInterval> | null = null;

        const toggle = function (): boolean {
            value = !value;
            return value;
        };

        if (newArmorSprite && newArmorSprite.id !== this.getSpriteName()) {
            if (this.isSwitchingArmor) {
                if (blanking) {
                    clearInterval(blanking);
                }
            }

            this.isSwitchingArmor = true;
            this.setSprite(newArmorSprite as unknown as never);
            this.setSpriteName(newArmorSprite.id);
            blanking = setInterval(() => {
                this.setVisible(toggle());

                count -= 1;
                if (count === 1) {
                    clearInterval(blanking);
                    this.isSwitchingArmor = false;

                    if (this.switch_callback) {
                        this.switch_callback();
                    }
                }
            }, 90);
        }
    }

    onArmorLoot(callback: (armorName: string) => void): void {
        this.armorloot_callback = callback;
    }

    onSwitchItem(callback: () => void): void {
        this.switch_callback = callback;
    }

    onInvincible(callback: () => void): void {
        this.invincible_callback = callback;
    }

    startInvincibility(): void {
        if (!this.invincible) {
            this.currentArmorSprite = this.getSprite() as unknown as PlayerSprite;
            this.invincible = true;
            if (this.invincible_callback) {
                this.invincible_callback();
            }
        } else {
            // If the player already has invincibility, just reset its duration.
            if (this.invincibleTimeout) {
                clearTimeout(this.invincibleTimeout);
            }
        }

        this.invincibleTimeout = setTimeout(() => {
            this.stopInvincibility();
            this.idle();
        }, 15000);
    }

    stopInvincibility(): void {
        if (this.invincible_callback) {
            this.invincible_callback();
        }
        this.invincible = false;

        if (this.currentArmorSprite) {
            this.setSprite(this.currentArmorSprite as unknown as never);
            this.setSpriteName(this.currentArmorSprite.id);
            this.currentArmorSprite = null;
        }
        if (this.invincibleTimeout) {
            clearTimeout(this.invincibleTimeout);
        }
    }
}

export default Player;
