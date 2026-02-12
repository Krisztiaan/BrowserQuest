import { expect, test } from 'bun:test';
import Types from '../../shared/gametypes-browser';
import { requireMobPrefab } from '../../shared/content/prefabs';

test('mob prefab table covers all known mob kinds', () => {
    const knownMobNames: string[] = [];
    Types.forEachKind((kind, kindName) => {
        if (Types.isMob(kind)) {
            knownMobNames.push(kindName);
        }
    });
    knownMobNames.sort();

    const prefabMobNames = knownMobNames.filter((mobName) => {
        const kind = Types.getKindFromString(mobName);
        expect(kind).not.toBeUndefined();
        expect(Types.isMob(kind)).toBe(true);
        requireMobPrefab(kind);
        return true;
    });

    expect(prefabMobNames).toEqual(knownMobNames);
});

test('mob prefab table preserves representative baseline values', () => {
    const ratKind = Types.getKindFromString('rat');
    expect(ratKind).not.toBeUndefined();
    expect(Types.isMob(ratKind)).toBe(true);
    const ratPrefab = requireMobPrefab(ratKind);
    expect(ratPrefab.combat.maxHitPoints).toBe(25);
    expect(ratPrefab.combat.armorLevel).toBe(1);
    expect(ratPrefab.combat.weaponLevel).toBe(1);

    const bossKind = Types.getKindFromString('boss');
    expect(bossKind).not.toBeUndefined();
    expect(Types.isMob(bossKind)).toBe(true);
    const bossPrefab = requireMobPrefab(bossKind);

    const goldenSwordKind = Types.getKindFromString('goldensword');
    expect(goldenSwordKind).not.toBeUndefined();
    expect(Types.isItem(goldenSwordKind)).toBe(true);

    const goldenSwordDrop = bossPrefab.drops.find((drop) => drop.kind === goldenSwordKind);
    expect(goldenSwordDrop).not.toBeUndefined();
    expect(goldenSwordDrop?.chance).toBe(100);
});
