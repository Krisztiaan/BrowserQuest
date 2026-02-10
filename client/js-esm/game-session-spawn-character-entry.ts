type SpawnCharacterEntryEntity = {
    id: string | number;
};

type SpawnCharacterEntryHost<TEntity extends SpawnCharacterEntryEntity> = {
    entity: TEntity;
    playerId: string | number | null;
    entityExists(entityId: string | number): boolean;
    handleSpawn(): void;
    logDuplicate(entity: TEntity): void;
    logError(error: unknown): void;
};

export function handleSpawnCharacterEntry<TEntity extends SpawnCharacterEntryEntity>(
    host: SpawnCharacterEntryHost<TEntity>
): void {
    if (host.entityExists(host.entity.id)) {
        host.logDuplicate(host.entity);
        return;
    }

    try {
        if (host.entity.id !== host.playerId) {
            host.handleSpawn();
        }
    } catch (error) {
        host.logError(error);
    }
}
