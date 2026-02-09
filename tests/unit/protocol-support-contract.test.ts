import { expect, test } from 'bun:test';
import {
    ENTITY_CLOTH_ARMOR,
    ENTITY_SWORD_1,
    MSG_ATTACK,
    MSG_CHAT,
    MSG_DAMAGE,
    MSG_HELLO,
    MSG_HIT,
    MSG_LIST,
    MSG_LOOTMOVE,
    MSG_MOVE,
    MSG_SPAWN,
    MSG_WELCOME,
    MSG_WHO,
    MSG_ZONE,
} from '../support/protocol';
import SharedTypes from '../../shared/js/gametypes-esm';

const Types = SharedTypes as {
    Messages: Record<string, number>;
    Entities: Record<string, number>;
};

test('protocol support constants stay aligned with shared gametypes', () => {
    expect(MSG_HELLO).toBe(Types.Messages.HELLO);
    expect(MSG_WELCOME).toBe(Types.Messages.WELCOME);
    expect(MSG_SPAWN).toBe(Types.Messages.SPAWN);
    expect(MSG_MOVE).toBe(Types.Messages.MOVE);
    expect(MSG_LOOTMOVE).toBe(Types.Messages.LOOTMOVE);
    expect(MSG_ATTACK).toBe(Types.Messages.ATTACK);
    expect(MSG_HIT).toBe(Types.Messages.HIT);
    expect(MSG_CHAT).toBe(Types.Messages.CHAT);
    expect(MSG_DAMAGE).toBe(Types.Messages.DAMAGE);
    expect(MSG_LIST).toBe(Types.Messages.LIST);
    expect(MSG_WHO).toBe(Types.Messages.WHO);
    expect(MSG_ZONE).toBe(Types.Messages.ZONE);
    expect(ENTITY_CLOTH_ARMOR).toBe(Types.Entities.CLOTHARMOR);
    expect(ENTITY_SWORD_1).toBe(Types.Entities.SWORD1);
});
