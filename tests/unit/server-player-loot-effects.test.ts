import { expect, test } from 'bun:test';
import { applyPlayerLootEffect } from '../../server/player-loot-effects';
import Types from '../../shared/gametypes-browser';

type LootTestPlayer = Parameters<typeof applyPlayerLootEffect>[0];

function createTestPlayer(): {
    player: LootTestPlayer;
    events: {
        broadcasts: unknown[];
        sent: unknown[];
        pushedHealth: unknown[];
        equippedKinds: number[];
        regenBy: number[];
        updateHitPointsCalls: number;
        equipItemCalls: number;
    };
} {
    const events = {
        broadcasts: [] as unknown[],
        sent: [] as unknown[],
        pushedHealth: [] as unknown[],
        equippedKinds: [] as number[],
        regenBy: [] as number[],
        updateHitPointsCalls: 0,
        equipItemCalls: 0,
    };

    const player: LootTestPlayer = {
        armor: Types.Entities.CLOTHARMOR,
        firepotionTimeout: null,
        maxHitPoints: 120,
        updateHitPoints() {
            events.updateHitPointsCalls += 1;
        },
        broadcast(message) {
            events.broadcasts.push(message);
        },
        equip(kind) {
            events.equippedKinds.push(kind as number);
            return { equip: kind };
        },
        send(message) {
            events.sent.push(message);
        },
        hasFullHealth() {
            return false;
        },
        regenHealthBy(amount) {
            events.regenBy.push(amount);
        },
        health() {
            return { health: true };
        },
        equipItem() {
            events.equipItemCalls += 1;
        },
        server: {
            pushToPlayer(_player, message) {
                events.pushedHealth.push(message);
            },
        },
    };

    return { player, events };
}

test('applyPlayerLootEffect handles firepotion side effects', () => {
    const { player, events } = createTestPlayer();

    const handled = applyPlayerLootEffect(player, { kind: Types.Entities.FIREPOTION });

    expect(handled).toBe(true);
    expect(events.updateHitPointsCalls).toBe(1);
    expect(events.equippedKinds.includes(Types.Entities.FIREFOX)).toBe(true);
    expect(events.sent.length).toBe(1);
    expect(player.firepotionTimeout).not.toBeNull();

    if (player.firepotionTimeout) {
        clearTimeout(player.firepotionTimeout);
        player.firepotionTimeout = null;
    }
});

test('applyPlayerLootEffect heals player on healing items', () => {
    const { player, events } = createTestPlayer();

    const handled = applyPlayerLootEffect(player, { kind: Types.Entities.FLASK });

    expect(handled).toBe(true);
    expect(events.regenBy).toEqual([40]);
    expect(events.pushedHealth).toEqual([{ health: true }]);
});

test('applyPlayerLootEffect equips armor/weapon upgrades', () => {
    const { player, events } = createTestPlayer();

    const handled = applyPlayerLootEffect(player, { kind: Types.Entities.REDARMOR });

    expect(handled).toBe(true);
    expect(events.equipItemCalls).toBe(1);
    expect(events.equippedKinds.includes(Types.Entities.REDARMOR)).toBe(true);
});

test('applyPlayerLootEffect returns false for unsupported item effects', () => {
    const { player, events } = createTestPlayer();

    const handled = applyPlayerLootEffect(player, { kind: Types.Entities.CAKE });

    expect(handled).toBe(false);
    expect(events.broadcasts.length).toBe(0);
    expect(events.sent.length).toBe(0);
});
