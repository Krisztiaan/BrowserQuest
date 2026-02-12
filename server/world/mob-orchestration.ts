import type { EntityId } from '../../shared/domain/ids';

type MobHateEntry = {
    id: EntityId;
};

type MobWithLinks = {
    target: EntityId | null;
    hatelist: MobHateEntry[];
};

type PlayerEntity = {
    removeAttacker(mob: unknown): void;
    removeHater(mob: unknown): void;
};

type GetEntityById = (id: EntityId) => unknown;
type IsPlayerEntity = (entity: unknown) => entity is PlayerEntity;

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

