import type { EntityId } from '../../shared/domain/ids';

type MobHateEntry = {
    id: EntityId;
};

type MobWithLinks = {
    target: EntityId | null;
    hatelist: MobHateEntry[];
};

type PlayerEntity = {
    removeAttacker(mob: MobWithLinks): void;
    removeHater(mob: MobWithLinks): void;
};

type EntityLookupValue = PlayerEntity | null | undefined | object;
type GetEntityById = (id: EntityId) => EntityLookupValue;
type IsPlayerEntity = (entity: EntityLookupValue) => entity is PlayerEntity;

export function clearWorldMobAggroLink({
    mob,
    getEntityById,
    isPlayerEntity,
}: {
    mob: MobWithLinks;
    getEntityById: GetEntityById;
    isPlayerEntity: IsPlayerEntity;
}): void {
    if (!mob.target) {
        return;
    }
    const player = getEntityById(mob.target);
    if (isPlayerEntity(player)) {
        player.removeAttacker(mob);
    }
}

export function clearWorldMobHateLinks({
    mob,
    getEntityById,
    isPlayerEntity,
}: {
    mob: MobWithLinks | null | undefined;
    getEntityById: GetEntityById;
    isPlayerEntity: IsPlayerEntity;
}): void {
    if (!mob) {
        return;
    }
    mob.hatelist.forEach((entry) => {
        const player = getEntityById(entry.id);
        if (isPlayerEntity(player)) {
            player.removeHater(mob);
        }
    });
}
