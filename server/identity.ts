export type IdentityLike = Readonly<{
    accountNameKey?: string | null | undefined;
    name?: string | null | undefined;
}>;

export function normalizeIdentityKey(value: string): string {
    return value.trim().toLowerCase();
}

export function normalizeIdentityKeyOrNull(value: string | null | undefined): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const normalized = normalizeIdentityKey(value);
    return normalized.length > 0 ? normalized : null;
}

export function resolveIdentityKey(
    value: string | IdentityLike | null | undefined
): string | null {
    if (typeof value === 'string') {
        return normalizeIdentityKeyOrNull(value);
    }
    if (!value || typeof value !== 'object') {
        return null;
    }

    const accountNameKey = normalizeIdentityKeyOrNull(value.accountNameKey ?? null);
    if (accountNameKey !== null) {
        return accountNameKey;
    }
    return normalizeIdentityKeyOrNull(value.name ?? null);
}

export function normalizeIdentityKeyList(
    values: ReadonlyArray<string> | null | undefined,
    options?: { exclude?: string | null; maxItems?: number }
): string[] {
    if (!Array.isArray(values) || values.length === 0) {
        return [];
    }

    const excluded = normalizeIdentityKeyOrNull(options?.exclude ?? null);
    const maxItems =
        typeof options?.maxItems === 'number' && Number.isInteger(options.maxItems) && options.maxItems > 0
            ? options.maxItems
            : Number.POSITIVE_INFINITY;

    const out: string[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < values.length; i += 1) {
        const normalized = normalizeIdentityKeyOrNull(values[i]);
        if (normalized === null || normalized === excluded || seen.has(normalized)) {
            continue;
        }
        seen.add(normalized);
        out.push(normalized);
        if (out.length >= maxItems) {
            break;
        }
    }
    return out;
}
