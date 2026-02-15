import type { EntityId } from '../../../shared/domain/ids';
import { debugDoors } from '../../debug-flags';

type DoorDestination = Readonly<{
    x: number;
    y: number;
    orientation: number;
    cameraX?: number;
    cameraY?: number;
    portal: boolean;
}>;

type DoorTraversalAttacker = Readonly<{
    disengage(): void;
    idle(): void;
}>;

type DoorTraversalPlayer = {
    gridX: number;
    gridY: number;
    nextGridX: number;
    nextGridY: number;
    isDead: boolean;
    isMoving(): boolean;
    hasTarget(): boolean;
    setGridPosition(x: number, y: number): void;
    turnTo(orientation: number): void;
    forEachAttacker(callback: (attacker: DoorTraversalAttacker) => void): void;
};

export type ClientDoorPortalSystemHost = Readonly<{
    started: boolean;
    playerId: EntityId | null;
    player: DoorTraversalPlayer | null;
    client: { sendTeleport(x: number, y: number): void } | null;
    map: {
        isDoor(x: number, y: number): boolean;
        getDoorDestination(x: number, y: number): DoorDestination | undefined;
    } | null;
    renderer: {
        mobile: boolean;
        tablet: boolean;
        context: unknown;
        clearScreen(context: unknown): void;
    } | null;
    camera: {
        setGridPosition(x: number, y: number): void;
        focusEntity(entity: DoorTraversalPlayer): void;
    };
    kernel: {
        clientDoorTraversalArmed: boolean;
        clientPendingDoorTraversal:
            | null
            | Readonly<{
                  doorX: number;
                  doorY: number;
                  toX: number;
                  toY: number;
                  orientation: number;
                  portal: boolean;
                  cameraX?: number;
                  cameraY?: number;
                  requestedAtMs: number;
              }>;
        setClientPendingDoorTraversal(pending: {
            doorX: number;
            doorY: number;
            toX: number;
            toY: number;
            orientation: number;
            portal: boolean;
            cameraX?: number;
            cameraY?: number;
        }): void;
        clearClientPendingDoorTraversal(): void;
    };
    assignBubbleTo(character: DoorTraversalPlayer): void;
    resetZone(): void;
    checkUndergroundAchievement(): void;
    tryUnlockingAchievement(key: string): void;
    audioManager: {
        playSound(key: string): void;
        updateMusic(): void;
    } | null;
}>;

export function runClientDoorPortalSystem(host: ClientDoorPortalSystemHost): void {
    if (!host.started || !host.playerId || !host.player || !host.map) {
        return;
    }

    const PENDING_TTL_MS = 10_000;
    const nowMs = Date.now();

    const pending = host.kernel.clientPendingDoorTraversal;
    if (pending) {
        if (nowMs - pending.requestedAtMs > PENDING_TTL_MS) {
            debugDoors('pending:expired', pending);
            host.kernel.clearClientPendingDoorTraversal();
        } else if (host.player.gridX === pending.toX && host.player.gridY === pending.toY) {
            debugDoors('pending:complete', pending);
            // Door traversal completion is driven by server-issued TELEPORT; apply client-side camera/audio/UX once.
            host.player.turnTo(pending.orientation);

            if (host.renderer?.mobile && typeof pending.cameraX === 'number' && typeof pending.cameraY === 'number') {
                host.camera.setGridPosition(pending.cameraX, pending.cameraY);
                host.resetZone();
            } else if (pending.portal) {
                host.assignBubbleTo(host.player);
            } else {
                host.camera.focusEntity(host.player);
                host.resetZone();
            }

            let attackers = 0;
            host.player.forEachAttacker((attacker) => {
                attackers += 1;
                attacker.disengage();
                attacker.idle();
            });

            if (attackers > 0) {
                setTimeout(() => host.tryUnlockingAchievement('COWARD'), 500);
            }

            host.checkUndergroundAchievement();

            if (host.renderer && (host.renderer.mobile || host.renderer.tablet)) {
                host.renderer.clearScreen(host.renderer.context);
            }

            if (pending.portal) {
                host.audioManager?.playSound('teleport');
            }

            host.audioManager?.updateMusic();
            host.kernel.clearClientPendingDoorTraversal();
        }
    }

    if (host.player.isDead || host.player.hasTarget()) {
        host.kernel.clientDoorTraversalArmed = false;
        return;
    }

    const doorX = host.player.gridX;
    const doorY = host.player.gridY;
    if (!host.map.isDoor(doorX, doorY)) {
        host.kernel.clientDoorTraversalArmed = false;
        return;
    }

    if (!host.kernel.clientDoorTraversalArmed) {
        return;
    }
    host.kernel.clientDoorTraversalArmed = false;

    // When the player is already standing on a door tile, request traversal and wait for the server TELEPORT.
    const destination = host.map.getDoorDestination(doorX, doorY);
    if (destination) {
        debugDoors('request', { door: { x: doorX, y: doorY }, to: { x: destination.x, y: destination.y }, destination });
        host.kernel.setClientPendingDoorTraversal({
            doorX,
            doorY,
            toX: destination.x,
            toY: destination.y,
            orientation: destination.orientation,
            portal: destination.portal,
            cameraX: destination.cameraX,
            cameraY: destination.cameraY,
        });
        host.client?.sendTeleport(destination.x, destination.y);
    } else {
        debugDoors('request:none', { door: { x: doorX, y: doorY } });
    }
}
