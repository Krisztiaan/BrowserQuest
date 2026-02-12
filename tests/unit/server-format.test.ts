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
    const samples: unknown[][] = [
        [MSG_HELLO, 'player', ENTITY_CLOTH_ARMOR, ENTITY_SWORD_1],
        [MSG_MOVE, 12, 9],
        [MSG_CHAT, 'hello'],
        [MSG_WHO, 1001, 1002],
        [MSG_WHO, 'bad'],
        [MSG_MOVE, 12.5, 9],
    ];

    expect(check(samples[0])).toBe(true);
    expect(check(samples[1])).toBe(true);
    expect(check(samples[2])).toBe(true);
    expect(check(samples[3])).toBe(true);
    expect(check(samples[4])).toBe(false);
    expect(check(samples[5])).toBe(false);
});

test('format checker class instance validates payloads', () => {
    const checker = new FormatChecker();

    expect(checker.check([MSG_HELLO, 'player', ENTITY_CLOTH_ARMOR, ENTITY_SWORD_1])).toBe(true);
    expect(checker.check([MSG_MOVE, 3, 4])).toBe(true);
    expect(checker.check([MSG_MOVE, 3.25, 4])).toBe(false);
});
