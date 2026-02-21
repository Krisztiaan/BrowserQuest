import { expect, test } from 'bun:test';
import { gridPos } from '../../../shared/domain/positions';
import { SoaGridPosStore } from '../../../server/ecs/component-store';
import type { Command } from '../../../server/ecs/commands';
import { createApplyMoveCommandsSystem } from '../../../server/ecs/command-systems';
import type { DomainEvent } from '../../../server/ecs/events';
import { OUTBOX_RESOURCE } from '../../../server/ecs/outbox';
import { flushDomainEventsToOutboxSystem } from '../../../server/ecs/outbox-systems';
import { Queue } from '../../../server/ecs/queues';
import { Scheduler } from '../../../server/ecs/scheduler';
import { WorldState } from '../../../server/ecs/world-state';

test('MOVE command flows commands -> ECS -> domain event (movement replication handled elsewhere)', () => {
    const state = new WorldState<Command, DomainEvent>();
    state.resources.set(OUTBOX_RESOURCE, new Queue());

    const Position = state.world.components.register('Position', new SoaGridPosStore());
    const player = state.world.createEntity();
    state.world.addComponent(player, Position, gridPos(0, 0));

    state.commands.push({
        type: 'MOVE',
        source: { connectionId: 'c1', playerId: player },
        to: gridPos(5, 6),
    });

    const scheduler = new Scheduler<Command, DomainEvent>({ nowMs: () => 0 });
    scheduler.register('pre', 'apply_move', createApplyMoveCommandsSystem({ Position }));
    scheduler.register('post', 'flush_outbox', flushDomainEventsToOutboxSystem);
    scheduler.tick(state, 1);

    expect(state.world.getComponent(player, Position)).toEqual(gridPos(5, 6));
    const out = state.resources.require(OUTBOX_RESOURCE).drain();
    // Movement is replicated via `ENTITY_STATE_BATCH` from the world ECS command pipeline; the generic
    // domain-event outbox flush intentionally does not emit MOVE for `ENTITY_MOVED`.
    expect(out).toEqual([]);
});
