import {
    ENTITY_KIND_DOMAIN,
    type EntityCategory,
    type EntityKind,
    type EntityKindId,
    type EntityKindName,
} from './entity-kind-domain';

type KindType = EntityCategory;
type KindEntry = readonly [EntityKindId, KindType];

const MESSAGE_OPCODES = {
    HELLO: 0,
    WELCOME: 1,
    SPAWN: 2,
    DESPAWN: 3,
    MOVE: 4,
    LOOTMOVE: 5,
    AGGRO: 6,
    ATTACK: 7,
    HIT: 8,
    HURT: 9,
    HEALTH: 10,
    CHAT: 11,
    LOOT: 12,
    EQUIP: 13,
    DROP: 14,
    TELEPORT: 15,
    DAMAGE: 16,
    POPULATION: 17,
    KILL: 18,
    LIST: 19,
    WHO: 20,
    ZONE: 21,
    DESTROY: 22,
    HP: 23,
    BLINK: 24,
    OPEN: 25,
    CHECK: 26,
    ACHIEVEMENT: 27,
    ACHIEVEMENTS: 28,
} as const;

type EntityIdsByUpperName = {
    [K in EntityKindName as Uppercase<K>]: EntityKindId;
};

const ENTITY_IDS = Object.fromEntries(
    Object.entries(ENTITY_KIND_DOMAIN).map(([kindName, [kindId]]) => [kindName.toUpperCase(), kindId])
) as EntityIdsByUpperName;

const ORIENTATION_IDS = {
    UP: 1,
    DOWN: 2,
    LEFT: 3,
    RIGHT: 4,
} as const;

interface TypesContract {
    Messages: MessageOpcodeMap;
    Entities: typeof ENTITY_IDS;
    Orientations: typeof ORIENTATION_IDS;
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
    getOrientationAsString(orientation: number): string | undefined;
    getRandomItemKind(item: unknown): number | undefined;
    getMessageTypeAsString(type: number): string;
}

export type MessageOpcodeMap = typeof MESSAGE_OPCODES;

const Types = {
    Messages: MESSAGE_OPCODES,
    Entities: ENTITY_IDS,
    Orientations: ORIENTATION_IDS,
} as unknown as TypesContract;

const kinds: Record<EntityKindName, KindEntry> = ENTITY_KIND_DOMAIN;

function getType(kind: EntityKind): KindType {
    const kindName = Types.getKindAsString(kind);
    if (!kindName || !(kindName in kinds)) {
        throw new Error('Unknown kind: ' + String(kind));
    }
    return kinds[kindName as EntityKindName][1];
}

Types.rankedWeapons = [
    Types.Entities.SWORD1,
    Types.Entities.SWORD2,
    Types.Entities.AXE,
    Types.Entities.MORNINGSTAR,
    Types.Entities.BLUESWORD,
    Types.Entities.REDSWORD,
    Types.Entities.GOLDENSWORD,
];

Types.rankedArmors = [
    Types.Entities.CLOTHARMOR,
    Types.Entities.LEATHERARMOR,
    Types.Entities.MAILARMOR,
    Types.Entities.PLATEARMOR,
    Types.Entities.REDARMOR,
    Types.Entities.GOLDENARMOR,
];

Types.getWeaponRank = function (weaponKind) {
    return Types.rankedWeapons.indexOf(weaponKind as EntityKindId);
};

Types.getArmorRank = function (armorKind) {
    return Types.rankedArmors.indexOf(armorKind as EntityKindId);
};

Types.isPlayer = function (kind) {
    return getType(kind) === 'player';
};

Types.isMob = function (kind) {
    return getType(kind) === 'mob';
};

Types.isNpc = function (kind) {
    return getType(kind) === 'npc';
};

Types.isCharacter = function (kind) {
    return Types.isMob(kind) || Types.isNpc(kind) || Types.isPlayer(kind);
};

Types.isArmor = function (kind) {
    return getType(kind) === 'armor';
};

Types.isWeapon = function (kind) {
    return getType(kind) === 'weapon';
};

Types.isObject = function (kind) {
    return getType(kind) === 'object';
};

Types.isChest = function (kind) {
    return kind === Types.Entities.CHEST;
};

Types.isItem = function (kind) {
    return Types.isWeapon(kind) || Types.isArmor(kind) || (Types.isObject(kind) && !Types.isChest(kind));
};

Types.isHealingItem = function (kind) {
    return kind === Types.Entities.FLASK || kind === Types.Entities.BURGER;
};

Types.isExpendableItem = function (kind) {
    return Types.isHealingItem(kind) || kind === Types.Entities.FIREPOTION || kind === Types.Entities.CAKE;
};

Types.getKindFromString = function (kind) {
    if (kind in kinds) {
        return kinds[kind as EntityKindName][0];
    }
};

Types.getKindAsString = function (kind) {
    const kindNames = Object.keys(kinds) as EntityKindName[];
    for (const kindName of kindNames) {
        if (kinds[kindName][0] === kind) {
            return kindName;
        }
    }
};

Types.forEachKind = function (callback) {
    const kindNames = Object.keys(kinds) as EntityKindName[];
    for (const kindName of kindNames) {
        callback(kinds[kindName][0], kindName);
    }
};

Types.forEachMobOrNpcKind = function (callback) {
    Types.forEachKind(function (kind, kindName) {
        if (Types.isMob(kind) || Types.isNpc(kind)) {
            callback(kind, kindName);
        }
    });
};

const forEachArmorKind = function (callback: (kind: EntityKindId, kindName: string) => void) {
    Types.forEachKind(function (kind, kindName) {
        if (Types.isArmor(kind)) {
            callback(kind, kindName);
        }
    });
};

Types.forEachArmor = forEachArmorKind;
Types.forEachArmorKind = forEachArmorKind;

Types.getOrientationAsString = function (orientation) {
    switch (orientation) {
        case Types.Orientations.LEFT:
            return 'left';
        case Types.Orientations.RIGHT:
            return 'right';
        case Types.Orientations.UP:
            return 'up';
        case Types.Orientations.DOWN:
            return 'down';
    }
};

Types.getRandomItemKind = function (_item) {
    const all = Types.rankedWeapons.concat(Types.rankedArmors);
    const forbidden = new Set<EntityKindId>([Types.Entities.SWORD1, Types.Entities.CLOTHARMOR]);
    const itemKinds = all.filter((kind) => !forbidden.has(kind));
    const i = Math.floor(Math.random() * itemKinds.length);

    return itemKinds[i];
};

Types.getMessageTypeAsString = function (type) {
    const messageEntries = Object.entries(Types.Messages);
    const match = messageEntries.find(([, value]) => value === type);
    return match?.[0] ?? 'UNKNOWN';
};

if (typeof globalThis !== 'undefined') {
    (globalThis as unknown as { Types?: TypesContract }).Types = Types;
}

export { Types };
export default Types;
