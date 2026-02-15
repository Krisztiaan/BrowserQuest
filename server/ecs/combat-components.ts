import type { ComponentType } from './component-registry';
import { SparseSetStore } from './component-store';
import type { EcsWorld } from './world';
import type { EntityId } from '../../shared/domain/ids';

export type CombatComponents = Readonly<{
    HitPoints: ComponentType<number>;
    MaxHitPoints: ComponentType<number>;
    ArmorLevel: ComponentType<number>;
    WeaponLevel: ComponentType<number>;
    NextAttackTick: ComponentType<number>;
    AttackWindup: ComponentType<{
        targetId: EntityId;
        hitAtTick: number;
    }>;
}>;

export function registerCombatComponents(world: EcsWorld): CombatComponents {
    const HitPoints = world.components.register('HitPoints', new SparseSetStore<number>());
    const MaxHitPoints = world.components.register('MaxHitPoints', new SparseSetStore<number>());
    const ArmorLevel = world.components.register('ArmorLevel', new SparseSetStore<number>());
    const WeaponLevel = world.components.register('WeaponLevel', new SparseSetStore<number>());
    const NextAttackTick = world.components.register('NextAttackTick', new SparseSetStore<number>());
    const AttackWindup = world.components.register(
        'AttackWindup',
        new SparseSetStore<{
            targetId: EntityId;
            hitAtTick: number;
        }>()
    );
    return { HitPoints, MaxHitPoints, ArmorLevel, WeaponLevel, NextAttackTick, AttackWindup };
}
