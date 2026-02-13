import { expect, test } from 'bun:test';
import { entityIdFromWire } from '../../../shared/domain/ids';
import {
    runClientDoorPortalSystem,
    type ClientDoorPortalSystemHost,
} from '../../../client/ecs/systems/client-door-portal-system';

type FakePlayer = {
    gridX: number;
    gridY: number;
    nextGridX: number;
    nextGridY: number;
    isDead: boolean;
    moving: boolean;
    targeting: boolean;
    turnedTo: number | null;
    disengagedAttackers: number;
    idledAttackers: number;
    isMoving(): boolean;
    hasTarget(): boolean;
    setGridPosition(x: number, y: number): void;
    turnTo(orientation: number): void;
    forEachAttacker(callback: (attacker: { disengage(): void; idle(): void }) => void): void;
};

function createPlayer(x: number, y: number): FakePlayer {
    return {
        gridX: x,
        gridY: y,
        nextGridX: x,
        nextGridY: y,
        isDead: false,
        moving: false,
        targeting: false,
        turnedTo: null,
        disengagedAttackers: 0,
        idledAttackers: 0,
        isMoving() {
            return this.moving;
        },
        hasTarget() {
            return this.targeting;
        },
        setGridPosition(nextX: number, nextY: number) {
            this.gridX = nextX;
            this.gridY = nextY;
        },
        turnTo(orientation: number) {
            this.turnedTo = orientation;
        },
        forEachAttacker(callback) {
            const self = this;
            callback({
                disengage() {
                    self.disengagedAttackers += 1;
                },
                idle() {
                    self.idledAttackers += 1;
                },
            });
        },
    };
}

test('door traversal triggers once when movement stops on a door tile', () => {
    const playerId = entityIdFromWire(7001);
    const player = createPlayer(3, 4);
    player.moving = true;

    const teleports: Array<[number, number]> = [];
    let bubbleAssignments = 0;
    let focused = 0;
    let resetZoneCalls = 0;
    let updateMusicCalls = 0;
    let teleportSoundCalls = 0;
    let undergroundChecks = 0;

    const host: ClientDoorPortalSystemHost = {
        started: true,
        playerId,
        player,
        client: {
            sendTeleport(x, y) {
                teleports.push([x, y]);
            },
        },
        map: {
            isDoor(x, y) {
                return (x === 3 && y === 4) || (x === 15 && y === 22);
            },
            getDoorDestination(x, y) {
                if (x === 3 && y === 4) {
                    return { x: 15, y: 22, orientation: 2, portal: true };
                }
                return { x: 1, y: 1, orientation: 1, portal: true };
            },
        },
        renderer: {
            mobile: false,
            tablet: false,
            context: null,
            clearScreen() {},
        },
        camera: {
            setGridPosition() {},
            focusEntity() {
                focused += 1;
            },
        },
        kernel: {
            clientDoorTraversalArmed: false,
            clientLastSentMovePos: null,
            clientReplicationLastPos: new Map(),
        },
        assignBubbleTo() {
            bubbleAssignments += 1;
        },
        resetZone() {
            resetZoneCalls += 1;
        },
        checkUndergroundAchievement() {
            undergroundChecks += 1;
        },
        tryUnlockingAchievement() {},
        audioManager: {
            playSound(key) {
                if (key === 'teleport') {
                    teleportSoundCalls += 1;
                }
            },
            updateMusic() {
                updateMusicCalls += 1;
            },
        },
    };

    runClientDoorPortalSystem(host);
    expect(host.kernel.clientDoorTraversalArmed).toBe(true);
    expect(teleports).toEqual([]);

    player.moving = false;
    runClientDoorPortalSystem(host);

    expect(teleports).toEqual([[15, 22]]);
    expect(player.gridX).toBe(15);
    expect(player.gridY).toBe(22);
    expect(player.nextGridX).toBe(15);
    expect(player.nextGridY).toBe(22);
    expect(player.turnedTo).toBe(2);
    expect(host.kernel.clientLastSentMovePos).toEqual({ x: 15, y: 22 });
    expect(host.kernel.clientReplicationLastPos.get(playerId)).toEqual({ x: 15, y: 22 });
    expect(bubbleAssignments).toBe(1);
    expect(focused).toBe(0);
    expect(resetZoneCalls).toBe(0);
    expect(updateMusicCalls).toBe(1);
    expect(teleportSoundCalls).toBe(1);
    expect(undergroundChecks).toBe(1);
    expect(player.disengagedAttackers).toBe(1);
    expect(player.idledAttackers).toBe(1);

    runClientDoorPortalSystem(host);
    expect(teleports).toEqual([[15, 22]]);
});

test('mobile traversal uses destination camera coordinates and clears screen', () => {
    const playerId = entityIdFromWire(7002);
    const player = createPlayer(8, 9);
    player.moving = false;

    let cameraSet = 0;
    let cameraFocused = 0;
    let zoneReset = 0;
    let bubbleAssignments = 0;
    let screenClears = 0;

    const host: ClientDoorPortalSystemHost = {
        started: true,
        playerId,
        player,
        client: {
            sendTeleport() {},
        },
        map: {
            isDoor() {
                return true;
            },
            getDoorDestination() {
                return { x: 20, y: 30, orientation: 3, portal: true, cameraX: 11, cameraY: 12 };
            },
        },
        renderer: {
            mobile: true,
            tablet: false,
            context: {},
            clearScreen() {
                screenClears += 1;
            },
        },
        camera: {
            setGridPosition() {
                cameraSet += 1;
            },
            focusEntity() {
                cameraFocused += 1;
            },
        },
        kernel: {
            clientDoorTraversalArmed: true,
            clientLastSentMovePos: null,
            clientReplicationLastPos: new Map(),
        },
        assignBubbleTo() {
            bubbleAssignments += 1;
        },
        resetZone() {
            zoneReset += 1;
        },
        checkUndergroundAchievement() {},
        tryUnlockingAchievement() {},
        audioManager: {
            playSound() {},
            updateMusic() {},
        },
    };

    runClientDoorPortalSystem(host);

    expect(cameraSet).toBe(1);
    expect(zoneReset).toBe(1);
    expect(cameraFocused).toBe(0);
    expect(bubbleAssignments).toBe(0);
    expect(screenClears).toBe(1);
});
