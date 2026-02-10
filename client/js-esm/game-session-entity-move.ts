type EntityMoveCandidate = {
    disengage(): void;
    idle(): void;
};

type EntityMoveHost<TEntity extends EntityMoveCandidate> = {
    entityId: string | number;
    playerId: string | number | null;
    x: number;
    y: number;
    resolveEntity(entityId: string | number): TEntity | null;
    isPlayerAttackedBy(entity: TEntity): boolean;
    unlockCowardAchievement(): void;
    moveEntity(entity: TEntity, x: number, y: number): void;
};

export function handleEntityMove<TEntity extends EntityMoveCandidate>(host: EntityMoveHost<TEntity>): void {
    if (host.entityId === host.playerId) {
        return;
    }

    const entity = host.resolveEntity(host.entityId);
    if (!entity) {
        return;
    }

    if (host.isPlayerAttackedBy(entity)) {
        host.unlockCowardAchievement();
    }

    entity.disengage();
    entity.idle();
    host.moveEntity(entity, host.x, host.y);
}
