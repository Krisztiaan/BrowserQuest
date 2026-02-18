import { afterEach, beforeEach, expect, test } from 'bun:test';
import { check, FormatChecker } from '../../server/format';
import { gridPos } from '../../shared/domain/positions';
import { encodeMoveStepIntentPayload } from '../../shared/protocol/intents';
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
    const hello = [MSG_HELLO, 'player', ENTITY_CLOTH_ARMOR, ENTITY_SWORD_1];
    const payloadOk = encodeMoveStepIntentPayload(gridPos(12, 9));
    expect(payloadOk).not.toBeNull();
    const intentOk = [MSG_INTENT, 1, 'move.step', payloadOk as number[]];
    const chat = [MSG_CHAT, 'hello'];
    const whoOk = [MSG_WHO, 1001, 1002];
    const whoBad = [MSG_WHO, 'bad'];
    const intentBad = [MSG_INTENT, 1.5, 'move.step', payloadOk as number[]];
    const legacyMove = [MSG_MOVE, 12, 9];

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
    const payloadOk = encodeMoveStepIntentPayload(gridPos(3, 4));
    expect(payloadOk).not.toBeNull();
    expect(checker.check([MSG_INTENT, 1, 'move.step', payloadOk as number[]])).toBe(true);
    expect(checker.check([MSG_INTENT, 1.25, 'move.step', payloadOk as number[]])).toBe(false);
    expect(checker.check([MSG_MOVE, 3, 4])).toBe(false);
});
