import type { EntityKind } from '../shared/entity-kind-domain';

import Log from './log';
import Types from '../shared/gametypes-browser';
import { MOB_PROPERTIES_DATA } from './generated/mob-properties.generated';

const log = Log.getLogger();

interface MobProperty {
    drops: Record<string, number>;
    hp: number;
    armor: number;
    weapon: number;
}

interface PropertiesContract {
    getArmorLevel(kind: EntityKind): number;
    getWeaponLevel(kind: EntityKind): number;
    getHitPoints(kind: EntityKind): number;
}

const PropertiesData = MOB_PROPERTIES_DATA;

function getMobProperty(kind: EntityKind): MobProperty {
    const kindName = Types.getKindAsString(kind);
    if (!kindName || !(kindName in PropertiesData)) {
        throw new Error('Unknown kind: ' + String(kind));
    }
    return PropertiesData[kindName as keyof typeof PropertiesData];
}

const Properties: PropertiesContract & typeof PropertiesData = {
    ...PropertiesData,
    getArmorLevel(kind: EntityKind): number {
        try {
            if (Types.isMob(kind)) {
                return getMobProperty(kind).armor;
            }
            return Types.getArmorRank(kind) + 1;
        } catch (_error) {
            log.error('No level found for armor: ' + Types.getKindAsString(kind));
            return 1;
        }
    },
    getWeaponLevel(kind: EntityKind): number {
        try {
            if (Types.isMob(kind)) {
                return getMobProperty(kind).weapon;
            }
            return Types.getWeaponRank(kind) + 1;
        } catch (_error) {
            log.error('No level found for weapon: ' + Types.getKindAsString(kind));
            return 1;
        }
    },
    getHitPoints(kind: EntityKind): number {
        try {
            return getMobProperty(kind).hp;
        } catch (_error) {
            log.error('No hit points found for kind: ' + Types.getKindAsString(kind));
            return 0;
        }
    },
};

export default Properties;
