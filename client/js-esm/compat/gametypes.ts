import Types from '../../../shared/js/gametypes-browser.ts';
import type { EntityCategory, EntityKind, EntityKindId, EntityKindName } from '../../../shared/js/entity-kind-domain';

interface GametypesContract {
    Messages: Record<string, number>;
    Entities: Record<string, EntityKindId>;
    Orientations: {
        UP: number;
        DOWN: number;
        LEFT: number;
        RIGHT: number;
    };
    rankedWeapons: EntityKindId[];
    rankedArmors: EntityKindId[];
    getWeaponRank(weaponKind: EntityKind): number;
    getArmorRank(armorKind: EntityKind): number;
    isPlayer(kind: EntityKind): boolean;
    isMob(kind: EntityKind): boolean;
    isNpc(kind: EntityKind): boolean;
    isCharacter(kind: EntityKind): boolean;
    isArmor(kind: EntityKind): boolean;
    isWeapon(kind: EntityKind): boolean;
    isObject(kind: EntityKind): boolean;
    isChest(kind: EntityKind): boolean;
    isItem(kind: EntityKind): boolean;
    isHealingItem(kind: EntityKind): boolean;
    isExpendableItem(kind: EntityKind): boolean;
    getKindFromString(kind: string): EntityKindId | undefined;
    getKindAsString(kind: EntityKind): string | undefined;
    forEachKind(callback: (kind: EntityKindId, kindName: string) => void): void;
    forEachArmor(callback: (kind: EntityKindId, kindName: string) => void): void;
    forEachMobOrNpcKind(callback: (kind: EntityKindId, kindName: string) => void): void;
    forEachArmorKind(callback: (kind: EntityKindId, kindName: string) => void): void;
    getOrientationAsString(orientation: number): 'left' | 'right' | 'up' | 'down' | undefined;
    getRandomItemKind(item: unknown): EntityKindId | undefined;
    getMessageTypeAsString(type: number): string;
}

export type { EntityKind, EntityKindId, EntityKindName, EntityCategory };

export default Types as unknown as GametypesContract;
