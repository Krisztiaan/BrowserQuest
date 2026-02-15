import type { ComponentType } from './component-registry';
import { SparseSetStore } from './component-store';
import type { EcsWorld } from './world';
import type { GridPos } from '../../shared/domain/positions';

export type ItemDespawnTimer = Readonly<{
    blinkAtTick: number;
    destroyAtTick: number;
    blinked: boolean;
}>;

export type ItemLifecycleComponents = Readonly<{
    ItemDespawnTimer: ComponentType<ItemDespawnTimer>;
    StaticSpawnPos: ComponentType<GridPos>;
}>;

export function registerItemLifecycleComponents(world: EcsWorld): ItemLifecycleComponents {
    const ItemDespawnTimer = world.components.register('ItemDespawnTimer', new SparseSetStore<ItemDespawnTimer>());
    const StaticSpawnPos = world.components.register('StaticSpawnPos', new SparseSetStore<GridPos>());
    return { ItemDespawnTimer, StaticSpawnPos };
}
