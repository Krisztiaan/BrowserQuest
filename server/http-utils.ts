export function parseRequestPathname(requestUrl: string | undefined): string {
    try {
        return new URL(requestUrl ?? '/', 'http://localhost').pathname;
    } catch {
        return '/';
    }
}

export function parseCookieValue(cookieHeader: string | null | undefined, key: string): string | null {
    if (typeof cookieHeader !== 'string' || cookieHeader.length === 0) {
        return null;
    }

    const entries = cookieHeader.split(';');
    for (const rawEntry of entries) {
        const separatorIndex = rawEntry.indexOf('=');
        if (separatorIndex <= 0) {
            continue;
        }
        const entryKey = rawEntry.slice(0, separatorIndex).trim();
        if (entryKey !== key) {
            continue;
        }
        const rawValue = rawEntry.slice(separatorIndex + 1).trim();
        if (!rawValue) {
            return null;
        }
        try {
            const decoded = decodeURIComponent(rawValue).trim();
            return decoded.length > 0 ? decoded : null;
        } catch {
            return null;
        }
    }

    return null;
}

export default {
    parseRequestPathname,
    parseCookieValue,
};
