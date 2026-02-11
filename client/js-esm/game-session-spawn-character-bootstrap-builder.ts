import { applySpawnedCharacterBootstrap } from './game-session-spawn-character-bootstrap';
import type { EntityKind } from '../../shared/js/entity-kind-domain';

type SpawnBootstrapEntity = {
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

type SpawnBootstrapBuilderHost = {
    entity: SpawnBootstrapEntity;
    x: number;
    y: number;
    orientation: number;
    getSprite(spriteName: string): unknown;
    addEntity(entity: SpawnBootstrapEntity): void;
    describeKind(kind: EntityKind): string;
    logDebug(message: string): void;
};

export function applySpawnedCharacterBootstrapFromHost(host: SpawnBootstrapBuilderHost): void {
    applySpawnedCharacterBootstrap({
        entity: host.entity,
        x: host.x,
        y: host.y,
        orientation: host.orientation,
        getSprite(spriteName) {
            return host.getSprite(spriteName);
        },
        addEntity(entity) {
            host.addEntity(entity);
        },
        logSpawn(entity) {
            host.logDebug(
                'Spawned ' +
                    host.describeKind(entity.kind) +
                    ' (' +
                    entity.id +
                    ') at ' +
                    entity.gridX +
                    ', ' +
                    entity.gridY
            );
        },
    });
}
