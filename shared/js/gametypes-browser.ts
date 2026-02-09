import type { EntityCategory, EntityKind, EntityKindId, EntityKindName } from './entity-kind-domain';

type KindType = EntityCategory;
type KindEntry = [EntityKindId, KindType];

interface TypesContract {
    Messages: Record<string, number>;
    Entities: Record<string, EntityKindId>;
    Orientations: Record<string, number>;
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

const Types = {
    Messages: {
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
    },

    Entities: {
        WARRIOR: 1,

        // Mobs
        RAT: 2,
        SKELETON: 3,
        GOBLIN: 4,
        OGRE: 5,
        SPECTRE: 6,
        CRAB: 7,
        BAT: 8,
        WIZARD: 9,
        EYE: 10,
        SNAKE: 11,
        SKELETON2: 12,
        BOSS: 13,
        DEATHKNIGHT: 14,

        // Armors
        FIREFOX: 20,
        CLOTHARMOR: 21,
        LEATHERARMOR: 22,
        MAILARMOR: 23,
        PLATEARMOR: 24,
        REDARMOR: 25,
        GOLDENARMOR: 26,

        // Objects
        FLASK: 35,
        BURGER: 36,
        CHEST: 37,
        FIREPOTION: 38,
        CAKE: 39,

        // NPCs
        GUARD: 40,
        KING: 41,
        OCTOCAT: 42,
        VILLAGEGIRL: 43,
        VILLAGER: 44,
        PRIEST: 45,
        SCIENTIST: 46,
        AGENT: 47,
        RICK: 48,
        NYAN: 49,
        SORCERER: 50,
        BEACHNPC: 51,
        FORESTNPC: 52,
        DESERTNPC: 53,
        LAVANPC: 54,
        CODER: 55,

        // Weapons
        SWORD1: 60,
        SWORD2: 61,
        REDSWORD: 62,
        GOLDENSWORD: 63,
        MORNINGSTAR: 64,
        AXE: 65,
        BLUESWORD: 66,
    },

    Orientations: {
        UP: 1,
        DOWN: 2,
        LEFT: 3,
        RIGHT: 4,
    },
} as unknown as TypesContract;

const kinds: Record<EntityKindName, KindEntry> = {
    warrior: [Types.Entities.WARRIOR, 'player'],

    rat: [Types.Entities.RAT, 'mob'],
    skeleton: [Types.Entities.SKELETON, 'mob'],
    goblin: [Types.Entities.GOBLIN, 'mob'],
    ogre: [Types.Entities.OGRE, 'mob'],
    spectre: [Types.Entities.SPECTRE, 'mob'],
    deathknight: [Types.Entities.DEATHKNIGHT, 'mob'],
    crab: [Types.Entities.CRAB, 'mob'],
    snake: [Types.Entities.SNAKE, 'mob'],
    bat: [Types.Entities.BAT, 'mob'],
    wizard: [Types.Entities.WIZARD, 'mob'],
    eye: [Types.Entities.EYE, 'mob'],
    skeleton2: [Types.Entities.SKELETON2, 'mob'],
    boss: [Types.Entities.BOSS, 'mob'],

    sword1: [Types.Entities.SWORD1, 'weapon'],
    sword2: [Types.Entities.SWORD2, 'weapon'],
    axe: [Types.Entities.AXE, 'weapon'],
    redsword: [Types.Entities.REDSWORD, 'weapon'],
    bluesword: [Types.Entities.BLUESWORD, 'weapon'],
    goldensword: [Types.Entities.GOLDENSWORD, 'weapon'],
    morningstar: [Types.Entities.MORNINGSTAR, 'weapon'],

    firefox: [Types.Entities.FIREFOX, 'armor'],
    clotharmor: [Types.Entities.CLOTHARMOR, 'armor'],
    leatherarmor: [Types.Entities.LEATHERARMOR, 'armor'],
    mailarmor: [Types.Entities.MAILARMOR, 'armor'],
    platearmor: [Types.Entities.PLATEARMOR, 'armor'],
    redarmor: [Types.Entities.REDARMOR, 'armor'],
    goldenarmor: [Types.Entities.GOLDENARMOR, 'armor'],

    flask: [Types.Entities.FLASK, 'object'],
    cake: [Types.Entities.CAKE, 'object'],
    burger: [Types.Entities.BURGER, 'object'],
    chest: [Types.Entities.CHEST, 'object'],
    firepotion: [Types.Entities.FIREPOTION, 'object'],

    guard: [Types.Entities.GUARD, 'npc'],
    villagegirl: [Types.Entities.VILLAGEGIRL, 'npc'],
    villager: [Types.Entities.VILLAGER, 'npc'],
    coder: [Types.Entities.CODER, 'npc'],
    scientist: [Types.Entities.SCIENTIST, 'npc'],
    priest: [Types.Entities.PRIEST, 'npc'],
    king: [Types.Entities.KING, 'npc'],
    rick: [Types.Entities.RICK, 'npc'],
    nyan: [Types.Entities.NYAN, 'npc'],
    sorcerer: [Types.Entities.SORCERER, 'npc'],
    agent: [Types.Entities.AGENT, 'npc'],
    octocat: [Types.Entities.OCTOCAT, 'npc'],
    beachnpc: [Types.Entities.BEACHNPC, 'npc'],
    forestnpc: [Types.Entities.FORESTNPC, 'npc'],
    desertnpc: [Types.Entities.DESERTNPC, 'npc'],
    lavanpc: [Types.Entities.LAVANPC, 'npc'],
};

function getType(kind: EntityKind): KindType {
    const kindName = Types.getKindAsString(kind);
    if (!kindName || !(kindName in kinds)) {
        throw new Error('Unknown kind: ' + String(kind));
    }
    return kinds[kindName][1];
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
    for (var k in kinds) {
        if (kinds[k][0] === kind) {
            return k as EntityKindName;
        }
    }
};

Types.forEachKind = function (callback) {
    for (var k in kinds) {
        callback(kinds[k][0], k);
    }
};

Types.forEachArmor = function (callback) {
    Types.forEachKind(function (kind, kindName) {
        if (Types.isArmor(kind)) {
            callback(kind, kindName);
        }
    });
};

Types.forEachMobOrNpcKind = function (callback) {
    Types.forEachKind(function (kind, kindName) {
        if (Types.isMob(kind) || Types.isNpc(kind)) {
            callback(kind, kindName);
        }
    });
};

Types.forEachArmorKind = function (callback) {
    Types.forEachKind(function (kind, kindName) {
        if (Types.isArmor(kind)) {
            callback(kind, kindName);
        }
    });
};

Types.getOrientationAsString = function (orientation) {
    switch (orientation) {
        case Types.Orientations.LEFT:
            return 'left';
            break;
        case Types.Orientations.RIGHT:
            return 'right';
            break;
        case Types.Orientations.UP:
            return 'up';
            break;
        case Types.Orientations.DOWN:
            return 'down';
            break;
    }
};

Types.getRandomItemKind = function (item) {
    var all = this.rankedWeapons.concat(this.rankedArmors),
        forbidden = [Types.Entities.SWORD1, Types.Entities.CLOTHARMOR],
        itemKinds = all.filter(function (kind) {
            return forbidden.indexOf(kind) < 0;
        }),
        i = Math.floor(Math.random() * itemKinds.length);

    return itemKinds[i];
};

Types.getMessageTypeAsString = function (type) {
    var typeName;
    for (var name in Types.Messages) {
        if (Types.Messages[name] === type) {
            typeName = name;
            break;
        }
    }
    if (!typeName) {
        typeName = 'UNKNOWN';
    }
    return typeName;
};

if (typeof globalThis !== 'undefined') {
    (globalThis as unknown as { Types?: TypesContract }).Types = Types;
}

export { Types };
export default Types;
