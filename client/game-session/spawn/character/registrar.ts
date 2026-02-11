import type { EntityKind } from '../../../../shared/entity-kind-domain';
import Character from '../../../character';
import type { GameClientEventSource } from '../../../gameclient';
import { handleSpawnCharacterEntry } from './entry';
import { applySpawnedCharacterBootstrapFromHost } from './bootstrap-builder';
import { installSpawnedCharacterOrchestration } from './orchestration-builder';

type SpawnEntity = {
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

type SpawnCharacterClient<TEntity extends SpawnEntity> = {
    on: GameClientEventSource['on'];
};

type SpawnCharacterRegistrarHost<TEntity extends SpawnEntity> = {
    client: SpawnCharacterClient<TEntity>;
    playerId: string | number | null;
    entityExists(entityId: string | number): boolean;
    getSprite(spriteName: string): unknown;
    addEntity(entity: TEntity): void;
    describeKind(kind: EntityKind): string;
    logDebug(message: string): void;
    logInfo(message: string): void;
    logError(error: unknown): void;
    unregisterEntityPosition(character: Character): void;
    registerEntityDualPosition(character: Character): void;
    registerEntityPosition(character: Character): void;
    isDoor(gridX: number, gridY: number): boolean;
    getDoorDestination(gridX: number, gridY: number): { x: number; y: number };
    findPath(character: Character, x: number, y: number, ignored: Character[]): unknown;
    recordMobDeathPosition(characterId: string | number, x: number, y: number): void;
    getDeathSprite(character: Character): unknown;
    removeEntity(character: Character): void;
    removeFromRenderingGrid(character: Character, x: number, y: number): void;
    isPlayerTarget(character: Character): boolean;
    disengagePlayer(): void;
    removeFromEntityGrid(character: Character, x: number, y: number): void;
    removeFromPathingGrid(x: number, y: number): void;
    playKillSoundIfVisible(character: Character): void;
    updateCursor(): void;
    assignBubbleTo(character: { id: string | number; x: number; y: number }): void;
    resolveTarget(targetId: string | number): Character | null;
    createAttackLink(attacker: Character, target: Character): void;
};

export function registerSpawnCharacterHandler<TEntity extends SpawnEntity>(
    host: SpawnCharacterRegistrarHost<TEntity>
): void {
    const directHost = {
        unregisterEntityPosition: host.unregisterEntityPosition,
        registerEntityDualPosition: host.registerEntityDualPosition,
        registerEntityPosition: host.registerEntityPosition,
        isDoor: host.isDoor,
        getDoorDestination: host.getDoorDestination,
        findPath: host.findPath,
        logInfo: host.logInfo,
        recordMobDeathPosition: host.recordMobDeathPosition,
        getDeathSprite: host.getDeathSprite,
        removeEntity: host.removeEntity,
        removeFromRenderingGrid: host.removeFromRenderingGrid,
        isPlayerTarget: host.isPlayerTarget,
        disengagePlayer: host.disengagePlayer,
        removeFromEntityGrid: host.removeFromEntityGrid,
        removeFromPathingGrid: host.removeFromPathingGrid,
        playKillSoundIfVisible: host.playKillSoundIfVisible,
        updateCursor: host.updateCursor,
        resolveTarget: host.resolveTarget,
        createAttackLink: host.createAttackLink,
    };

    host.client.on(
        'spawnCharacter',
        function (
            entity: unknown,
            x: number,
            y: number,
            orientation: number | undefined,
            targetId: string | number | undefined
        ) {
            const spawnEntity = entity as TEntity;

            handleSpawnCharacterEntry({
                entity: spawnEntity,
                playerId: host.playerId,
                entityExists: host.entityExists,
                handleSpawn() {
                    applySpawnedCharacterBootstrapFromHost({
                        entity: spawnEntity,
                        x,
                        y,
                        orientation,
                        getSprite: host.getSprite,
                        addEntity(spawnedEntity) {
                            host.addEntity(spawnedEntity as TEntity);
                        },
                        describeKind: host.describeKind,
                        logDebug: host.logDebug,
                    });

                    installSpawnedCharacterOrchestration({
                        entity,
                        targetId,
                        playerId: host.playerId,
                        ...directHost,
                        assignBubbleTo(character) {
                            host.assignBubbleTo(character);
                        },
                    });
                },
                logDuplicate(duplicateEntity) {
                    host.logDebug("Character " + duplicateEntity.id + " already exists. Don't respawn.");
                },
                logError: host.logError,
            });
        }
    );
}
