import type { ComponentType } from './component-registry';
import { SparseSetStore } from './component-store';
import type { EcsWorld } from './world';

export type CombatComponents = Readonly<{
    HitPoints: ComponentType<number>;
    MaxHitPoints: ComponentType<number>;
    ArmorLevel: ComponentType<number>;
    WeaponLevel: ComponentType<number>;
    NextAttackTick: ComponentType<number>;
}>;

export function registerCombatComponents(world: EcsWorld): CombatComponents {
    const HitPoints = world.components.register('HitPoints', new SparseSetStore<number>());
    const MaxHitPoints = world.components.register('MaxHitPoints', new SparseSetStore<number>());
    const ArmorLevel = world.components.register('ArmorLevel', new SparseSetStore<number>());
    const WeaponLevel = world.components.register('WeaponLevel', new SparseSetStore<number>());
    const NextAttackTick = world.components.register('NextAttackTick', new SparseSetStore<number>());
    return { HitPoints, MaxHitPoints, ArmorLevel, WeaponLevel, NextAttackTick };
}
