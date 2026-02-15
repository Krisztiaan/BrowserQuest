import { expect, test } from 'bun:test';
import Types from '../../../shared/gametypes-browser';
import { entityIdFromWire } from '../../../shared/domain/ids';
import { ClientWorldKernel } from '../../../client/ecs/world-kernel';
import { runClientClickIntentSystem } from '../../../client/ecs/systems/client-click-intent-system';

test('clicking a dead mob tile issues move (not repeat attack) while corpse entity still exists client-side', () => {
    const kernel = new ClientWorldKernel();
    const mobId = entityIdFromWire(99);

    const aliveRecord = {
        gridX: 5,
        gridY: 6,
        nextGridX: 5,
        nextGridY: 6,
        isMoving: false,
        isDead: false,
        kind: Types.Entities.RAT,
        isPlayer: false,
    } as const;

    kernel.clientSpatialRecords.set(mobId, aliveRecord);
    kernel.applySpatialAddRecord(mobId, aliveRecord);

    const host = {
        started: true,
        kernel,
        player: { gridX: 1, gridY: 1, isDead: false, isOnPlateau: false, nextGridX: 1, nextGridY: 1 },
        map: {
            isColliding: () => false,
            isPlateau: () => false,
        },
        isZoning: () => false,
        isZoningTile: () => false,
    };

    kernel.setClientClickIntent({ x: 5, y: 6 });
    runClientClickIntentSystem(host);
    expect(kernel.clientInteractionIntent?.kind).toBe('attack');
    kernel.drainClientCommands();

    const deadRecord = { ...aliveRecord, isDead: true } as const;
    kernel.clientSpatialRecords.set(mobId, deadRecord);

    kernel.setClientClickIntent({ x: 5, y: 6 });
    runClientClickIntentSystem(host);

    expect(kernel.clientInteractionIntent).toBe(null);
    expect(kernel.drainClientCommands()).toContainEqual({ type: 'playerGoTo', x: 5, y: 6 });
});

