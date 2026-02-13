import { expect, test } from 'bun:test';
import Types from '../../shared/gametypes-browser';
import { entityIdFromWire } from '../../shared/domain/ids';
import { ClientWorldKernel } from '../../client/ecs/world-kernel';
import { runClientRuntimeEventSystem } from '../../client/ecs/systems/client-runtime-event-system';
import { adaptKernelEntityForRendering } from '../../client/ecs/kernel-entity-adapter';

test('Client runtime events forward DAMAGE into a client command', () => {
    const kernel = new ClientWorldKernel();
    const mobId = entityIdFromWire(7);

    kernel.enqueueClientRuntimeEvent({ type: 'playerDamageMob', mobId, points: 5 });
    runClientRuntimeEventSystem({ kernel });

    const cmds = kernel.drainClientCommands();
    expect(cmds).toContainEqual({ type: 'applyDamageToMob', mobId, points: 5 });
});

test('Kernel entity adapter initializes mob HP from prefabs', () => {
    const kernel = new ClientWorldKernel();

    const view = kernel.upsertFromSpawnSnapshot({
        id: 9,
        kind: Types.Entities.RAT,
        x: 1,
        y: 1,
        extras: { type: 'mob', orientation: 0 },
    });

    const adapted = adaptKernelEntityForRendering(kernel, view.id);
    expect(adapted.type).toBe('character');

    const entity = (adapted as { entity: unknown }).entity as { maxHitPoints?: number; hitPoints?: number };
    expect(typeof entity.maxHitPoints).toBe('number');
    expect((entity.maxHitPoints ?? 0) > 0).toBe(true);
    expect(entity.hitPoints).toBe(entity.maxHitPoints);
});
