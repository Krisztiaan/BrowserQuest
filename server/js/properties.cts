const Log = require('./log') as {
    getLogger(): { error(...args: unknown[]): void };
};

const Types = require('../../shared/js/gametypes') as {
    isMob(kind: number | string): boolean;
    getKindAsString(kind: number | string): string;
    getArmorRank(kind: number | string): number;
    getWeaponRank(kind: number | string): number;
};

const log = Log.getLogger();

interface MobProperty {
    drops: Record<string, number>;
    hp: number;
    armor: number;
    weapon: number;
}

interface PropertiesContract extends Record<string, unknown> {
    getArmorLevel(kind: number | string): number | undefined;
    getWeaponLevel(kind: number | string): number | undefined;
    getHitPoints(kind: number | string): number;
}

const PropertiesData: Record<string, MobProperty> = {
    rat: {
        drops: {
            flask: 40,
            burger: 10,
            firepotion: 5,
        },
        hp: 25,
        armor: 1,
        weapon: 1,
    },

    skeleton: {
        drops: {
            flask: 40,
            mailarmor: 10,
            axe: 20,
            firepotion: 5,
        },
        hp: 110,
        armor: 2,
        weapon: 2,
    },

    goblin: {
        drops: {
            flask: 50,
            leatherarmor: 20,
            axe: 10,
            firepotion: 5,
        },
        hp: 90,
        armor: 2,
        weapon: 1,
    },

    ogre: {
        drops: {
            burger: 10,
            flask: 50,
            platearmor: 20,
            morningstar: 20,
            firepotion: 5,
        },
        hp: 200,
        armor: 3,
        weapon: 2,
    },

    spectre: {
        drops: {
            flask: 30,
            redarmor: 40,
            redsword: 30,
            firepotion: 5,
        },
        hp: 250,
        armor: 2,
        weapon: 4,
    },

    deathknight: {
        drops: {
            burger: 95,
            firepotion: 5,
        },
        hp: 250,
        armor: 3,
        weapon: 3,
    },

    crab: {
        drops: {
            flask: 50,
            axe: 20,
            leatherarmor: 10,
            firepotion: 5,
        },
        hp: 60,
        armor: 2,
        weapon: 1,
    },

    snake: {
        drops: {
            flask: 50,
            mailarmor: 10,
            morningstar: 10,
            firepotion: 5,
        },
        hp: 150,
        armor: 3,
        weapon: 2,
    },

    skeleton2: {
        drops: {
            flask: 60,
            platearmor: 15,
            bluesword: 15,
            firepotion: 5,
        },
        hp: 200,
        armor: 3,
        weapon: 3,
    },

    eye: {
        drops: {
            flask: 50,
            redarmor: 20,
            redsword: 10,
            firepotion: 5,
        },
        hp: 200,
        armor: 3,
        weapon: 3,
    },

    bat: {
        drops: {
            flask: 50,
            axe: 10,
            firepotion: 5,
        },
        hp: 80,
        armor: 2,
        weapon: 1,
    },

    wizard: {
        drops: {
            flask: 50,
            platearmor: 20,
            firepotion: 5,
        },
        hp: 100,
        armor: 2,
        weapon: 6,
    },

    boss: {
        drops: {
            goldensword: 100,
        },
        hp: 700,
        armor: 6,
        weapon: 7,
    },
};

const Properties = PropertiesData as PropertiesContract;

Properties.getArmorLevel = function (kind: number | string): number | undefined {
    try {
        if (Types.isMob(kind)) {
            const mob = Properties[Types.getKindAsString(kind)] as MobProperty;
            return mob.armor;
        } else {
            return Types.getArmorRank(kind) + 1;
        }
    } catch (e) {
        log.error('No level found for armor: ' + Types.getKindAsString(kind));
        return undefined;
    }
};

Properties.getWeaponLevel = function (kind: number | string): number | undefined {
    try {
        if (Types.isMob(kind)) {
            const mob = Properties[Types.getKindAsString(kind)] as MobProperty;
            return mob.weapon;
        } else {
            return Types.getWeaponRank(kind) + 1;
        }
    } catch (e) {
        log.error('No level found for weapon: ' + Types.getKindAsString(kind));
        return undefined;
    }
};

Properties.getHitPoints = function (kind: number | string): number {
    const mob = Properties[Types.getKindAsString(kind)] as MobProperty;
    return mob.hp;
};

module.exports = Properties;
