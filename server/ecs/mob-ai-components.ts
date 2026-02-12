import type { EntityId } from '../../shared/domain/ids';
import type { GridPos } from '../../shared/domain/positions';
import type { ComponentType } from './component-registry';
import { SoaGridPosStore, SparseSetStore } from './component-store';
import type { EcsWorld } from './world';

export type MobHateEntry = Readonly<{
    id: EntityId;
    hate: number;
}>;

export type MobHateState = Readonly<{
    entries: MobHateEntry[];
}>;

export type MobAiComponents = Readonly<{
    MobSpawnPos: ComponentType<GridPos>;
    MobHate: ComponentType<MobHateState>;
    MobReturnAtTick: ComponentType<number>;
}>;

export function registerMobAiComponents(world: EcsWorld): MobAiComponents {
    const MobSpawnPos = world.components.register('MobSpawnPos', new SoaGridPosStore());
    const MobHate = world.components.register('MobHate', new SparseSetStore<MobHateState>());
    const MobReturnAtTick = world.components.register('MobReturnAtTick', new SparseSetStore<number>());
    return { MobSpawnPos, MobHate, MobReturnAtTick };
}

