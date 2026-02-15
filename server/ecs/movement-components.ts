import type { GridPos } from '../../shared/domain/positions';
import type { ComponentType } from './component-registry';
import { SparseSetStore } from './component-store';
import type { EcsWorld } from './world';

export type MoveQueueState = Readonly<{
    entries: GridPos[];
}>;

export type MovementComponents = Readonly<{
    MoveQueue: ComponentType<MoveQueueState>;
    NextMoveTick: ComponentType<number>;
}>;

export function registerMovementComponents(world: EcsWorld): MovementComponents {
    const MoveQueue = world.components.register('MoveQueue', new SparseSetStore<MoveQueueState>());
    const NextMoveTick = world.components.register('NextMoveTick', new SparseSetStore<number>());
    return { MoveQueue, NextMoveTick };
}
