import { expect, test } from 'bun:test';
import Types from '../../shared/gametypes-browser';
import { ITEM_LOOT_MESSAGES } from '../../client/item-loot-messages.generated';

test('item loot message table is non-empty and keys map to known item kinds', () => {
    const itemNames = Object.keys(ITEM_LOOT_MESSAGES);
    expect(itemNames.length).toBeGreaterThan(0);

    itemNames.forEach((itemName) => {
        const kind = Types.getKindFromString(itemName);
        expect(kind).not.toBeUndefined();
        expect(Types.isItem(kind)).toBe(true);
    });
});

test('item loot message table values are non-empty strings', () => {
    Object.values(ITEM_LOOT_MESSAGES).forEach((message) => {
        expect(typeof message).toBe('string');
        expect(message.trim().length).toBeGreaterThan(0);
    });
});

test('item loot message table preserves representative baseline values', () => {
    expect(ITEM_LOOT_MESSAGES.sword2).toBe('You pick up a steel sword');
    expect(ITEM_LOOT_MESSAGES.firepotion).toBe('You feel the power of Firefox!');
});
