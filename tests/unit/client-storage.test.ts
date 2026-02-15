import { afterEach, expect, test } from 'bun:test';
import Storage, {
    STORAGE_KEY,
    clearAccountCookie,
    readAccountCookie,
    readUsernameCookie,
    writeAccountCookie,
} from '../../client/storage';

const LEGACY_STORAGE_KEY = 'data';

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

const originalLocalStorage = globalThis.localStorage;
const originalDocument = globalThis.document;

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
});

test('storage persists username only in localStorage', () => {
    const mock = createLocalStorageMock();
    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        writable: true,
        value: mock,
    });

    const storage = new Storage();
    storage.initPlayer('K');
    storage.setPlayerArmor('goldenarmor');
    storage.setPlayerWeapon('goldensword');
    storage.incrementTotalKills();

    expect(mock.getItem(STORAGE_KEY)).toBe('K');
    expect(mock.getItem(LEGACY_STORAGE_KEY)).toBeNull();
});

test('storage migrates legacy profile blob to username-only key', () => {
    const mock = createLocalStorageMock();
    mock.setItem(
        LEGACY_STORAGE_KEY,
        JSON.stringify({
            hasAlreadyPlayed: true,
            player: {
                name: 'Legacy',
                weapon: 'redsword',
                armor: 'redarmor',
                image: 'legacy-image',
            },
            achievements: {
                unlocked: [1, 2, 9999],
            },
        })
    );

    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        writable: true,
        value: mock,
    });

    const storage = new Storage();
    expect(storage.hasAlreadyPlayed()).toBe(true);
    expect(storage.data.player.name).toBe('Legacy');
    expect(mock.getItem(STORAGE_KEY)).toBe('Legacy');
    expect(mock.getItem(LEGACY_STORAGE_KEY)).toBeNull();
    expect(storage.data.achievements.unlocked.includes(9999 as never)).toBe(false);
});

test('storage applies sanitized achievement progress snapshot from server', () => {
    const mock = createLocalStorageMock();
    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        writable: true,
        value: mock,
    });

    const storage = new Storage();
    storage.initPlayer('K');
    storage.applyAchievementProgressSnapshot({
        unlockedIds: [3, 13, 3, 9999],
        ratCount: 99,
        skeletonCount: 11,
        totalKills: 77,
        totalDmg: 7000,
        totalRevives: 8,
    });

    expect(storage.data.achievements.unlocked).toEqual([3, 13]);
    expect(storage.data.achievements.ratCount).toBe(10);
    expect(storage.data.achievements.skeletonCount).toBe(10);
    expect(storage.data.achievements.totalKills).toBe(50);
    expect(storage.data.achievements.totalDmg).toBe(5000);
    expect(storage.data.achievements.totalRevives).toBe(5);
    expect(mock.getItem(STORAGE_KEY)).toBe('K');
});

test('storage falls back to username cookie for returning bootstrap', () => {
    const mock = createLocalStorageMock();
    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        writable: true,
        value: mock,
    });
    Object.defineProperty(globalThis, 'document', {
        configurable: true,
        writable: true,
        value: { cookie: 'bq_username=CookieHero' },
    });

    const storage = new Storage();
    expect(storage.hasAlreadyPlayed()).toBe(true);
    expect(storage.data.player.name).toBe('CookieHero');
});

test('storage syncs username cookie on save and clear', () => {
    const mock = createLocalStorageMock();
    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        writable: true,
        value: mock,
    });
    Object.defineProperty(globalThis, 'document', {
        configurable: true,
        writable: true,
        value: { cookie: '' },
    });

    const storage = new Storage();
    storage.initPlayer('CookieSync');
    expect(readUsernameCookie()).toBe('CookieSync');

    storage.clear();
    expect(readUsernameCookie()).toBeNull();
});

test('account cookie helpers roundtrip sanitized names and clear properly', () => {
    Object.defineProperty(globalThis, 'document', {
        configurable: true,
        writable: true,
        value: { cookie: '' },
    });

    writeAccountCookie('  AccountHero  ');
    expect(readAccountCookie()).toBe('AccountHero');

    clearAccountCookie();
    expect(readAccountCookie()).toBeNull();
});
