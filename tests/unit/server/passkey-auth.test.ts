import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SqlitePlayerPersistence } from '../../../server/player-persistence';
import { createPasskeyAuthResponse } from '../../../server/passkey-auth';
import { ACCOUNT_COOKIE_KEY, AUTH_SESSION_COOKIE_KEY, USERNAME_COOKIE_KEY } from '../../../shared/auth/cookie-keys';
type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

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

function createJsonRequest(pathname: string, payload: JsonValue, method = 'POST', origin = 'http://localhost'): Request {
    return new Request(`${origin}${pathname}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
}

test('passkey auth register options endpoint returns options payload', async () => {
    await withTempPlayerDb(async (dbPath) => {
        const persistence = new SqlitePlayerPersistence(dbPath);
        try {
            const response = await createPasskeyAuthResponse({
                request: createJsonRequest('/auth/passkey/register/options', {
                    username: 'Alice',
                }),
                persistence,
            });

            expect(response.status).toBe(200);
            const body = (await response.json()) as { ok: boolean; options?: { challenge?: string; user?: { name?: string } } };
            expect(body.ok).toBe(true);
            expect(typeof body.options?.challenge).toBe('string');
            expect(body.options?.user?.name).toBe('alice');
        } finally {
            persistence.close();
        }
    });
});

test('passkey auth register verify endpoint validates challenge and sets auth cookies', async () => {
    await withTempPlayerDb(async (dbPath) => {
        const persistence = new SqlitePlayerPersistence(dbPath);
        try {
            const optionsResponse = await createPasskeyAuthResponse({
                request: createJsonRequest('/auth/passkey/register/options', {
                    username: 'Alice',
                }),
                persistence,
                dependencies: {
                    generateRegistrationOptionsFn: async () =>
                        ({
                            challenge: 'challenge-register',
                            rp: { name: 'BrowserQuest', id: 'localhost' },
                            user: { id: 'AQ', name: 'alice', displayName: 'Alice' },
                            pubKeyCredParams: [],
                        }) as never,
                },
            });
            expect(optionsResponse.status).toBe(200);

            const response = await createPasskeyAuthResponse({
                request: createJsonRequest('/auth/passkey/register/verify', {
                    username: 'Alice',
                    response: {
                        id: 'cred-1',
                        type: 'public-key',
                        rawId: 'AQ',
                        response: {
                            attestationObject: 'AQ',
                            clientDataJSON: 'AQ',
                        },
                    },
                }),
                persistence,
                dependencies: {
                    verifyRegistrationResponseFn: async () =>
                        ({
                            verified: true,
                            registrationInfo: {
                                credential: {
                                    id: 'cred-1',
                                    publicKey: new Uint8Array([1, 2, 3, 4]),
                                    counter: 7,
                                    transports: ['internal'],
                                },
                            },
                        }) as never,
                },
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

            const stored = persistence.getPasskeyCredentialByCredentialId('cred-1');
            expect(stored).not.toBeNull();
            expect(stored?.accountNameKey).toBe('alice');
            expect(stored?.counter).toBe(7);
        } finally {
            persistence.close();
        }
    });
});

test('passkey auth login verify endpoint validates credential and sets auth cookies', async () => {
    await withTempPlayerDb(async (dbPath) => {
        const persistence = new SqlitePlayerPersistence(dbPath);
        try {
            const registerResult = persistence.registerPasskeyCredential({
                requestedName: 'alice',
                credentialId: 'cred-login',
                credentialPublicKey: new Uint8Array([9, 9, 9]),
                counter: 2,
                transports: ['internal'],
            });
            expect(registerResult.accepted).toBe(true);

            const optionsResponse = await createPasskeyAuthResponse({
                request: createJsonRequest('/auth/passkey/login/options', {
                    username: 'alice',
                }),
                persistence,
                dependencies: {
                    generateAuthenticationOptionsFn: async () =>
                        ({
                            challenge: 'challenge-login',
                            rpId: 'localhost',
                            allowCredentials: [{ id: 'cred-login', type: 'public-key' }],
                        }) as never,
                },
            });
            expect(optionsResponse.status).toBe(200);

            const response = await createPasskeyAuthResponse({
                request: createJsonRequest('/auth/passkey/login/verify', {
                    username: 'alice',
                    response: {
                        id: 'cred-login',
                        type: 'public-key',
                        rawId: 'AQ',
                        response: {
                            authenticatorData: 'AQ',
                            clientDataJSON: 'AQ',
                            signature: 'AQ',
                            userHandle: null,
                        },
                    },
                }),
                persistence,
                dependencies: {
                    verifyAuthenticationResponseFn: async () =>
                        ({
                            verified: true,
                            authenticationInfo: {
                                newCounter: 11,
                            },
                        }) as never,
                },
            });

            expect(response.status).toBe(200);
            const body = (await response.json()) as { ok: boolean; accountNameKey: string };
            expect(body.ok).toBe(true);
            expect(body.accountNameKey).toBe('alice');
            const setCookie = response.headers.get('set-cookie') ?? '';
            expect(setCookie).toContain(`${AUTH_SESSION_COOKIE_KEY}=`);
            expect(setCookie).toContain(`${ACCOUNT_COOKIE_KEY}=alice`);
            expect(persistence.getPasskeyCredentialByCredentialId('cred-login')?.counter).toBe(11);
        } finally {
            persistence.close();
        }
    });
});

test('passkey auth login verify endpoint rejects mismatched credentials', async () => {
    await withTempPlayerDb(async (dbPath) => {
        const persistence = new SqlitePlayerPersistence(dbPath);
        try {
            const registerResult = persistence.registerPasskeyCredential({
                requestedName: 'alice',
                credentialId: 'cred-ok',
                credentialPublicKey: new Uint8Array([4, 5, 6]),
            });
            expect(registerResult.accepted).toBe(true);

            const optionsResponse = await createPasskeyAuthResponse({
                request: createJsonRequest('/auth/passkey/login/options', {
                    username: 'alice',
                }),
                persistence,
                dependencies: {
                    generateAuthenticationOptionsFn: async () =>
                        ({
                            challenge: 'challenge-login',
                            rpId: 'localhost',
                            allowCredentials: [{ id: 'cred-ok', type: 'public-key' }],
                        }) as never,
                },
            });
            expect(optionsResponse.status).toBe(200);

            const response = await createPasskeyAuthResponse({
                request: createJsonRequest('/auth/passkey/login/verify', {
                    username: 'alice',
                    response: {
                        id: 'cred-wrong',
                        type: 'public-key',
                        rawId: 'AQ',
                        response: {
                            authenticatorData: 'AQ',
                            clientDataJSON: 'AQ',
                            signature: 'AQ',
                            userHandle: null,
                        },
                    },
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

test('passkey auth cookies include Secure on HTTPS requests', async () => {
    await withTempPlayerDb(async (dbPath) => {
        const persistence = new SqlitePlayerPersistence(dbPath);
        try {
            const response = await createPasskeyAuthResponse({
                request: createJsonRequest('/auth/passkey/logout', {}, 'POST', 'https://localhost'),
                persistence,
            });

            expect(response.status).toBe(200);
            const setCookie = response.headers.get('set-cookie') ?? '';
            expect(setCookie).toContain('Secure');
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
                request: createJsonRequest('/auth/passkey/register/options', { username: 'alice' }, 'GET'),
                persistence,
            });
            expect(methodResponse.status).toBe(405);

            const notFoundResponse = await createPasskeyAuthResponse({
                request: createJsonRequest('/auth/passkey/unknown', { username: 'alice' }, 'POST'),
                persistence,
            });
            expect(notFoundResponse.status).toBe(404);
        } finally {
            persistence.close();
        }
    });
});
