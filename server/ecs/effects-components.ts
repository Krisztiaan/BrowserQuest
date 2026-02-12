import type { EntityKind } from '../../shared/entity-kind-domain';
import type { ComponentType } from './component-registry';
import { SparseSetStore } from './component-store';
import type { EcsWorld } from './world';

export type TempVisualEquip = Readonly<{
    kind: EntityKind;
    revertKind: EntityKind;
    expiresAtTick: number;
}>;

export type EffectsComponents = Readonly<{
    TempVisualEquip: ComponentType<TempVisualEquip>;
}>;

export function registerEffectsComponents(world: EcsWorld): EffectsComponents {
    const TempVisualEquip = world.components.register('TempVisualEquip', new SparseSetStore<TempVisualEquip>());
    return { TempVisualEquip };
}

