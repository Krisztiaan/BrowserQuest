import { expect, test } from 'bun:test';
import Player from '../../../client/player';
import { runClientSpatialSyncSystem } from '../../../client/ecs/systems/client-spatial-sync-system';
import { ClientWorldKernel } from '../../../client/ecs/world-kernel';
import Types from '../../../shared/gametypes-browser';
import { entityIdFromWire } from '../../../shared/domain/ids';
import { setEntityGrid } from '../../support/mmo/client-gameplay';

test('client spatial sync marks the local player as moving while move input is held', () => {
    const kernel = new ClientWorldKernel();
    const playerId = entityIdFromWire(1);
    const player = new Player(playerId, 'K', Types.Entities.WARRIOR);
    setEntityGrid(player, 10, 10);
    kernel.clientMoveInputKeysMask = 1;

    runClientSpatialSyncSystem({
        kernel,
        map: {
            grid: Array.from({ length: 20 }, () => Array.from({ length: 20 }, () => 0)),
            isOutOfBounds: () => false,
        },
        entities: {
            [String(playerId)]: player,
        },
    });

    const cmds = kernel.drainClientCommands();
    expect(cmds).toContainEqual({
        type: 'spatialAddRecord',
        entityId: playerId,
        record: {
            gridX: 10,
            gridY: 10,
            nextGridX: -1,
            nextGridY: -1,
            isMoving: true,
            isDead: false,
            kind: Types.Entities.WARRIOR,
            isPlayer: true,
        },
    });
});
