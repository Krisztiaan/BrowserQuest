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

test('generated session secret persists across process "restarts" via the secret file', async () => {
    const dir = `/tmp/bq-auth-secret-test-${process.pid}-${Math.floor(Math.random() * 1e6)}`;
    process.env.BQ_AUTH_SESSION_SECRET_FILE = `${dir}/secret`;
    const prevEnvSecret = process.env.BQ_AUTH_SESSION_SECRET;
    delete process.env.BQ_AUTH_SESSION_SECRET;
    const { resetRuntimeSessionSecretForTest } = await import('../../server/auth-session');
    try {
        resetRuntimeSessionSecretForTest();
        const token = createSignedAuthSessionToken({ accountNameKey: 'Alice', nowMs: 1_000, ttlSeconds: 3600 });

        // simulate a restart: cached secret cleared, must reload from the file
        resetRuntimeSessionSecretForTest();
        const verified = verifySignedAuthSessionToken({ token, nowMs: 2_000 });
        expect(verified).toBe('alice');
    } finally {
        resetRuntimeSessionSecretForTest();
        delete process.env.BQ_AUTH_SESSION_SECRET_FILE;
        if (prevEnvSecret !== undefined) {
            process.env.BQ_AUTH_SESSION_SECRET = prevEnvSecret;
        }
        await import('node:fs/promises').then((fs) => fs.rm(dir, { recursive: true, force: true }));
    }
});
