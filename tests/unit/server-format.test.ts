import { afterEach, beforeEach, expect, test } from 'bun:test';
import { check, FormatChecker } from '../../server/format';
import {
    ENTITY_CLOTH_ARMOR,
    ENTITY_SWORD_1,
    MSG_CHAT,
    MSG_HELLO,
    MSG_INTENT,
    MSG_MOVE,
    MSG_WHO,
} from '../support/protocol/contract';
const originalConsoleError = console.error;

beforeEach(() => {
    console.error = () => {
        // silence invalid-type noise in parity checks
    };
});

afterEach(() => {
    console.error = originalConsoleError;
});

test('format checker validates representative actions', () => {
    const hello: Array<number | string> = [MSG_HELLO, 'player', ENTITY_CLOTH_ARMOR, ENTITY_SWORD_1];
    const intentOk: Array<number | string> = [MSG_INTENT, 1, 'move.step', '{"x":12,"y":9}'];
    const chat: Array<number | string> = [MSG_CHAT, 'hello'];
    const whoOk: Array<number | string> = [MSG_WHO, 1001, 1002];
    const whoBad: Array<number | string> = [MSG_WHO, 'bad'];
    const intentBad: Array<number | string> = [MSG_INTENT, 1.5, 'move.step', '{"x":12,"y":9}'];
    const legacyMove: Array<number | string> = [MSG_MOVE, 12, 9];

    expect(check(hello)).toBe(true);
    expect(check(intentOk)).toBe(true);
    expect(check(chat)).toBe(true);
    expect(check(whoOk)).toBe(true);
    expect(check(whoBad)).toBe(false);
    expect(check(intentBad)).toBe(false);
    expect(check(legacyMove)).toBe(false);
});

test('format checker class instance validates payloads', () => {
    const checker = new FormatChecker();

    expect(checker.check([MSG_HELLO, 'player', ENTITY_CLOTH_ARMOR, ENTITY_SWORD_1])).toBe(true);
    expect(checker.check([MSG_INTENT, 1, 'move.step', '{"x":3,"y":4}'])).toBe(true);
    expect(checker.check([MSG_INTENT, 1.25, 'move.step', '{"x":3,"y":4}'])).toBe(false);
    expect(checker.check([MSG_MOVE, 3, 4])).toBe(false);
});
