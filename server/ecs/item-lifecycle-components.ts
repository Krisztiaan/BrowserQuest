import type { ComponentType } from './component-registry';
import { SparseSetStore } from './component-store';
import type { EcsWorld } from './world';

export type ItemDespawnTimer = Readonly<{
    blinkAtTick: number;
    destroyAtTick: number;
    blinked: boolean;
}>;

export type ItemLifecycleComponents = Readonly<{
    ItemDespawnTimer: ComponentType<ItemDespawnTimer>;
}>;

export function registerItemLifecycleComponents(world: EcsWorld): ItemLifecycleComponents {
    const ItemDespawnTimer = world.components.register('ItemDespawnTimer', new SparseSetStore<ItemDespawnTimer>());
    return { ItemDespawnTimer };
}

