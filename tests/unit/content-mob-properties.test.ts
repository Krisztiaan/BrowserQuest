import { expect, test } from 'bun:test';
import Types from '../../shared/js/gametypes-browser';
import { MOB_PROPERTIES_DATA } from '../../server/js/generated/mob-properties.generated';

test('mob content table is non-empty and maps only to known mob kinds', () => {
    const mobNames = Object.keys(MOB_PROPERTIES_DATA);
    expect(mobNames.length).toBeGreaterThan(0);

    mobNames.forEach((mobName) => {
        const kind = Types.getKindFromString(mobName);
        expect(kind).not.toBeUndefined();
        expect(Types.isMob(kind)).toBe(true);
    });
});

test('mob content table preserves representative baseline values', () => {
    expect(MOB_PROPERTIES_DATA.rat.hp).toBe(25);
    expect(MOB_PROPERTIES_DATA.rat.armor).toBe(1);
    expect(MOB_PROPERTIES_DATA.rat.weapon).toBe(1);
    expect(MOB_PROPERTIES_DATA.boss.drops.goldensword).toBe(100);
});
