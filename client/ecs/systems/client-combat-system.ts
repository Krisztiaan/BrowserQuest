import Types from '../../../shared/gametypes-browser';
import type { EntityId } from '../../../shared/domain/ids';
import type { ClientWorldKernel } from '../world-kernel';
import type { AudioSoundKey } from '../../asset-key-domain';
import Character from '../../character';
import Mob from '../../mob';
import Player from '../../player';
import { clearClientInteractionIntentWithSideEffects } from './client-interaction-intent-system';

type GridIndexedEntity = {
    id: EntityId;
    gridX: number;
    gridY: number;
};

export type ClientCombatSystemHost = Readonly<{
    started: boolean;
    currentTime: number;
    playerId: EntityId | null;
    player: Player | null;
    entities: Record<string, unknown>;
    map: { isColliding(x: number, y: number): boolean } | null;
    camera: { isVisible(entity: unknown): boolean } | null;
    kernel: ClientWorldKernel;
}>;

type AdjacentPosition = { x: number; y: number; o: number };

function getPositionAheadOfTarget(target: Player): AdjacentPosition | null {
    switch (target.orientation) {
        case Types.Orientations.UP:
            return { x: target.gridX, y: target.gridY - 1, o: target.orientation };
        case Types.Orientations.DOWN:
            return { x: target.gridX, y: target.gridY + 1, o: target.orientation };
        case Types.Orientations.LEFT:
            return { x: target.gridX - 1, y: target.gridY, o: target.orientation };
        case Types.Orientations.RIGHT:
            return { x: target.gridX + 1, y: target.gridY, o: target.orientation };
        default:
            return null;
    }
}

function hasMobAt(host: ClientCombatSystemHost, x: number, y: number, excludeId?: EntityId): boolean {
    const ids = host.kernel.getClientEntityIdsAt(x, y);
    for (const id of ids) {
        const entity = host.entities[String(id)];
        if (!(entity instanceof Mob)) {
            continue;
        }
        if (excludeId !== undefined && entity.id === excludeId) {
            continue;
        }
        return true;
    }
    return false;
}

function hasMobOnTile(host: ClientCombatSystemHost, mob: GridIndexedEntity, x?: number, y?: number): boolean {
    const tileX = x ?? mob.gridX;
    const tileY = y ?? mob.gridY;
    return hasMobAt(host, tileX, tileY, mob.id);
}

function findFreeAdjacentNonDiagonalPosition(host: ClientCombatSystemHost, entity: Character): AdjacentPosition | null {
    let result: AdjacentPosition | null = null;

    entity.forEachAdjacentNonDiagonalPosition(function (x: number, y: number, orientation: number) {
        if (result) {
            return;
        }
        if (host.map?.isColliding(x, y)) {
            return;
        }
        if (hasMobAt(host, x, y)) {
            return;
        }
        result = { x, y, o: orientation };
    });

    return result;
}

function chooseHitSoundKey(timeMs: number, playerId: EntityId): AudioSoundKey {
    const bucket = Math.floor(timeMs / 400);
    return (bucket + playerId) % 2 === 0 ? 'hit1' : 'hit2';
}

export function runClientCombatSystem(host: ClientCombatSystemHost): void {
    if (!host.started || !host.playerId || !host.player) {
        return;
    }

    const time = host.currentTime;
    const player = host.player;

    // Ensure the player stops attacking immediately when their target is dead or has despawned.
    if (player.isAttacking() && player.target) {
        const t = player.target as unknown;
        const targetId = (t as { id?: unknown }).id;
        const known =
            typeof targetId === 'number' ? Boolean(host.entities[String(targetId)]) : false;
        if ((t instanceof Character && t.isDead) || !known) {
            host.kernel.enqueueClientCommand({ type: 'stopPlayerCombat' });
            clearClientInteractionIntentWithSideEffects(host);
            return;
        }
    }

    for (const entity of Object.values(host.entities)) {
        if (!(entity instanceof Character)) {
            continue;
        }
        if (typeof entity.id !== 'number') {
            continue;
        }

        // If mob has finished moving to a different tile in order to avoid stacking, attack again from the new position.
        if (entity.previousTarget && !entity.isMoving() && entity instanceof Mob) {
            host.kernel.enqueueClientCommand({ type: 'combatRelinkPreviousTarget', attackerId: entity.id as EntityId });
        }

        if (!entity.isAttacking() || entity.previousTarget) {
            continue;
        }

        let repositioned = false;
        if (entity.target instanceof Player) {
            const target = entity.target;

            if (!target.isMoving() && entity.getDistanceToEntity(target) === 0) {
                const ahead = getPositionAheadOfTarget(target);
                if (ahead) {
                    host.kernel.enqueueClientCommand({
                        type: 'combatRepositionAttacker',
                        attackerId: entity.id as EntityId,
                        targetId: target.id as EntityId,
                        x: ahead.x,
                        y: ahead.y,
                        orientation: ahead.o,
                    });
                    repositioned = true;
                }
            } else if (
                !target.isMoving() &&
                entity.isAdjacentNonDiagonal(target) &&
                hasMobOnTile(host, entity as unknown as GridIndexedEntity)
            ) {
                const adjacent = findFreeAdjacentNonDiagonalPosition(host, target);
                if (
                    adjacent &&
                    !target.adjacentTiles[String(adjacent.o)] &&
                    (!player.target || (player.target as unknown as { id?: unknown }).id !== entity.id)
                ) {
                    host.kernel.enqueueClientCommand({
                        type: 'combatRepositionAttacker',
                        attackerId: entity.id as EntityId,
                        targetId: target.id as EntityId,
                        x: adjacent.x,
                        y: adjacent.y,
                        orientation: adjacent.o,
                    });
                    repositioned = true;
                }
            }
        }

        if (entity.canAttack(time)) {
            if (!repositioned && !entity.isMoving()) {
                if (entity.hasTarget() && entity.target && entity.getOrientationTo(entity.target) !== entity.orientation) {
                    host.kernel.enqueueClientCommand({ type: 'characterLookAtTarget', entityId: entity.id as EntityId });
                }

                host.kernel.enqueueClientCommand({ type: 'characterHit', entityId: entity.id as EntityId });

                if (entity.id === host.playerId && entity.target && typeof entity.target.id === 'number') {
                    host.kernel.enqueueClientCommand({ type: 'clientSendHit', targetId: entity.target.id as EntityId });
                }

                if (entity instanceof Player && host.camera?.isVisible(entity)) {
                    host.kernel.enqueueClientCommand({
                        type: 'audioPlaySound',
                        key: chooseHitSoundKey(time, host.playerId),
                    });
                }

                if (entity.hasTarget() && entity.target && entity.target.id === host.playerId && !player.invincible) {
                    host.kernel.enqueueClientCommand({ type: 'clientSendHurt', mobId: entity.id as EntityId });
                }
            }
        } else {
            if (
                entity.hasTarget() &&
                entity.target &&
                entity.isDiagonallyAdjacent(entity.target) &&
                entity.target instanceof Player &&
                !entity.target.isMoving()
            ) {
                const targetId = entity.target.id;
                if (typeof targetId === 'number') {
                    host.kernel.enqueueClientCommand({
                        type: 'characterFollow',
                        entityId: entity.id as EntityId,
                        targetId: targetId as EntityId,
                    });
                }
            }
        }
    }
}
