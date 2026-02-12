import Character, { type CharacterEvents } from './character';
import Exceptions from './exceptions';
import log from './platform/log';
import Types from '../shared/gametypes-browser';
import type { EntityKind } from '../shared/entity-kind-domain';
import type { SpriteLike } from './entity';
import type { MergeEvents } from '../shared/typed-event-emitter';

type PlayerSprite = SpriteLike & {
    id: string;
    animationData: Record<string, { row: number }>;
};
const isPlayerSprite = (sprite: ReturnType<Character['getSprite']>): sprite is PlayerSprite =>
    Boolean(sprite) && typeof sprite === 'object' && 'id' in sprite && typeof sprite.id === 'string';

type LootItem = {
    id: string | number;
    kind: EntityKind;
    type: 'armor' | 'weapon' | 'object' | (string & {});
    onLoot: (player: Player) => void;
};

export type PlayerEvents = {
    armorLoot: [armorName: string];
    switchItem: [];
    invincible: [];
};

class Player extends Character<MergeEvents<CharacterEvents, PlayerEvents>> {
    static MAX_LEVEL = 10;

    nameOffsetY: number;

    spriteName: string;
    weaponName: string | null;
    declare dirtyRect: Record<string, number> | null;
    isOnPlateau: boolean;
    lastCheckpoint: { id: string | number } | null;

    isSwitchingWeapon: boolean;
    isSwitchingArmor: boolean;
    switchingWeapon: boolean;

    currentArmorSprite: PlayerSprite | null;
    invincible: boolean;
    invincibleTimeout: ReturnType<typeof setTimeout> | null;

    constructor(id: string | number, name: string, kind: EntityKind) {
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
        this.isSwitchingWeapon = true;
        this.isSwitchingArmor = false;
        this.switchingWeapon = false;

        this.currentArmorSprite = null;
        this.invincible = false;
        this.invincibleTimeout = null;
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
                currentRank = Types.getWeaponRank(Types.getKindFromString(this.weaponName ?? 'sword1'));
                msg = 'You are wielding a better weapon';
            }

            if (rank !== null && currentRank !== null) {
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
        const sprite = this.getSprite();
        if (isPlayerSprite(sprite)) {
            return sprite;
        }
        throw new Error('Player armor sprite unavailable');
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
        let blanking: ReturnType<typeof setInterval> | undefined;

        const toggle = function (): boolean {
            value = !value;
            return value;
        };

        if (newWeaponName !== this.getWeaponName()) {
            if (this.isSwitchingWeapon) {
                clearInterval(blanking);
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

                    this.emit('switchItem');
                }
            }, 90);
        }
    }

    switchArmor(newArmorSprite: PlayerSprite | null): void {
        let count = 14;
        let value = false;
        let blanking: ReturnType<typeof setInterval> | undefined;

        const toggle = function (): boolean {
            value = !value;
            return value;
        };

        if (newArmorSprite && newArmorSprite.id !== this.getSpriteName()) {
            if (this.isSwitchingArmor) {
                clearInterval(blanking);
            }

            this.isSwitchingArmor = true;
            this.setSprite(newArmorSprite);
            this.setSpriteName(newArmorSprite.id);
            blanking = setInterval(() => {
                this.setVisible(toggle());

                count -= 1;
                if (count === 1) {
                    clearInterval(blanking);
                    this.isSwitchingArmor = false;

                    this.emit('switchItem');
                }
            }, 90);
        }
    }

    emitArmorLoot(armorName: string): void {
        this.emit('armorLoot', armorName);
    }

    startInvincibility(): void {
        if (!this.invincible) {
            const sprite = this.getSprite();
            this.currentArmorSprite = isPlayerSprite(sprite) ? sprite : null;
            this.invincible = true;
            this.emit('invincible');
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
        this.emit('invincible');
        this.invincible = false;

        if (this.currentArmorSprite) {
            this.setSprite(this.currentArmorSprite);
            this.setSpriteName(this.currentArmorSprite.id);
            this.currentArmorSprite = null;
        }
        if (this.invincibleTimeout) {
            clearTimeout(this.invincibleTimeout);
        }
    }
}

export default Player;
