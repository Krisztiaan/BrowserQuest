export function formatUnknown(value: unknown): string {
    if (typeof value === 'string') {
        return value;
    }
    if (
        typeof value === 'number'
        || typeof value === 'boolean'
        || typeof value === 'bigint'
        || typeof value === 'symbol'
    ) {
        return String(value);
    }
    if (value === null) {
        return 'null';
    }
    if (value === undefined) {
        return 'undefined';
    }
    if (value instanceof Error) {
        return value.message;
    }
    try {
        const serialized = JSON.stringify(value);
        if (typeof serialized === 'string') {
            return serialized;
        }
    } catch {
        // fall through
    }
    return '[unserializable]';
}

export function toError(value: unknown): Error {
    return value instanceof Error ? value : new Error(formatUnknown(value));
}

export function joinFormattedArgs(args: ReadonlyArray<unknown>): string {
    return args.map((arg) => formatUnknown(arg)).join(' ');
}
