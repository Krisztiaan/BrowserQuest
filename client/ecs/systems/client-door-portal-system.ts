import { gridPos } from '../../../shared/domain/positions';
import type { EntityId } from '../../../shared/domain/ids';

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
        clientLastSentMovePos: { x: number; y: number } | null;
        clientReplicationLastPos: Map<EntityId, { x: number; y: number }>;
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

    if (host.player.isMoving()) {
        host.kernel.clientDoorTraversalArmed = true;
        return;
    }

    if (!host.kernel.clientDoorTraversalArmed) {
        return;
    }
    host.kernel.clientDoorTraversalArmed = false;

    if (host.player.isDead || host.player.hasTarget()) {
        return;
    }

    const fromX = host.player.gridX;
    const fromY = host.player.gridY;
    if (!host.map.isDoor(fromX, fromY)) {
        return;
    }

    const destination = host.map.getDoorDestination(fromX, fromY);
    if (!destination) {
        return;
    }

    host.player.setGridPosition(destination.x, destination.y);
    host.player.nextGridX = destination.x;
    host.player.nextGridY = destination.y;
    host.player.turnTo(destination.orientation);

    host.client?.sendTeleport(destination.x, destination.y);

    const destinationPos = gridPos(destination.x, destination.y);
    host.kernel.clientLastSentMovePos = destinationPos;
    host.kernel.clientReplicationLastPos.set(host.playerId, destinationPos);

    if (host.renderer?.mobile && destination.cameraX && destination.cameraY) {
        host.camera.setGridPosition(destination.cameraX, destination.cameraY);
        host.resetZone();
    } else if (destination.portal) {
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

    if (destination.portal) {
        host.audioManager?.playSound('teleport');
    }

    if (!host.player.isDead) {
        host.audioManager?.updateMusic();
    }
}
