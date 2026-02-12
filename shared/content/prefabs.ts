import type { EntityKind } from '../entity-kind-domain';
import Types from '../gametypes-browser';
import { ITEM_PREFABS, MOB_PREFABS } from '../generated/prefabs.generated';

export type PrefabDrop = Readonly<{
    kind: EntityKind;
    chance: number;
}>;

export type MobPrefab = Readonly<{
    type: 'mob';
    kind: EntityKind;
    combat: Readonly<{
        maxHitPoints: number;
        armorLevel: number;
        weaponLevel: number;
    }>;
    drops: readonly PrefabDrop[];
}>;

export type ItemPrefab = Readonly<{
    type: 'item';
    kind: EntityKind;
    lootMessage: string;
}>;

export type Prefab = MobPrefab | ItemPrefab;

export function getMobPrefab(kind: EntityKind): MobPrefab | null {
    if (!Types.isMob(kind)) {
        return null;
    }
    const kindId = typeof kind === 'number' ? kind : Types.getKindFromString(kind);
    if (kindId === undefined) {
        return null;
    }
    return (MOB_PREFABS as Record<number, MobPrefab | undefined>)[kindId] ?? null;
}

export function requireMobPrefab(kind: EntityKind): MobPrefab {
    const prefab = getMobPrefab(kind);
    if (!prefab) {
        throw new Error(`Missing mob prefab for kind ${String(kind)}`);
    }
    return prefab;
}

export function getItemPrefab(kind: EntityKind): ItemPrefab | null {
    if (!Types.isItem(kind)) {
        return null;
    }
    const kindId = typeof kind === 'number' ? kind : Types.getKindFromString(kind);
    if (kindId === undefined) {
        return null;
    }
    return (ITEM_PREFABS as Record<number, ItemPrefab | undefined>)[kindId] ?? null;
}

export function requireItemPrefab(kind: EntityKind): ItemPrefab {
    const prefab = getItemPrefab(kind);
    if (!prefab) {
        throw new Error(`Missing item prefab for kind ${String(kind)}`);
    }
    return prefab;
}
