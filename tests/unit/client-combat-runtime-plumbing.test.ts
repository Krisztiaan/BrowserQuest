import { expect, test } from 'bun:test';
import Types from '../../shared/gametypes-browser';
import { entityIdFromWire } from '../../shared/domain/ids';
import { ClientWorldKernel } from '../../client/ecs/world-kernel';
import { runClientRuntimeEventSystem } from '../../client/ecs/systems/client-runtime-event-system';
import { adaptKernelEntityForRendering } from '../../client/ecs/kernel-entity-adapter';
import Warrior from '../../client/warrior';
import Mob from '../../client/mob';

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

    if (adapted.type !== 'character') {
        throw new Error('Expected character adapter result');
    }
    const entity = adapted.entity as { maxHitPoints?: number; hitPoints?: number };
    expect(typeof entity.maxHitPoints).toBe('number');
    expect((entity.maxHitPoints ?? 0) > 0).toBe(true);
    expect(entity.hitPoints).toBe(entity.maxHitPoints);
});

test('combat cleanup tolerates duplicate attack-link removal', () => {
    const playerId = entityIdFromWire(100);
    const mobId = entityIdFromWire(200);
    const player = new Warrior('player', 'K');
    const mob = new Mob(mobId, Types.Entities.RAT);

    player.id = playerId;
    player.kind = Types.Entities.WARRIOR;
    player.setGridPosition(10, 10);
    mob.setGridPosition(11, 10);

    player.engage(mob);
    mob.addAttacker(player);

    expect(player.target).toBe(mob);
    expect(mob.isAttackedBy(player)).toBe(true);

    player.removeTarget();
    expect(player.target).toBeNull();
    expect(mob.isAttackedBy(player)).toBe(false);
    expect(() => player.removeTarget()).not.toThrow();
    expect(() => mob.removeAttacker(player)).not.toThrow();
});

test('Client runtime transition events enqueue transition commands', () => {
    const kernel = new ClientWorldKernel();

    kernel.enqueueClientRuntimeEvent({
        type: 'mapTransitionBegin',
        seq: 1,
        fromMapId: 'world',
        toMapId: 'house',
        x: 3,
        y: 4,
    });
    kernel.enqueueClientRuntimeEvent({
        type: 'mapTransitionCommit',
        seq: 1,
        fromMapId: 'world',
        toMapId: 'house',
        x: 3,
        y: 4,
    });
    runClientRuntimeEventSystem({ kernel });

    const cmds = kernel.drainClientCommands();
    expect(cmds).toContainEqual({
        type: 'beginMapTransition',
        seq: 1,
        fromMapId: 'world',
        toMapId: 'house',
        x: 3,
        y: 4,
    });
    expect(cmds).toContainEqual({
        type: 'commitMapTransition',
        seq: 1,
        fromMapId: 'world',
        toMapId: 'house',
        x: 3,
        y: 4,
    });
});
