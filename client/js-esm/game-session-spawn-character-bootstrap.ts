import type { EntityKind } from '../../shared/js/entity-kind-domain';

type SpawnedCharacterBootstrapEntity = {
    kind: EntityKind;
    id: string | number;
    gridX: number;
    gridY: number;
    getSpriteName(): string;
    setSprite(sprite: unknown): void;
    setGridPosition(x: number, y: number): void;
    setOrientation(orientation: number): void;
    idle(): void;
};

type SpawnCharacterBootstrapHost<TEntity extends SpawnedCharacterBootstrapEntity> = {
    entity: TEntity;
    x: number;
    y: number;
    orientation: number;
    getSprite(spriteName: string): unknown;
    addEntity(entity: TEntity): void;
    logSpawn(entity: TEntity): void;
};

export function applySpawnedCharacterBootstrap<TEntity extends SpawnedCharacterBootstrapEntity>(
    host: SpawnCharacterBootstrapHost<TEntity>
): void {
    host.entity.setSprite(host.getSprite(host.entity.getSpriteName()));
    host.entity.setGridPosition(host.x, host.y);
    host.entity.setOrientation(host.orientation);
    host.entity.idle();

    host.addEntity(host.entity);
    host.logSpawn(host.entity);
}
