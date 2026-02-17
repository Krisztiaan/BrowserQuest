import type { EntityKind } from '../entity-kind-domain';
import type { GridPos } from '../domain/positions';
import { isWithinAttackRange, resolveAttackRangeTiles } from './attack-range';

export type EngagementDecision = 'attack' | 'pursue';

export function isEntityWithinAttackRange({
    attackerPos,
    targetPos,
    attackerKind,
    attackerWeaponKind,
}: {
    attackerPos: GridPos;
    targetPos: GridPos;
    attackerKind: EntityKind;
    attackerWeaponKind?: EntityKind;
}): boolean {
    const attackRangeTiles = resolveAttackRangeTiles({
        attackerKind,
        weaponKind: attackerWeaponKind,
    });
    return isWithinAttackRange(attackerPos, targetPos, attackRangeTiles);
}

export function resolveEngagementDecision({
    attackerPos,
    targetPos,
    attackerKind,
    attackerWeaponKind,
}: {
    attackerPos: GridPos;
    targetPos: GridPos;
    attackerKind: EntityKind;
    attackerWeaponKind?: EntityKind;
}): EngagementDecision {
    return isEntityWithinAttackRange({
        attackerPos,
        targetPos,
        attackerKind,
        attackerWeaponKind,
    })
        ? 'attack'
        : 'pursue';
}
