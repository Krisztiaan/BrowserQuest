import { expect, test } from 'bun:test';
import { runClientCommandApplySystem } from '../../../client/ecs/systems/client-command-apply-system';
import { ClientWorldKernel } from '../../../client/ecs/world-kernel';
import { entityIdFromWire } from '../../../shared/domain/ids';
import Types from '../../../shared/gametypes-browser';

test('chunk overlay cache keeps pathing cell blocked when dynamic occupancy is removed', () => {
    const kernel = new ClientWorldKernel();
    kernel.clientChunkOverlayCache.applySnapshot({
        chunkX: 0,
        chunkY: 0,
        version: 1,
        chunkSize: 32,
        overrides: [[5, 6, 99]],
    });

    const mapGrid = Array.from({ length: 12 }, () => Array.from({ length: 12 }, () => 0));
    const map = {
        grid: mapGrid,
        isOutOfBounds(x: number, y: number) {
            return x < 0 || y < 0 || x >= 12 || y >= 12;
        },
        isColliding(x: number, y: number) {
            const overlay = kernel.clientChunkOverlayCache.getGlobal(x, y);
            if (overlay !== null) {
                return overlay !== 0;
            }
            return mapGrid[y]?.[x] === 1;
        },
    };

    const entityId = entityIdFromWire(9876);
    const record = {
        gridX: 5,
        gridY: 6,
        nextGridX: -1,
        nextGridY: -1,
        isMoving: false,
        kind: Types.Entities.CHEST,
        isPlayer: false,
    } as const;

    kernel.enqueueClientCommand({ type: 'spatialAddRecord', entityId, record });

    const host = { kernel, map, entities: {}, started: false, client: null, playerId: null, player: null } as Parameters<
        typeof runClientCommandApplySystem
    >[0];

    runClientCommandApplySystem(host);
    expect(kernel.clientPathingGrid?.[6]?.[5]).toBe(1);

    kernel.enqueueClientCommand({ type: 'spatialRemoveRecord', entityId, record });
    runClientCommandApplySystem(host);

    expect(kernel.clientPathingGrid?.[6]?.[5]).toBe(1);
});
