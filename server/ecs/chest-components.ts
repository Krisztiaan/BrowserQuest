import type { EntityKind } from '../../shared/entity-kind-domain';
import type { ComponentType } from './component-registry';
import { SparseSetStore } from './component-store';
import type { EcsWorld } from './world';

export type ChestLootTable = Readonly<{
    items: ReadonlyArray<EntityKind>;
}>;

export type ChestComponents = Readonly<{
    ChestLootTable: ComponentType<ChestLootTable>;
}>;

export function registerChestComponents(world: EcsWorld): ChestComponents {
    const ChestLootTable = world.components.register('ChestLootTable', new SparseSetStore<ChestLootTable>());
    return { ChestLootTable };
}
