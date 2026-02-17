import { expect, test } from 'bun:test';
import { gridPos } from '../../../shared/domain/positions';
import Types from '../../../shared/gametypes-browser';
import { isEntityWithinAttackRange, resolveEngagementDecision } from '../../../shared/combat/engagement';

test('isEntityWithinAttackRange mirrors attack-range behavior for melee', () => {
    expect(
        isEntityWithinAttackRange({
            attackerPos: gridPos(10, 10),
            targetPos: gridPos(11, 10),
            attackerKind: Types.Entities.WARRIOR,
            attackerWeaponKind: Types.Entities.SWORD1,
        })
    ).toBe(true);

    expect(
        isEntityWithinAttackRange({
            attackerPos: gridPos(10, 10),
            targetPos: gridPos(12, 10),
            attackerKind: Types.Entities.WARRIOR,
            attackerWeaponKind: Types.Entities.SWORD1,
        })
    ).toBe(false);
});

test('resolveEngagementDecision returns attack for in-range heavy melee and pursue otherwise', () => {
    expect(
        resolveEngagementDecision({
            attackerPos: gridPos(10, 10),
            targetPos: gridPos(12, 10),
            attackerKind: Types.Entities.WARRIOR,
            attackerWeaponKind: Types.Entities.AXE,
        })
    ).toBe('attack');

    expect(
        resolveEngagementDecision({
            attackerPos: gridPos(10, 10),
            targetPos: gridPos(11, 11),
            attackerKind: Types.Entities.WARRIOR,
            attackerWeaponKind: Types.Entities.AXE,
        })
    ).toBe('pursue');
});
