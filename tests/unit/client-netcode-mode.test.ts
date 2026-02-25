import { afterEach, expect, test } from 'bun:test';
import { resolveClientMovementNetcodeMode } from '../../client/netcode-mode';

type MutableGlobals = typeof globalThis & {
    __BQ_NETCODE_MODE__?: string;
};

const globals = globalThis as MutableGlobals;
const originalGlobalMode = globals.__BQ_NETCODE_MODE__;
const originalLocationDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'location');
const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

function setLocationHref(href: string): void {
    Object.defineProperty(globalThis, 'location', {
        configurable: true,
        value: { href },
    });
}

function setLocalStorageGetItem(getItem: (key: string) => string | null): void {
    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: { getItem } satisfies Pick<Storage, 'getItem'>,
    });
}

afterEach(() => {
    if (originalLocationDescriptor) {
        Object.defineProperty(globalThis, 'location', originalLocationDescriptor);
    } else {
        Reflect.deleteProperty(globalThis, 'location');
    }

    if (originalLocalStorageDescriptor) {
        Object.defineProperty(globalThis, 'localStorage', originalLocalStorageDescriptor);
    } else {
        Reflect.deleteProperty(globalThis, 'localStorage');
    }

    if (originalGlobalMode === undefined) {
        delete globals.__BQ_NETCODE_MODE__;
    } else {
        globals.__BQ_NETCODE_MODE__ = originalGlobalMode;
    }
});

test('resolveClientMovementNetcodeMode defaults to predictive', () => {
    setLocationHref('https://example.invalid/');
    setLocalStorageGetItem(() => null);
    delete globals.__BQ_NETCODE_MODE__;

    expect(resolveClientMovementNetcodeMode()).toBe('predictive');
});

test('resolveClientMovementNetcodeMode reads lockstep from query string', () => {
    setLocationHref('https://example.invalid/?netcode=lockstep');
    setLocalStorageGetItem(() => 'predictive');
    delete globals.__BQ_NETCODE_MODE__;

    expect(resolveClientMovementNetcodeMode()).toBe('lockstep');
});

test('resolveClientMovementNetcodeMode reads mode from localStorage when query is absent', () => {
    setLocationHref('https://example.invalid/');
    setLocalStorageGetItem((key) => (key === 'bq_netcode_mode' ? 'lockstep' : null));
    delete globals.__BQ_NETCODE_MODE__;

    expect(resolveClientMovementNetcodeMode()).toBe('lockstep');
});

test('resolveClientMovementNetcodeMode prioritizes global override over query/localStorage', () => {
    setLocationHref('https://example.invalid/?netcode=predictive');
    setLocalStorageGetItem((key) => (key === 'bq_netcode_mode' ? 'predictive' : null));
    globals.__BQ_NETCODE_MODE__ = 'lockstep';

    expect(resolveClientMovementNetcodeMode()).toBe('lockstep');
});
