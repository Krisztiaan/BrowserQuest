type EntityMap<T> = Record<string, T>;
type EntityCallback<T> = (entity: T) => void;

export function forEachEntityInWorldMap<T>(entityMap: EntityMap<T>, callback: EntityCallback<T>): void {
    for (const entityId in entityMap) {
        const entity = entityMap[entityId];
        if (entity !== undefined) {
            callback(entity);
        }
    }
}

export function forEachWorldCharacter<TCharacter>({
    callback,
    forEachPlayer,
    forEachMob,
}: {
    callback: EntityCallback<TCharacter>;
    forEachPlayer(callback: EntityCallback<TCharacter>): void;
    forEachMob(callback: EntityCallback<TCharacter>): void;
}): void {
    forEachPlayer(callback);
    forEachMob(callback);
}

