import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SqlitePlayerPersistence } from '../../../server/player-persistence';
import { createPasskeyAuthResponse } from '../../../server/passkey-auth';
import { ACCOUNT_COOKIE_KEY, AUTH_SESSION_COOKIE_KEY, USERNAME_COOKIE_KEY } from '../../../shared/auth/cookie-keys';

function withTempPlayerDb<T>(fn: (dbPath: string) => Promise<T> | T): Promise<T> | T {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'bq-passkey-auth-'));
    const dbPath = path.join(dir, 'players.sqlite');
    const run = async () => {
        try {
            return await fn(dbPath);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    };
    return run();
}

function createJsonRequest(pathname: string, payload: unknown, method = 'POST'): Request {
    return new Request(`http://localhost${pathname}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
}

test('passkey auth register endpoint accepts username + credential and sets auth cookies', async () => {
    await withTempPlayerDb(async (dbPath) => {
        const persistence = new SqlitePlayerPersistence(dbPath);
        try {
            const response = await createPasskeyAuthResponse({
                request: createJsonRequest('/auth/passkey/register', {
                    username: 'Alice',
                    credentialId: 'cred-1',
                }),
                persistence,
            });

            expect(response.status).toBe(200);
            const body = (await response.json()) as { ok: boolean; accountNameKey: string; displayName: string };
            expect(body.ok).toBe(true);
            expect(body.accountNameKey).toBe('alice');
            expect(body.displayName).toBe('Alice');

            const setCookie = response.headers.get('set-cookie') ?? '';
            expect(setCookie).toContain(`${AUTH_SESSION_COOKIE_KEY}=`);
            expect(setCookie).toContain(`${ACCOUNT_COOKIE_KEY}=alice`);
            expect(setCookie).toContain(`${USERNAME_COOKIE_KEY}=Alice`);
        } finally {
            persistence.close();
        }
    });
});

test('passkey auth login endpoint validates credential and sets auth cookies', async () => {
    await withTempPlayerDb(async (dbPath) => {
        const persistence = new SqlitePlayerPersistence(dbPath);
        try {
            const registerResult = persistence.registerPasskeyCredential({
                requestedName: 'alice',
                credentialId: 'cred-login',
            });
            expect(registerResult.accepted).toBe(true);

            const response = await createPasskeyAuthResponse({
                request: createJsonRequest('/auth/passkey/login', {
                    username: 'alice',
                    credentialId: 'cred-login',
                }),
                persistence,
            });

            expect(response.status).toBe(200);
            const body = (await response.json()) as { ok: boolean; accountNameKey: string };
            expect(body.ok).toBe(true);
            expect(body.accountNameKey).toBe('alice');
            const setCookie = response.headers.get('set-cookie') ?? '';
            expect(setCookie).toContain(`${AUTH_SESSION_COOKIE_KEY}=`);
            expect(setCookie).toContain(`${ACCOUNT_COOKIE_KEY}=alice`);
        } finally {
            persistence.close();
        }
    });
});

test('passkey auth login endpoint rejects mismatched credentials', async () => {
    await withTempPlayerDb(async (dbPath) => {
        const persistence = new SqlitePlayerPersistence(dbPath);
        try {
            const registerResult = persistence.registerPasskeyCredential({
                requestedName: 'alice',
                credentialId: 'cred-ok',
            });
            expect(registerResult.accepted).toBe(true);

            const response = await createPasskeyAuthResponse({
                request: createJsonRequest('/auth/passkey/login', {
                    username: 'alice',
                    credentialId: 'cred-wrong',
                }),
                persistence,
            });

            expect(response.status).toBe(401);
            const body = (await response.json()) as { ok: boolean; reason: string };
            expect(body.ok).toBe(false);
            expect(body.reason).toContain('did not match');
        } finally {
            persistence.close();
        }
    });
});

test('passkey auth logout endpoint clears auth cookies', async () => {
    await withTempPlayerDb(async (dbPath) => {
        const persistence = new SqlitePlayerPersistence(dbPath);
        try {
            const response = await createPasskeyAuthResponse({
                request: createJsonRequest('/auth/passkey/logout', {}, 'POST'),
                persistence,
            });

            expect(response.status).toBe(200);
            const body = (await response.json()) as { ok: boolean };
            expect(body.ok).toBe(true);

            const setCookie = response.headers.get('set-cookie') ?? '';
            expect(setCookie).toContain(`${AUTH_SESSION_COOKIE_KEY}=`);
            expect(setCookie).toContain(`${ACCOUNT_COOKIE_KEY}=`);
            expect(setCookie).toContain(`${USERNAME_COOKIE_KEY}=`);
            expect(setCookie).toContain('Max-Age=0');
        } finally {
            persistence.close();
        }
    });
});

test('passkey auth endpoint rejects unsupported method and unknown path', async () => {
    await withTempPlayerDb(async (dbPath) => {
        const persistence = new SqlitePlayerPersistence(dbPath);
        try {
            const methodResponse = await createPasskeyAuthResponse({
                request: createJsonRequest('/auth/passkey/register', { username: 'alice', credentialId: 'cred' }, 'GET'),
                persistence,
            });
            expect(methodResponse.status).toBe(405);

            const notFoundResponse = await createPasskeyAuthResponse({
                request: createJsonRequest('/auth/passkey/unknown', { username: 'alice', credentialId: 'cred' }, 'POST'),
                persistence,
            });
            expect(notFoundResponse.status).toBe(404);
        } finally {
            persistence.close();
        }
    });
});
