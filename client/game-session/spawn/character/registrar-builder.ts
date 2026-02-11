import Character from '../../../character';
import Mobs from '../../../mobs';
import log from '../../../compat/log';
import Types from '../../../../shared/gametypes-browser';
import type { AudioSoundKey } from '../../../asset-key-domain';
import type { EntityKind } from '../../../../shared/entity-kind-domain';
import type { GameClientEventSource } from '../../../gameclient';
import { registerSpawnCharacterHandler } from './registrar';

type EntityId = string | number;
type GridPosition = { x: number; y: number };

type SpawnEntity = {
    kind: EntityKind;
    id: EntityId;
    gridX: number;
    gridY: number;
    getSpriteName(): string;
    setSprite(sprite: unknown): void;
    setGridPosition(x: number, y: number): void;
    setOrientation(orientation: number): void;
    idle(): void;
};

type SpawnCharacterBuilderGame = {
    client: {
        on: GameClientEventSource['on'];
    } | null;
    playerId: EntityId | null;
    sprites: Record<string, unknown>;
    player: {
        target?: { id: EntityId } | null;
        disengage(): void;
    };
    camera: {
        isVisible(character: Character): boolean;
    };
    audioManager: {
        playSound(sound: AudioSoundKey): void;
    };
    map: {
        isDoor(gridX: number, gridY: number): boolean;
        getDoorDestination(gridX: number, gridY: number): GridPosition;
    };
    deathpositions: Record<string, GridPosition>;
    entityIdExists(entityId: EntityId): boolean;
    unregisterEntityPosition(character: Character): void;
    registerEntityDualPosition(character: Character): void;
    registerEntityPosition(character: Character): void;
    findPath(character: Character, x: number, y: number, ignored: Character[]): unknown;
    removeFromRenderingGrid(character: Character, x: number, y: number): void;
    removeFromEntityGrid(character: Character, x: number, y: number): void;
    removeFromPathingGrid(x: number, y: number): void;
    updateCursor(): void;
    getEntityById(entityId: EntityId): unknown | null;
    createAttackLink(attacker: Character, target: Character): void;
    removeEntity(character: Character): void;
};

type SpawnCharacterBuilderHost = {
    game: SpawnCharacterBuilderGame;
    addEntity(entity: SpawnEntity): void;
    assignBubbleTo(entity: unknown | null): void;
};

export function installSpawnCharacterHandlerFromGame(host: SpawnCharacterBuilderHost): void {
    const game = host.game;
    if (!game.client) {
        return;
    }

    registerSpawnCharacterHandler({
        client: game.client,
        playerId: game.playerId,
        entityExists(entityId) {
            return game.entityIdExists(entityId);
        },
        getSprite(spriteName) {
            return game.sprites[spriteName];
        },
        addEntity(entity) {
            host.addEntity(entity);
        },
        describeKind(kind) {
            return Types.getKindAsString(kind) ?? 'unknown';
        },
        logDebug(message) {
            log.debug(message);
        },
        logInfo(message) {
            log.info(message);
        },
        logError(error) {
            log.error(error);
        },
        unregisterEntityPosition(character) {
            game.unregisterEntityPosition(character);
        },
        registerEntityDualPosition(character) {
            game.registerEntityDualPosition(character);
        },
        registerEntityPosition(character) {
            game.registerEntityPosition(character);
        },
        isDoor(gridX, gridY) {
            return game.map.isDoor(gridX, gridY);
        },
        getDoorDestination(gridX, gridY) {
            return game.map.getDoorDestination(gridX, gridY);
        },
        findPath(character, pathX, pathY, ignored) {
            return game.findPath(character, pathX, pathY, ignored);
        },
        recordMobDeathPosition(characterId, deathX, deathY) {
            game.deathpositions[characterId] = { x: deathX, y: deathY };
        },
        getDeathSprite(character) {
            return game.sprites[character instanceof Mobs.Rat ? 'rat' : 'death'];
        },
        removeEntity(character) {
            game.removeEntity(character);
        },
        removeFromRenderingGrid(character, gridX, gridY) {
            game.removeFromRenderingGrid(character, gridX, gridY);
        },
        isPlayerTarget(character) {
            return Boolean(game.player.target && game.player.target.id === character.id);
        },
        disengagePlayer() {
            game.player.disengage();
        },
        removeFromEntityGrid(character, gridX, gridY) {
            game.removeFromEntityGrid(character, gridX, gridY);
        },
        removeFromPathingGrid(gridX, gridY) {
            game.removeFromPathingGrid(gridX, gridY);
        },
        playKillSoundIfVisible(character) {
            if (!game.camera.isVisible(character)) {
                return;
            }

            const killSound: AudioSoundKey = Math.floor(Math.random() * 2 + 1) === 1 ? 'kill1' : 'kill2';
            game.audioManager.playSound(killSound);
        },
        updateCursor() {
            game.updateCursor();
        },
        assignBubbleTo(character) {
            host.assignBubbleTo(character);
        },
        resolveTarget(candidateTargetId) {
            const player = game.getEntityById(candidateTargetId);
            return player instanceof Character ? player : null;
        },
        createAttackLink(attacker, target) {
            game.createAttackLink(attacker, target);
        },
    });
}
