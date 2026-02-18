import type { GridPos } from '../../shared/domain/positions';
import type { ComponentType } from './component-registry';
import { SparseSetStore } from './component-store';
import type { EcsWorld } from './world';

export type MoveQueueState = Readonly<{
    entries: GridPos[];
}>;

export type MoveInputState = Readonly<{
    keysMask: number;
    // Most-recently-pressed ordering of movement keys (W/A/S/D bits). The active direction is the last entry still held.
    recentKeys: number[];
}>;

export type MovementComponents = Readonly<{
    MoveQueue: ComponentType<MoveQueueState>;
    NextMoveTick: ComponentType<number>;
    MoveInput: ComponentType<MoveInputState>;
}>;

export function registerMovementComponents(world: EcsWorld): MovementComponents {
    const MoveQueue = world.components.register('MoveQueue', new SparseSetStore<MoveQueueState>());
    const NextMoveTick = world.components.register('NextMoveTick', new SparseSetStore<number>());
    const MoveInput = world.components.register('MoveInput', new SparseSetStore<MoveInputState>());
    return { MoveQueue, NextMoveTick, MoveInput };
}
