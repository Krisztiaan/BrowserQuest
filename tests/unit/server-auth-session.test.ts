import { expect, test } from 'bun:test';
import { createSignedAuthSessionToken, verifySignedAuthSessionToken } from '../../server/auth-session';

test('auth session tokens round-trip normalized account identity', () => {
    const token = createSignedAuthSessionToken({
        accountNameKey: '  Hero_One  ',
        secret: 'test-secret',
        nowMs: 1_700_000_000_000,
        ttlSeconds: 3600,
    });

    const accountNameKey = verifySignedAuthSessionToken({
        token,
        secret: 'test-secret',
        nowMs: 1_700_000_000_000 + 1_000,
    });

    expect(accountNameKey).toBe('hero_one');
});

test('auth session token verification rejects tampered payloads', () => {
    const token = createSignedAuthSessionToken({
        accountNameKey: 'hero',
        secret: 'test-secret',
        nowMs: 1_700_000_000_000,
        ttlSeconds: 3600,
    });

    const [payload, exp, sig] = token.split('.');
    expect(payload).toBeTruthy();
    expect(exp).toBeTruthy();
    expect(sig).toBeTruthy();

    const tampered = `${payload}.${exp}.x${sig?.slice(1)}`;
    const accountNameKey = verifySignedAuthSessionToken({
        token: tampered,
        secret: 'test-secret',
        nowMs: 1_700_000_000_000 + 1_000,
    });

    expect(accountNameKey).toBeNull();
});

test('auth session token verification rejects expired tokens', () => {
    const token = createSignedAuthSessionToken({
        accountNameKey: 'hero',
        secret: 'test-secret',
        nowMs: 1_700_000_000_000,
        ttlSeconds: 5,
    });

    const accountNameKey = verifySignedAuthSessionToken({
        token,
        secret: 'test-secret',
        nowMs: 1_700_000_000_000 + 10_000,
    });

    expect(accountNameKey).toBeNull();
});
