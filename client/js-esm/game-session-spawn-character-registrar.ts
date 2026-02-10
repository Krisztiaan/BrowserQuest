import type { EntityKind } from './compat/gametypes';
import Character from './character';
import type { GameClientEventSource } from './gameclient';
import { handleSpawnCharacterEntry } from './game-session-spawn-character-entry';
import { applySpawnedCharacterBootstrapFromHost } from './game-session-spawn-character-bootstrap-builder';
import { installSpawnedCharacterOrchestration } from './game-session-spawn-character-orchestration-builder';

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
    host.client.on('spawnCharacter', function (entity, x, y, orientation, targetId) {
        const spawnEntity = entity as TEntity;

        handleSpawnCharacterEntry({
            entity: spawnEntity,
            playerId: host.playerId,
            entityExists(entityId) {
                return host.entityExists(entityId);
            },
            handleSpawn() {
                applySpawnedCharacterBootstrapFromHost({
                    entity: spawnEntity,
                    x,
                    y,
                    orientation,
                    getSprite(spriteName) {
                        return host.getSprite(spriteName);
                    },
                    addEntity(spawnedEntity) {
                        host.addEntity(spawnedEntity as TEntity);
                    },
                    describeKind(kind) {
                        return host.describeKind(kind);
                    },
                    logDebug(message) {
                        host.logDebug(message);
                    },
                });

                installSpawnedCharacterOrchestration({
                    entity,
                    targetId,
                    playerId: host.playerId,
                    unregisterEntityPosition(character) {
                        host.unregisterEntityPosition(character);
                    },
                    registerEntityDualPosition(character) {
                        host.registerEntityDualPosition(character);
                    },
                    registerEntityPosition(character) {
                        host.registerEntityPosition(character);
                    },
                    isDoor(gridX, gridY) {
                        return host.isDoor(gridX, gridY);
                    },
                    getDoorDestination(gridX, gridY) {
                        return host.getDoorDestination(gridX, gridY);
                    },
                    findPath(character, pathX, pathY, ignored) {
                        return host.findPath(character, pathX, pathY, ignored);
                    },
                    logInfo(message) {
                        host.logInfo(message);
                    },
                    recordMobDeathPosition(characterId, deathX, deathY) {
                        host.recordMobDeathPosition(characterId, deathX, deathY);
                    },
                    getDeathSprite(character) {
                        return host.getDeathSprite(character);
                    },
                    removeEntity(character) {
                        host.removeEntity(character);
                    },
                    removeFromRenderingGrid(character, gridX, gridY) {
                        host.removeFromRenderingGrid(character, gridX, gridY);
                    },
                    isPlayerTarget(character) {
                        return host.isPlayerTarget(character);
                    },
                    disengagePlayer() {
                        host.disengagePlayer();
                    },
                    removeFromEntityGrid(character, gridX, gridY) {
                        host.removeFromEntityGrid(character, gridX, gridY);
                    },
                    removeFromPathingGrid(gridX, gridY) {
                        host.removeFromPathingGrid(gridX, gridY);
                    },
                    playKillSoundIfVisible(character) {
                        host.playKillSoundIfVisible(character);
                    },
                    updateCursor() {
                        host.updateCursor();
                    },
                    assignBubbleTo(character) {
                        host.assignBubbleTo(character);
                    },
                    resolveTarget(candidateTargetId) {
                        return host.resolveTarget(candidateTargetId);
                    },
                    createAttackLink(attacker, target) {
                        host.createAttackLink(attacker, target);
                    },
                });
            },
            logDuplicate(duplicateEntity) {
                host.logDebug("Character " + duplicateEntity.id + " already exists. Don't respawn.");
            },
            logError(error) {
                host.logError(error);
            },
        });
    });
}
