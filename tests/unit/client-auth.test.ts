import { afterEach, expect, test } from 'bun:test';
import { loginWithPasskey, logoutPasskeySession, registerWithPasskey } from '../../client/auth';
import { STORAGE_KEY, readUsernameCookie, writeUsernameCookie } from '../../client/storage';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

type LocalStorageLike = {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
    clear(): void;
};

function resolveRequestPathname(input: RequestInfo | URL): string {
    if (typeof input === 'string') {
        return input;
    }
    if (input instanceof URL) {
        return input.toString();
    }
    if (input instanceof Request) {
        return input.url;
    }
    return '';
}

function parseJsonBodyValue(value: BodyInit | null | undefined): JsonValue {
    if (typeof value !== 'string') {
        throw new Error('Expected a JSON string body.');
    }
    return JSON.parse(value) as JsonValue;
}

function createLocalStorageMock(): LocalStorageLike {
    const store = new Map<string, string>();
    return {
        getItem(key: string): string | null {
            return store.has(key) ? (store.get(key) ?? null) : null;
        },
        setItem(key: string, value: string): void {
            store.set(key, String(value));
        },
        removeItem(key: string): void {
            store.delete(key);
        },
        clear(): void {
            store.clear();
        },
    };
}

function createDocumentCookieMock(): Document {
    const jar = new Map<string, string>();
    const doc = {};
    Object.defineProperty(doc, 'cookie', {
        configurable: true,
        get() {
            return Array.from(jar.entries())
                .map(([key, value]) => `${key}=${value}`)
                .join('; ');
        },
        set(value: string) {
            const parts = value.split(';').map((part) => part.trim());
            const [nameValue, ...attributes] = parts;
            if (!nameValue?.includes('=')) {
                return;
            }
            const separator = nameValue.indexOf('=');
            const name = nameValue.slice(0, separator);
            const rawValue = nameValue.slice(separator + 1);
            if (!name) {
                return;
            }

            const maxAgeAttr = attributes.find((attr) => attr.toLowerCase().startsWith('max-age='));
            const maxAge = maxAgeAttr ? Number(maxAgeAttr.slice('max-age='.length)) : Number.NaN;
            if (Number.isFinite(maxAge) && maxAge <= 0) {
                jar.delete(name);
                return;
            }
            jar.set(name, rawValue);
        },
    });
    return doc as Document;
}

class FakePublicKeyCredential {
    id: string;
    rawId: ArrayBuffer;
    type: PublicKeyCredentialType;
    authenticatorAttachment: AuthenticatorAttachment | null;
    response: AuthenticatorResponse;
    private readonly jsonValue: JsonValue;

    constructor(jsonValue: JsonValue) {
        this.id = 'fake-credential-id';
        this.rawId = new Uint8Array([1]).buffer;
        this.type = 'public-key';
        this.authenticatorAttachment = null;
        this.response = {} as AuthenticatorResponse;
        this.jsonValue = jsonValue;
    }

    getClientExtensionResults(): AuthenticationExtensionsClientOutputs {
        return {};
    }

    toJSON(): JsonValue {
        return this.jsonValue;
    }
}

const originalLocalStorage = globalThis.localStorage;
const originalDocument = globalThis.document;
const originalFetch = globalThis.fetch;
const originalNavigator = globalThis.navigator;
const originalWindow = globalThis.window;
const originalPublicKeyCredential = globalThis.PublicKeyCredential;

function installWebAuthnMocks({
    createResult,
    getResult,
}: {
    createResult?: Credential | null;
    getResult?: Credential | null;
}): void {
    const credentialClass = FakePublicKeyCredential as typeof PublicKeyCredential;
    const win = (originalWindow as { PublicKeyCredential?: typeof PublicKeyCredential } | undefined) ?? {};
    const windowWithCredential = win as {
        PublicKeyCredential?: typeof PublicKeyCredential;
    };
    windowWithCredential.PublicKeyCredential = credentialClass;

    Object.defineProperty(globalThis, 'window', {
        configurable: true,
        writable: true,
        value: windowWithCredential,
    });
    Object.defineProperty(globalThis, 'PublicKeyCredential', {
        configurable: true,
        writable: true,
        value: credentialClass,
    });
    Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        writable: true,
        value: {
            credentials: {
                create: () => Promise.resolve(createResult ?? null),
                get: () => Promise.resolve(getResult ?? null),
            },
        },
    });
}

afterEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        writable: true,
        value: originalLocalStorage,
    });
    Object.defineProperty(globalThis, 'document', {
        configurable: true,
        writable: true,
        value: originalDocument,
    });
    Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        writable: true,
        value: originalFetch,
    });
    Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        writable: true,
        value: originalNavigator,
    });
    Object.defineProperty(globalThis, 'window', {
        configurable: true,
        writable: true,
        value: originalWindow,
    });
    Object.defineProperty(globalThis, 'PublicKeyCredential', {
        configurable: true,
        writable: true,
        value: originalPublicKeyCredential,
    });
});

test('registerWithPasskey runs options+verify flow and persists local username identity', async () => {
    const localStorageMock = createLocalStorageMock();
    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        writable: true,
        value: localStorageMock,
    });
    Object.defineProperty(globalThis, 'document', {
        configurable: true,
        writable: true,
        value: createDocumentCookieMock(),
    });

    installWebAuthnMocks({
        createResult: new FakePublicKeyCredential({
            id: 'cred-1',
            type: 'public-key',
            rawId: 'AQ',
            response: {
                attestationObject: 'AQ',
                clientDataJSON: 'AQ',
            },
        }) as Credential,
    });

    const fetchCalls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        writable: true,
        value: (input: RequestInfo | URL, init?: RequestInit) => {
            fetchCalls.push({ input, init });
            const pathname = resolveRequestPathname(input);
            if (pathname === '/auth/passkey/register/options') {
                return Promise.resolve(
                    new Response(
                        JSON.stringify({
                            ok: true,
                            options: {
                                challenge: 'AQ',
                                rp: { name: 'BrowserQuest', id: 'localhost' },
                                user: {
                                    id: 'AQ',
                                    name: 'alice',
                                    displayName: 'Alice',
                                },
                                pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
                                excludeCredentials: [],
                            },
                        }),
                        { status: 200, headers: { 'Content-Type': 'application/json' } }
                    )
                );
            }
            if (pathname === '/auth/passkey/register/verify') {
                return Promise.resolve(
                    new Response(
                        JSON.stringify({
                            ok: true,
                            accountNameKey: 'alice',
                            displayName: 'Alice',
                        }),
                        { status: 200, headers: { 'Content-Type': 'application/json' } }
                    )
                );
            }
            return Promise.resolve(
                new Response(JSON.stringify({ ok: false, reason: 'unexpected endpoint' }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' },
                })
            );
        },
    });

    const result = await registerWithPasskey({ username: ' Alice ' });
    expect(result).toEqual({
        ok: true,
        accountNameKey: 'alice',
        displayName: 'Alice',
    });

    expect(fetchCalls).toHaveLength(2);
    expect(fetchCalls[0]?.input).toBe('/auth/passkey/register/options');
    expect(fetchCalls[0]?.init?.method).toBe('POST');
    expect(fetchCalls[0]?.init?.credentials).toBe('same-origin');
    expect(parseJsonBodyValue(fetchCalls[0]?.init?.body)).toEqual({
        username: 'Alice',
    });
    expect(fetchCalls[1]?.input).toBe('/auth/passkey/register/verify');
    expect(parseJsonBodyValue(fetchCalls[1]?.init?.body)).toEqual({
        username: 'Alice',
        response: {
            id: 'cred-1',
            rawId: 'AQ',
            response: {
                attestationObject: 'AQ',
                clientDataJSON: 'AQ',
            },
            type: 'public-key',
        },
    });

    expect(readUsernameCookie()).toBe('Alice');
    expect(localStorageMock.getItem(STORAGE_KEY)).toBe('Alice');
});

test('loginWithPasskey returns request failures without mutating local identity', async () => {
    const localStorageMock = createLocalStorageMock();
    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        writable: true,
        value: localStorageMock,
    });
    Object.defineProperty(globalThis, 'document', {
        configurable: true,
        writable: true,
        value: createDocumentCookieMock(),
    });

    installWebAuthnMocks({
        getResult: new FakePublicKeyCredential({
            id: 'cred-wrong',
            type: 'public-key',
            rawId: 'AQ',
            response: {
                authenticatorData: 'AQ',
                clientDataJSON: 'AQ',
                signature: 'AQ',
                userHandle: null,
            },
        }) as Credential,
    });

    Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        writable: true,
        value: (input: RequestInfo | URL) => {
            const pathname = resolveRequestPathname(input);
            if (pathname === '/auth/passkey/login/options') {
                return Promise.resolve(
                    new Response(
                        JSON.stringify({
                            ok: true,
                            options: {
                                challenge: 'AQ',
                                rpId: 'localhost',
                                allowCredentials: [{ id: 'AQ', type: 'public-key' }],
                            },
                        }),
                        { status: 200, headers: { 'Content-Type': 'application/json' } }
                    )
                );
            }
            return Promise.resolve(
                new Response(JSON.stringify({ ok: false, reason: 'Passkey assertion did not match this account.' }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' },
                })
            );
        },
    });

    const result = await loginWithPasskey({ username: 'alice' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
        expect(result.reason).toContain('did not match');
    }
    expect(readUsernameCookie()).toBeNull();
    expect(localStorageMock.getItem(STORAGE_KEY)).toBeNull();
});

test('passkey auth helpers validate required inputs before hitting network', async () => {
    let fetchCalls = 0;
    Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        writable: true,
        value: () => {
            fetchCalls += 1;
            return Promise.resolve(new Response());
        },
    });

    const noRegisterUsername = await registerWithPasskey({ username: '   ' });
    expect(noRegisterUsername).toEqual({ ok: false, reason: 'Username is required.' });
    const noLoginUsername = await loginWithPasskey({ username: '   ' });
    expect(noLoginUsername).toEqual({ ok: false, reason: 'Username is required.' });
    expect(fetchCalls).toBe(0);
});

test('logoutPasskeySession posts logout and clears local identity state', async () => {
    const localStorageMock = createLocalStorageMock();
    localStorageMock.setItem(STORAGE_KEY, 'Hero');
    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        writable: true,
        value: localStorageMock,
    });
    Object.defineProperty(globalThis, 'document', {
        configurable: true,
        writable: true,
        value: createDocumentCookieMock(),
    });
    writeUsernameCookie('Hero');

    const fetchCalls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        writable: true,
        value: (input: RequestInfo | URL, init?: RequestInit) => {
            fetchCalls.push({ input, init });
            return Promise.resolve(
                new Response(JSON.stringify({ ok: true }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                })
            );
        },
    });

    const result = await logoutPasskeySession();
    expect(result).toEqual({ ok: true });
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]?.input).toBe('/auth/passkey/logout');
    expect(fetchCalls[0]?.init?.method).toBe('POST');
    expect(fetchCalls[0]?.init?.credentials).toBe('same-origin');
    expect(readUsernameCookie()).toBeNull();
    expect(localStorageMock.getItem(STORAGE_KEY)).toBeNull();
});

test('loginWithPasskey surfaces network failures as deterministic auth errors', async () => {
    installWebAuthnMocks({
        getResult: new FakePublicKeyCredential({
            id: 'cred-1',
            type: 'public-key',
            rawId: 'AQ',
            response: {
                authenticatorData: 'AQ',
                clientDataJSON: 'AQ',
                signature: 'AQ',
                userHandle: null,
            },
        }) as Credential,
    });

    Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        writable: true,
        value: () => Promise.reject(new Error('socket hang up')),
    });

    const result = await loginWithPasskey({ username: 'alice' });
    expect(result).toEqual({
        ok: false,
        reason: 'Network error while contacting auth endpoint.',
    });
});
