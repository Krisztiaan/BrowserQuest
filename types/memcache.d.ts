declare module 'memcache' {
    export class Memcache {
        constructor(endpoint: string);
        on?(event: string, listener: (...args: unknown[]) => void): void;
        connect(): unknown;
        set(key: string, value: unknown): unknown;
        get(key: string): unknown;
    }

    const memcacheDefault: typeof Memcache;
    export default memcacheDefault;
}

