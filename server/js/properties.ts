import type { EntityKind } from '../../shared/js/entity-kind-domain';

import Log from './log';
import Types from '../../shared/js/gametypes-browser';
import { MOB_PROPERTIES_DATA } from './generated/mob-properties.generated';

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

const PropertiesData = MOB_PROPERTIES_DATA as unknown as Record<string, MobProperty>;
const Properties = PropertiesData as PropertiesContract & Record<string, MobProperty>;

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
    } catch (_error) {
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
    } catch (_error) {
        log.error('No level found for weapon: ' + Types.getKindAsString(kind));
        return 1;
    }
};

Properties.getHitPoints = function (kind: EntityKind): number {
    try {
        return getMobProperty(kind).hp;
    } catch (_error) {
        log.error('No hit points found for kind: ' + Types.getKindAsString(kind));
        return 0;
    }
};

export default Properties;
