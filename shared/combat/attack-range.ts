import type { EntityKind, EntityKindId } from '../entity-kind-domain';
import type { GridPos } from '../domain/positions';
import Types from '../gametypes-browser';

const EXTENDED_MELEE_RANGE_BY_WEAPON: Partial<Record<EntityKindId, number>> = {
    [Types.Entities.AXE]: 2,
    [Types.Entities.MORNINGSTAR]: 2,
};

function toEntityKindId(kind: EntityKind | undefined): EntityKindId | undefined {
    if (kind === undefined) {
        return undefined;
    }
    if (typeof kind === 'number') {
        return kind;
    }
    return Types.getKindFromString(kind);
}

export function resolveAttackRangeTiles({
    attackerKind,
    weaponKind,
}: {
    attackerKind: EntityKind;
    weaponKind?: EntityKind;
}): number {
    if (Types.isPlayer(attackerKind)) {
        const weaponKindId = toEntityKindId(weaponKind);
        if (weaponKindId === undefined) {
            return 1;
        }
        return EXTENDED_MELEE_RANGE_BY_WEAPON[weaponKindId] ?? 1;
    }
    return 1;
}

export function isWithinAttackRange(from: GridPos, to: GridPos, rangeTiles: number): boolean {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (dx === 0 && dy === 0) {
        return false;
    }

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (rangeTiles <= 1) {
        return absDx + absDy === 1;
    }

    if (dx !== 0 && dy !== 0) {
        return false;
    }

    const lineDistance = absDx + absDy;
    return lineDistance >= 1 && lineDistance <= rangeTiles;
}
