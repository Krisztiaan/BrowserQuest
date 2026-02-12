import { expect, test } from 'bun:test';
import Types from '../../shared/gametypes-browser';
import { ITEM_PREFABS } from '../../shared/generated/prefabs.generated';
import { requireItemPrefab } from '../../shared/content/prefabs';

test('item prefab table is non-empty and maps only to known item kinds', () => {
    const itemPrefabs = Object.values(ITEM_PREFABS);
    expect(itemPrefabs.length).toBeGreaterThan(0);

    itemPrefabs.forEach((prefab) => {
        const kind = prefab.kind;
        expect(Types.isItem(kind)).toBe(true);
        const required = requireItemPrefab(kind);
        expect(required.lootMessage).toBe(prefab.lootMessage);
    });
});

test('item prefab loot messages are non-empty strings', () => {
    Object.values(ITEM_PREFABS).forEach((prefab) => {
        const message = prefab.lootMessage;
        expect(typeof message).toBe('string');
        expect(message.trim().length).toBeGreaterThan(0);
    });
});

test('item prefab loot message table preserves representative baseline values', () => {
    const sword2Kind = Types.getKindFromString('sword2');
    expect(sword2Kind).not.toBeUndefined();
    expect(Types.isItem(sword2Kind)).toBe(true);
    expect(requireItemPrefab(sword2Kind).lootMessage).toBe('You pick up a steel sword');

    const firePotionKind = Types.getKindFromString('firepotion');
    expect(firePotionKind).not.toBeUndefined();
    expect(Types.isItem(firePotionKind)).toBe(true);
    expect(requireItemPrefab(firePotionKind).lootMessage).toBe('You feel the power of Firefox!');
});
