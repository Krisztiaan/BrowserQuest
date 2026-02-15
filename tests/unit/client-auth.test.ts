import { afterEach, expect, test } from 'bun:test';
import { loginWithPasskey, logoutPasskeySession, registerWithPasskey } from '../../client/auth';
import {
    STORAGE_KEY,
    readUsernameCookie,
    writeUsernameCookie,
} from '../../client/storage';

type LocalStorageLike = {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
    clear(): void;
};

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
            if (!nameValue || !nameValue.includes('=')) {
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

const originalLocalStorage = globalThis.localStorage;
const originalDocument = globalThis.document;
const originalFetch = globalThis.fetch;

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
});

test('registerWithPasskey posts auth payload and persists local username identity', async () => {
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

    const fetchCalls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        writable: true,
        value: async (input: RequestInfo | URL, init?: RequestInit) => {
            fetchCalls.push({ input, init });
            return new Response(
                JSON.stringify({
                    ok: true,
                    accountNameKey: 'alice',
                    displayName: 'Alice',
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
        },
    });

    const result = await registerWithPasskey({ username: ' Alice ', credentialId: 'cred-1' });
    expect(result).toEqual({
        ok: true,
        accountNameKey: 'alice',
        displayName: 'Alice',
    });
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]?.input).toBe('/auth/passkey/register');
    expect(fetchCalls[0]?.init?.method).toBe('POST');
    expect(fetchCalls[0]?.init?.credentials).toBe('same-origin');
    expect(JSON.parse(String(fetchCalls[0]?.init?.body))).toEqual({
        username: 'Alice',
        credentialId: 'cred-1',
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

    Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        writable: true,
        value: async () =>
            new Response(JSON.stringify({ ok: false, reason: 'Credential did not match username.' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            }),
    });

    const result = await loginWithPasskey({ username: 'alice', credentialId: 'wrong-cred' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
        expect(result.reason).toContain('Credential did not match');
    }
    expect(readUsernameCookie()).toBeNull();
    expect(localStorageMock.getItem(STORAGE_KEY)).toBeNull();
});

test('passkey auth helpers validate required inputs before hitting network', async () => {
    let fetchCalls = 0;
    Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        writable: true,
        value: async () => {
            fetchCalls += 1;
            return new Response();
        },
    });

    const noUsername = await registerWithPasskey({ username: '   ', credentialId: 'cred-1' });
    expect(noUsername).toEqual({ ok: false, reason: 'Username is required.' });
    const noCredential = await loginWithPasskey({ username: 'alice', credentialId: '   ' });
    expect(noCredential).toEqual({ ok: false, reason: 'Passkey credential is required.' });
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
        value: async (input: RequestInfo | URL, init?: RequestInit) => {
            fetchCalls.push({ input, init });
            return new Response(JSON.stringify({ ok: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
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
    Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        writable: true,
        value: async () => {
            throw new Error('socket hang up');
        },
    });

    const result = await loginWithPasskey({ username: 'alice', credentialId: 'cred-1' });
    expect(result).toEqual({
        ok: false,
        reason: 'Network error while contacting auth endpoint.',
    });
});
