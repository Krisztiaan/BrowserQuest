import type { EntityId } from '../../../shared/domain/ids';
import type { ClientWorldKernel } from '../world-kernel';
import type { AudioSoundKey } from '../../asset-key-domain';
import Character from '../../character';
import Player from '../../player';
import { clearClientInteractionIntentWithSideEffects } from './client-interaction-intent-system';

export type ClientCombatSystemHost = Readonly<{
    started: boolean;
    currentTime: number;
    playerId: EntityId | null;
    player: Player | null;
    entities: Record<string, Character | Player | object | null | undefined>;
    map: { isColliding(x: number, y: number): boolean } | null;
    camera: { isVisible(entity: Character | Player | object): boolean } | null;
    kernel: ClientWorldKernel;
}>;

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
        const target = player.target;
        const targetId = typeof target.id === 'number' ? target.id : null;
        const known = targetId !== null ? Boolean(host.entities[String(targetId)]) : false;
        if ((target instanceof Character && target.isDead) || !known) {
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

        if (!entity.isAttacking() || entity.previousTarget) {
            continue;
        }

        if (entity.canAttack(time)) {
            if (!entity.isMoving()) {
                if (entity.hasTarget() && entity.target && entity.getOrientationTo(entity.target) !== entity.orientation) {
                    host.kernel.enqueueClientCommand({ type: 'characterLookAtTarget', entityId: entity.id as EntityId });
                }

                host.kernel.enqueueClientCommand({ type: 'characterHit', entityId: entity.id as EntityId });

                if (entity instanceof Player && host.camera?.isVisible(entity)) {
                    host.kernel.enqueueClientCommand({
                        type: 'audioPlaySound',
                        key: chooseHitSoundKey(time, host.playerId),
                    });
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
                    // Only the local player should ever follow targets. Movement is server-authoritative, so this is
                    // expressed as a server step plan, not immediate client-side pathing.
                    if (entity.id === host.playerId) {
                        const targetId = entity.target.id;
                        if (typeof targetId === 'number') {
                            host.kernel.enqueueClientCommand({
                                type: 'playerFollow',
                                targetId: targetId as EntityId,
                            });
                        }
                    }
                }
            }
        }
}
