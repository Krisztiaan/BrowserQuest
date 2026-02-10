import Item from './item';

type DestroyableEntity = {
    id: string | number;
};

type EntityDestroyHost<TEntity extends DestroyableEntity> = {
    entity: TEntity | null;
    removeItem(item: Item): void;
    removeEntity(entity: TEntity): void;
    logDestroyed(entity: TEntity): void;
};

export function handleEntityDestroy<TEntity extends DestroyableEntity>(host: EntityDestroyHost<TEntity>): void {
    if (!host.entity) {
        return;
    }

    if (host.entity instanceof Item) {
        host.removeItem(host.entity);
    } else {
        host.removeEntity(host.entity);
    }

    host.logDestroyed(host.entity);
}
