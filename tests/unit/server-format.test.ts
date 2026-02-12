import { afterEach, beforeEach, expect, test } from 'bun:test';
import { check, FormatChecker } from '../../server/format';
import {
    ENTITY_CLOTH_ARMOR,
    ENTITY_SWORD_1,
    MSG_CHAT,
    MSG_HELLO,
    MSG_MOVE,
    MSG_WHO,
} from '../support/protocol/contract';
const originalConsoleError = console.error;

beforeEach(() => {
    console.error = () => {
        // silence unknown-type noise in parity checks
    };
});

afterEach(() => {
    console.error = originalConsoleError;
});

test('format checker validates representative actions', () => {
    const hello: unknown[] = [MSG_HELLO, 'player', ENTITY_CLOTH_ARMOR, ENTITY_SWORD_1];
    const moveOk: unknown[] = [MSG_MOVE, 12, 9];
    const chat: unknown[] = [MSG_CHAT, 'hello'];
    const whoOk: unknown[] = [MSG_WHO, 1001, 1002];
    const whoBad: unknown[] = [MSG_WHO, 'bad'];
    const moveBad: unknown[] = [MSG_MOVE, 12.5, 9];

    expect(check(hello)).toBe(true);
    expect(check(moveOk)).toBe(true);
    expect(check(chat)).toBe(true);
    expect(check(whoOk)).toBe(true);
    expect(check(whoBad)).toBe(false);
    expect(check(moveBad)).toBe(false);
});

test('format checker class instance validates payloads', () => {
    const checker = new FormatChecker();

    expect(checker.check([MSG_HELLO, 'player', ENTITY_CLOTH_ARMOR, ENTITY_SWORD_1])).toBe(true);
    expect(checker.check([MSG_MOVE, 3, 4])).toBe(true);
    expect(checker.check([MSG_MOVE, 3.25, 4])).toBe(false);
});
