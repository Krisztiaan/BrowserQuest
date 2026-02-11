import Character from '../../../character';
import Mob from '../../../mob';
import Player from '../../../player';
import { installSpawnedCharacterBubbleHandler } from './bubble';
import { installSpawnedCharacterDeathHandler } from './death';
import { installSpawnedMobTargetLink } from './mob-target-link';
import { installSpawnedCharacterMotionHandlers } from './motion';
import { orchestrateSpawnedCharacter } from './orchestration';
import { installSpawnedCharacterPathRequestHandler } from './path-request';
import { installSpawnedCharacterStopPathingHandler } from './stop-pathing';

type GridDestination = {
    x: number;
    y: number;
};

type BubbleAnchor = {
    id: string | number;
    x: number;
    y: number;
};

type SpawnCharacterOrchestrationBuilderHost = {
    entity: unknown;
    targetId: string | number | null | undefined;
    playerId: string | number | null;
    unregisterEntityPosition(character: Character): void;
    registerEntityDualPosition(character: Character): void;
    registerEntityPosition(character: Character): void;
    isDoor(gridX: number, gridY: number): boolean;
    getDoorDestination(gridX: number, gridY: number): GridDestination;
    findPath(character: Character, x: number, y: number, ignored: Character[]): unknown;
    logInfo(message: string): void;
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
    assignBubbleTo(character: BubbleAnchor): void;
    resolveTarget(targetId: string | number): Character | null;
    createAttackLink(attacker: Character, target: Character): void;
};

export function installSpawnedCharacterOrchestration(host: SpawnCharacterOrchestrationBuilderHost): void {
    orchestrateSpawnedCharacter({
        entity: host.entity,
        installMotion(character) {
            installSpawnedCharacterMotionHandlers({
                character,
                handleBeforeStep(activeCharacter) {
                    host.unregisterEntityPosition(activeCharacter);
                },
                handleActiveStep(activeCharacter) {
                    host.registerEntityDualPosition(activeCharacter);

                    character.forEachAttacker(function (attacker: Character): void {
                        if (attacker.isAdjacent(attacker.target)) {
                            attacker.lookAtTarget();
                        } else {
                            attacker.follow(character);
                        }
                    });
                },
            });
        },
        installStopPathing(character) {
            installSpawnedCharacterStopPathingHandler({
                character,
                isDying() {
                    return character.isDying;
                },
                maybeLookAtTarget() {
                    if (character.hasTarget() && character.isAdjacent(character.target)) {
                        character.lookAtTarget();
                    }
                },
                maybeHandleDoorDestination() {
                    if (character instanceof Player) {
                        const gridX = character.destination.gridX;
                        const gridY = character.destination.gridY;

                        if (host.isDoor(gridX, gridY)) {
                            const destination = host.getDoorDestination(gridX, gridY);
                            character.setGridPosition(destination.x, destination.y);
                        }
                    }
                },
                updateAttackers() {
                    character.forEachAttacker(function (attacker: Character): void {
                        if (!attacker.isAdjacentNonDiagonal(character) && attacker.id !== host.playerId) {
                            attacker.follow(character);
                        }
                    });
                },
                reregisterPosition() {
                    host.unregisterEntityPosition(character);
                    host.registerEntityPosition(character);
                },
            });
        },
        installPathRequest(character) {
            installSpawnedCharacterPathRequestHandler({
                character,
                findPath(_character, x, y, ignored) {
                    const ignoredCharacters = ignored.filter(
                        (value): value is Character => value instanceof Character
                    );
                    return host.findPath(character, x, y, ignoredCharacters);
                },
            });
        },
        installDeath(character) {
            installSpawnedCharacterDeathHandler({
                character,
                onCharacterDeathStart(deathCharacter) {
                    host.logInfo(deathCharacter.id + ' is dead');

                    if (deathCharacter instanceof Mob) {
                        host.recordMobDeathPosition(deathCharacter.id, deathCharacter.gridX, deathCharacter.gridY);
                    }
                },
                getDeathSprite(deathCharacter) {
                    return host.getDeathSprite(deathCharacter);
                },
                onCharacterRemoved(removedCharacter) {
                    host.logInfo(removedCharacter.id + ' was removed');

                    host.removeEntity(removedCharacter);
                    host.removeFromRenderingGrid(removedCharacter, removedCharacter.gridX, removedCharacter.gridY);
                },
                disengagePlayerIfTarget(deathCharacter) {
                    if (host.isPlayerTarget(deathCharacter)) {
                        host.disengagePlayer();
                    }
                },
                removeCharacterFromInteractionGrids(deathCharacter) {
                    host.removeFromEntityGrid(deathCharacter, deathCharacter.gridX, deathCharacter.gridY);
                    host.removeFromPathingGrid(deathCharacter.gridX, deathCharacter.gridY);
                },
                playKillSoundIfVisible(deathCharacter) {
                    host.playKillSoundIfVisible(deathCharacter);
                },
                updateCursor() {
                    host.updateCursor();
                },
            });
        },
        installBubble(character) {
            installSpawnedCharacterBubbleHandler({
                character,
                assignBubbleTo(activeCharacter) {
                    host.assignBubbleTo(activeCharacter);
                },
            });
        },
        installMobTargetLink(character) {
            installSpawnedMobTargetLink({
                mob: character instanceof Mob ? character : null,
                targetId: host.targetId,
                resolveTarget(candidateTargetId) {
                    return host.resolveTarget(candidateTargetId);
                },
                createAttackLink(attacker, target) {
                    host.createAttackLink(attacker, target);
                },
            });
        },
    });
}
