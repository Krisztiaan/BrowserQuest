import { expect, test } from 'bun:test';
import { entityIdFromWire } from '../../../shared/domain/ids';
import { runClientClickIntentSystem } from '../../../client/ecs/systems/client-click-intent-system';
import { runClientDoorPortalSystem } from '../../../client/ecs/systems/client-door-portal-system';
import { getZoneGroupIdFromGrid } from '../../../shared/world/coordinate-contract';

test('mobile door traversal uses cameraX/cameraY even when values are 0', () => {
    const calls: Array<{ x: number; y: number }> = [];
    const playerId = entityIdFromWire(9000);

    const host = {
        started: true,
        playerId,
        player: {
            gridX: 10,
            gridY: 10,
            nextGridX: 10,
            nextGridY: 10,
            isDead: false,
            isMoving() {
                return false;
            },
            hasTarget() {
                return false;
            },
            setGridPosition() {},
            turnTo() {},
            forEachAttacker() {},
        },
        client: { sendTeleport() {} },
        map: {
            isDoor() {
                return false;
            },
            getDoorDestination() {
                return { x: 10, y: 10, orientation: 0, cameraX: 0, cameraY: 0, portal: false };
            },
        },
        renderer: { mobile: true, tablet: false, context: null, clearScreen() {} },
        camera: {
            setGridPosition(x: number, y: number) {
                calls.push({ x, y });
            },
            focusEntity() {},
        },
        kernel: {
            clientPendingDoorTraversal: {
                doorX: 1,
                doorY: 1,
                toX: 10,
                toY: 10,
                orientation: 0,
                portal: false,
                cameraX: 0,
                cameraY: 0,
                requestedAtMs: Date.now(),
            },
            clientDoorTraversalContact: null,
            setClientPendingDoorTraversal() {},
            clearClientPendingDoorTraversal(this: { clientPendingDoorTraversal: null | { requestedAtMs: number } }) {
                this.clientPendingDoorTraversal = null;
            },
            setClientDoorTraversalContact(this: { clientDoorTraversalContact: { doorX: number; doorY: number; mapId: string | null } | null }, contact: { doorX: number; doorY: number; mapId: string | null }) {
                this.clientDoorTraversalContact = contact;
            },
            clearClientDoorTraversalContact(this: { clientDoorTraversalContact: { doorX: number; doorY: number; mapId: string | null } | null }) {
                this.clientDoorTraversalContact = null;
            },
        },
        assignBubbleTo() {},
        resetZone() {},
        checkUndergroundAchievement() {},
        tryUnlockingAchievement() {},
        audioManager: null,
    };

    runClientDoorPortalSystem(host as never);
    expect(calls).toEqual([{ x: 0, y: 0 }]);
});

test('zone-group derivation uses zero-based edges', () => {
    expect(getZoneGroupIdFromGrid(0, 0, 28, 12)).toBe('0-0');
    expect(getZoneGroupIdFromGrid(1, 1, 28, 12)).toBe('0-0');
    expect(getZoneGroupIdFromGrid(27, 11, 28, 12)).toBe('0-0');
    expect(getZoneGroupIdFromGrid(28, 12, 28, 12)).toBe('1-1');
    expect(getZoneGroupIdFromGrid(99, 99, 28, 12)).toBe('3-8');
});

test('clicking a door tile while already standing on it triggers traversal', () => {
    const playerId = entityIdFromWire(9001);
    const teleports: Array<{ x: number; y: number }> = [];
    let moved = false;

    const host = {
        started: true,
        playerId,
        player: {
            gridX: 3,
            gridY: 4,
            nextGridX: 3,
            nextGridY: 4,
            isDead: false,
            isOnPlateau: false,
            isMoving() {
                return false;
            },
            hasTarget() {
                return false;
            },
            setGridPosition(this: { gridX: number; gridY: number }, x: number, y: number) {
                moved = true;
                this.gridX = x;
                this.gridY = y;
            },
            turnTo() {},
            forEachAttacker() {},
        },
        client: {
            sendTeleport(x: number, y: number) {
                teleports.push({ x, y });
            },
        },
        map: {
            isColliding() {
                return false;
            },
            isPlateau() {
                return false;
            },
            isDoor(x: number, y: number) {
                return x === 3 && y === 4;
            },
            getDoorDestination() {
                return { x: 10, y: 11, orientation: 0, portal: false };
            },
        },
        isZoning() {
            return false;
        },
        isZoningTile() {
            return false;
        },
        renderer: { mobile: false, tablet: false, context: null, clearScreen() {} },
        camera: { setGridPosition() {}, focusEntity() {} },
        kernel: {
            clientPendingDoorTraversal: null,
            clientDoorTraversalContact: null,
            clientMoveInputKeysMask: 0,
            clientClickIntent: { x: 3, y: 4 },
            clearClientClickIntent(this: { clientClickIntent: { x: number; y: number } | null }) {
                this.clientClickIntent = null;
            },
            enqueueClientCommand() {},
            setClientInteractionIntent() {},
            clearClientLootAttempt() {},
            setClientPendingDoorTraversal(this: {
                clientPendingDoorTraversal:
                    | null
                    | {
                          doorX: number;
                          doorY: number;
                          toX: number;
                          toY: number;
                          orientation: number;
                          portal: boolean;
                          cameraX?: number;
                          cameraY?: number;
                          requestedAtMs: number;
                      };
            }, pending: {
                doorX: number;
                doorY: number;
                toX: number;
                toY: number;
                orientation: number;
                portal: boolean;
                cameraX?: number;
                cameraY?: number;
            }) {
                this.clientPendingDoorTraversal = { ...pending, requestedAtMs: Date.now() };
            },
            clearClientPendingDoorTraversal(this: {
                clientPendingDoorTraversal:
                    | null
                    | {
                          doorX: number;
                          doorY: number;
                          toX: number;
                          toY: number;
                          orientation: number;
                          portal: boolean;
                          cameraX?: number;
                          cameraY?: number;
                          requestedAtMs: number;
                      };
            }) {
                this.clientPendingDoorTraversal = null;
            },
            setClientDoorTraversalContact(this: { clientDoorTraversalContact: { doorX: number; doorY: number; mapId: string | null } | null }, contact: { doorX: number; doorY: number; mapId: string | null }) {
                this.clientDoorTraversalContact = contact;
            },
            clearClientDoorTraversalContact(this: { clientDoorTraversalContact: { doorX: number; doorY: number; mapId: string | null } | null }) {
                this.clientDoorTraversalContact = null;
            },
            drainClientCommands() {
                return [];
            },
        },
        assignBubbleTo() {},
        resetZone() {},
        checkUndergroundAchievement() {},
        tryUnlockingAchievement() {},
        audioManager: null,
    };

    runClientClickIntentSystem(host as never);
    runClientDoorPortalSystem(host as never);

    expect(teleports).toEqual([{ x: 10, y: 11 }]);
    expect(moved).toBe(false);
});

test('standing on a walkable door tile requests traversal without a separate arm state', () => {
    const playerId = entityIdFromWire(9002);
    const teleports: Array<{ x: number; y: number }> = [];

    const host = {
        started: true,
        playerId,
        player: {
            id: playerId,
            gridX: 8,
            gridY: 9,
            nextGridX: 8,
            nextGridY: 9,
            isDead: false,
            isMoving() {
                return false;
            },
            hasTarget() {
                return false;
            },
            setGridPosition() {},
            turnTo() {},
            forEachAttacker() {},
        },
        client: {
            sendTeleport(x: number, y: number) {
                teleports.push({ x, y });
            },
        },
        map: {
            isDoor(x: number, y: number) {
                return x === 8 && y === 9;
            },
            getDoorDestination() {
                return { x: 20, y: 21, orientation: 0, portal: false };
            },
        },
        renderer: { mobile: false, tablet: false, context: null, clearScreen() {} },
        camera: { setGridPosition() {}, focusEntity() {} },
        kernel: {
            clientPendingDoorTraversal: null,
            clientDoorTraversalContact: null,
            setClientPendingDoorTraversal(this: {
                clientPendingDoorTraversal:
                    | null
                    | {
                          doorX: number;
                          doorY: number;
                          toX: number;
                          toY: number;
                          orientation: number;
                          portal: boolean;
                          cameraX?: number;
                          cameraY?: number;
                          requestedAtMs: number;
                      };
            }, pending: {
                doorX: number;
                doorY: number;
                toX: number;
                toY: number;
                orientation: number;
                portal: boolean;
                cameraX?: number;
                cameraY?: number;
            }) {
                this.clientPendingDoorTraversal = { ...pending, requestedAtMs: Date.now() };
            },
            clearClientPendingDoorTraversal(this: {
                clientPendingDoorTraversal:
                    | null
                    | {
                          requestedAtMs: number;
                      };
            }) {
                this.clientPendingDoorTraversal = null;
            },
            setClientDoorTraversalContact(this: { clientDoorTraversalContact: { doorX: number; doorY: number; mapId: string | null } | null }, contact: { doorX: number; doorY: number; mapId: string | null }) {
                this.clientDoorTraversalContact = contact;
            },
            clearClientDoorTraversalContact(this: { clientDoorTraversalContact: { doorX: number; doorY: number; mapId: string | null } | null }) {
                this.clientDoorTraversalContact = null;
            },
        },
        assignBubbleTo() {},
        resetZone() {},
        checkUndergroundAchievement() {},
        tryUnlockingAchievement() {},
        audioManager: null,
    };

    runClientDoorPortalSystem(host as never);

    expect(teleports).toEqual([{ x: 20, y: 21 }]);
    expect(host.kernel.clientPendingDoorTraversal).toMatchObject({
        doorX: 8,
        doorY: 9,
        toX: 20,
        toY: 21,
    });
});

test('arriving on a reciprocal destination door does not immediately teleport back until explicitly retriggered', () => {
    const playerId = entityIdFromWire(9003);
    const teleports: Array<{ x: number; y: number }> = [];

    const host = {
        started: true,
        playerId,
        player: {
            id: playerId,
            gridX: 8,
            gridY: 9,
            nextGridX: 8,
            nextGridY: 9,
            isDead: false,
            isMoving() {
                return false;
            },
            hasTarget() {
                return false;
            },
            setGridPosition() {},
            turnTo() {},
            forEachAttacker() {},
        },
        client: {
            sendTeleport(x: number, y: number) {
                teleports.push({ x, y });
            },
        },
        map: {
            isDoor(x: number, y: number) {
                return (x === 8 && y === 9) || (x === 20 && y === 21);
            },
            getDoorDestination(x: number, y: number) {
                if (x === 8 && y === 9) {
                    return { x: 20, y: 21, orientation: 0, portal: false };
                }
                if (x === 20 && y === 21) {
                    return { x: 8, y: 9, orientation: 0, portal: false };
                }
                return undefined;
            },
        },
        renderer: { mobile: false, tablet: false, context: null, clearScreen() {} },
        camera: { setGridPosition() {}, focusEntity() {} },
        kernel: {
            clientPendingDoorTraversal: null,
            clientDoorTraversalContact: null,
            setClientPendingDoorTraversal(this: {
                clientPendingDoorTraversal:
                    | null
                    | {
                          doorX: number;
                          doorY: number;
                          toX: number;
                          toY: number;
                          orientation: number;
                          portal: boolean;
                          cameraX?: number;
                          cameraY?: number;
                          requestedAtMs: number;
                      };
            }, pending: {
                doorX: number;
                doorY: number;
                toX: number;
                toY: number;
                orientation: number;
                portal: boolean;
                cameraX?: number;
                cameraY?: number;
            }) {
                this.clientPendingDoorTraversal = { ...pending, requestedAtMs: Date.now() };
            },
            clearClientPendingDoorTraversal(this: {
                clientPendingDoorTraversal:
                    | null
                    | {
                          requestedAtMs: number;
                      };
            }) {
                this.clientPendingDoorTraversal = null;
            },
            setClientDoorTraversalContact(this: { clientDoorTraversalContact: { doorX: number; doorY: number; mapId: string | null } | null }, contact: { doorX: number; doorY: number; mapId: string | null }) {
                this.clientDoorTraversalContact = contact;
            },
            clearClientDoorTraversalContact(this: { clientDoorTraversalContact: { doorX: number; doorY: number; mapId: string | null } | null }) {
                this.clientDoorTraversalContact = null;
            },
            getEntityMapId() {
                return 'world_01';
            },
        },
        assignBubbleTo() {},
        resetZone() {},
        checkUndergroundAchievement() {},
        tryUnlockingAchievement() {},
        audioManager: null,
    };

    runClientDoorPortalSystem(host as never);
    expect(teleports).toEqual([{ x: 20, y: 21 }]);

    host.player.gridX = 20;
    host.player.gridY = 21;
    host.player.nextGridX = 20;
    host.player.nextGridY = 21;

    runClientDoorPortalSystem(host as never);

    expect(teleports).toEqual([{ x: 20, y: 21 }]);
    expect(host.kernel.clientPendingDoorTraversal).toBeNull();
    expect(host.kernel.clientDoorTraversalContact).toEqual({ doorX: 20, doorY: 21, mapId: 'world_01' });
});
