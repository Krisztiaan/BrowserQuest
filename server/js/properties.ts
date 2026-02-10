import type { EntityKind } from '../../shared/js/entity-kind-domain';

import Log from './log';
import Types from '../../shared/js/gametypes';

const log = Log.getLogger();

interface MobProperty {
    drops: Record<string, number>;
    hp: number;
    armor: number;
    weapon: number;
}

interface PropertiesContract extends Record<string, unknown> {
    getArmorLevel(kind: EntityKind): number;
    getWeaponLevel(kind: EntityKind): number;
    getHitPoints(kind: EntityKind): number;
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

function getMobProperty(kind: EntityKind): MobProperty {
    const kindName = Types.getKindAsString(kind);
    if (!kindName || !(kindName in Properties)) {
        throw new Error('Unknown kind: ' + String(kind));
    }
    return Properties[kindName] as MobProperty;
}

Properties.getArmorLevel = function (kind: EntityKind): number {
    try {
        if (Types.isMob(kind)) {
            return getMobProperty(kind).armor;
        }
        return Types.getArmorRank(kind) + 1;
    } catch (error) {
        log.error('No level found for armor: ' + Types.getKindAsString(kind));
        return 1;
    }
};

Properties.getWeaponLevel = function (kind: EntityKind): number {
    try {
        if (Types.isMob(kind)) {
            return getMobProperty(kind).weapon;
        }
        return Types.getWeaponRank(kind) + 1;
    } catch (error) {
        log.error('No level found for weapon: ' + Types.getKindAsString(kind));
        return 1;
    }
};

Properties.getHitPoints = function (kind: EntityKind): number {
    try {
        return getMobProperty(kind).hp;
    } catch (error) {
        log.error('No hit points found for kind: ' + Types.getKindAsString(kind));
        return 0;
    }
};

export default Properties;
