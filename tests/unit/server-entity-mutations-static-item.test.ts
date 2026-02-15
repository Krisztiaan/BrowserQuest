import { expect, test } from 'bun:test';
import { addWorldStaticItem } from '../../server/world/entity-mutations';

test('addWorldStaticItem binds respawn handler only once per item', () => {
    let onCalls = 0;
    let buildCalls = 0;
    let addCalls = 0;
    let respawnHandler: (() => void) | null = null;

    const item = {
        isStatic: false,
        on(_eventName: 'respawn', callback: () => void) {
            onCalls += 1;
            respawnHandler = callback;
        },
    };

    const addItem = (nextItem: typeof item) => {
        addCalls += 1;
        return nextItem;
    };

    const buildRespawnHandler = (_staticItem: typeof item) => {
        buildCalls += 1;
        return () => {
            addItem(item);
        };
    };

    addWorldStaticItem({
        item,
        buildRespawnHandler,
        addItem,
    });
    addWorldStaticItem({
        item,
        buildRespawnHandler,
        addItem,
    });

    expect(item.isStatic).toBe(true);
    expect(onCalls).toBe(1);
    expect(buildCalls).toBe(1);
    expect(addCalls).toBe(2);

    respawnHandler?.();
    expect(addCalls).toBe(3);
});
