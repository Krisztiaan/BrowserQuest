declare module 'memjs' {
    export interface MemjsGetResult {
        value: Buffer | null;
        flags?: Buffer | null;
    }

    export class Client {
        static create(serversStr?: string, options?: object): Client;
        get(key: string): Promise<MemjsGetResult>;
        set(key: string, value: string | Buffer, options?: object): Promise<boolean>;
        close(): void;
    }
}
