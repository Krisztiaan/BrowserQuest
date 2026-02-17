import { expect, test } from 'bun:test';
import { entityIdFromWire } from '../../../shared/domain/ids';
import { runClientDoorPortalSystem } from '../../../client/ecs/systems/client-door-portal-system';

test('client door traversal does not self-teleport; it requests traversal and waits for S2C TELEPORT', () => {
    const playerId = entityIdFromWire(9100);
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
            isMoving() {
                return false;
            },
            hasTarget() {
                return false;
            },
            setGridPosition() {
                moved = true;
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
            isDoor(x: number, y: number) {
                return x === 3 && y === 4;
            },
            getDoorDestination() {
                return { x: 10, y: 11, orientation: 0, cameraX: 0, cameraY: 0, portal: false };
            },
        },
        renderer: { mobile: false, tablet: false, context: null, clearScreen() {} },
        camera: { setGridPosition() {}, focusEntity() {} },
        kernel: {
            clientDoorTraversalArmed: true,
            clientPendingDoorTraversal: null,
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
        },
        assignBubbleTo() {},
        resetZone() {},
        checkUndergroundAchievement() {},
        tryUnlockingAchievement() {},
        audioManager: null,
    };

    runClientDoorPortalSystem(host as never);

    expect(teleports).toEqual([{ x: 10, y: 11 }]);
    expect(moved).toBe(false);
});
