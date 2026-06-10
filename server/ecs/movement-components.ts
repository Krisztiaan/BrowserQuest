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

/** Client-owned movement: envelope-validated position staged by move.pos, committed by the movement system. */
export type ClientOwnedMoveTargetState = Readonly<{
    pos: Readonly<{ x: number; y: number }>;
    facing: number;
    moving: boolean;
}>;

export type MovementComponents = Readonly<{
    MoveQueue: ComponentType<MoveQueueState>;
    NextMoveTick: ComponentType<number>;
    MoveInput: ComponentType<MoveInputState>;
    MoveSpeedRemainder: ComponentType<number>;
    ClientOwnedMoveTarget: ComponentType<ClientOwnedMoveTargetState>;
}>;

export function registerMovementComponents(world: EcsWorld): MovementComponents {
    const MoveQueue = world.components.register('MoveQueue', new SparseSetStore<MoveQueueState>());
    const NextMoveTick = world.components.register('NextMoveTick', new SparseSetStore<number>());
    const MoveInput = world.components.register('MoveInput', new SparseSetStore<MoveInputState>());
    const MoveSpeedRemainder = world.components.register('MoveSpeedRemainder', new SparseSetStore<number>());
    const ClientOwnedMoveTarget = world.components.register(
        'ClientOwnedMoveTarget',
        new SparseSetStore<ClientOwnedMoveTargetState>()
    );
    return { MoveQueue, NextMoveTick, MoveInput, MoveSpeedRemainder, ClientOwnedMoveTarget };
}
