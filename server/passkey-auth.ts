import {
    ACCOUNT_COOKIE_KEY,
    AUTH_COOKIE_MAX_AGE_SECONDS,
    AUTH_SESSION_COOKIE_KEY,
    USERNAME_COOKIE_KEY,
} from '../shared/auth/cookie-keys';
import type { SqlitePlayerPersistence } from './player-persistence';
import { createSignedAuthSessionToken } from './auth-session';

type PasskeyAuthPersistence = Pick<SqlitePlayerPersistence, 'registerPasskeyCredential' | 'authenticatePasskeyCredential'>;

type PasskeyAuthPayload = Readonly<{
    username: string;
    credentialId: string;
}>;

function parseRequestPathname(requestUrl: string | undefined): string {
    try {
        return new URL(requestUrl ?? '/', 'http://localhost').pathname;
    } catch {
        return '/';
    }
}

function buildCookie({
    name,
    value,
    maxAge,
    httpOnly = false,
}: {
    name: string;
    value: string;
    maxAge: number;
    httpOnly?: boolean;
}): string {
    const base = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
    return httpOnly ? `${base}; HttpOnly` : base;
}

function createAuthSuccessCookies(accountNameKey: string, displayName: string): string[] {
    const sessionToken = createSignedAuthSessionToken({ accountNameKey });
    return [
        buildCookie({
            name: AUTH_SESSION_COOKIE_KEY,
            value: sessionToken,
            maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
            httpOnly: true,
        }),
        buildCookie({
            name: ACCOUNT_COOKIE_KEY,
            value: accountNameKey,
            maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
            httpOnly: true,
        }),
        buildCookie({
            name: USERNAME_COOKIE_KEY,
            value: displayName,
            maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
        }),
    ];
}

function createAuthClearCookies(): string[] {
    return [
        buildCookie({
            name: AUTH_SESSION_COOKIE_KEY,
            value: '',
            maxAge: 0,
            httpOnly: true,
        }),
        buildCookie({
            name: ACCOUNT_COOKIE_KEY,
            value: '',
            maxAge: 0,
            httpOnly: true,
        }),
        buildCookie({
            name: USERNAME_COOKIE_KEY,
            value: '',
            maxAge: 0,
        }),
    ];
}

function createJsonResponse({
    status,
    payload,
    cookies,
}: {
    status: number;
    payload: unknown;
    cookies?: ReadonlyArray<string>;
}): Response {
    const headers = new Headers({
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0',
    });
    for (const cookie of cookies ?? []) {
        headers.append('Set-Cookie', cookie);
    }
    return new Response(JSON.stringify(payload), { status, headers });
}

async function parsePasskeyAuthPayload(request: Request): Promise<PasskeyAuthPayload | null> {
    let parsed: unknown;
    try {
        parsed = await request.json();
    } catch {
        return null;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null;
    }
    const record = parsed as Record<string, unknown>;
    const username = typeof record.username === 'string' ? record.username : '';
    const credentialId = typeof record.credentialId === 'string' ? record.credentialId : '';
    return {
        username,
        credentialId,
    };
}

function resolveFailedAuthStatus(pathname: string): number {
    if (pathname === '/auth/passkey/login') {
        return 401;
    }
    return 400;
}

export async function createPasskeyAuthResponse({
    request,
    persistence,
}: {
    request: Request;
    persistence: PasskeyAuthPersistence;
}): Promise<Response> {
    const pathname = parseRequestPathname(request.url);

    if (pathname === '/auth/passkey/logout') {
        if (request.method !== 'POST') {
            return createJsonResponse({ status: 405, payload: { ok: false, reason: 'Method not allowed.' } });
        }
        return createJsonResponse({
            status: 200,
            payload: { ok: true },
            cookies: createAuthClearCookies(),
        });
    }

    if (pathname !== '/auth/passkey/register' && pathname !== '/auth/passkey/login') {
        return createJsonResponse({ status: 404, payload: { ok: false, reason: 'Not found.' } });
    }

    if (request.method !== 'POST') {
        return createJsonResponse({ status: 405, payload: { ok: false, reason: 'Method not allowed.' } });
    }

    const payload = await parsePasskeyAuthPayload(request);
    if (!payload) {
        return createJsonResponse({ status: 400, payload: { ok: false, reason: 'Invalid JSON payload.' } });
    }

    const result =
        pathname === '/auth/passkey/register'
            ? persistence.registerPasskeyCredential({
                  requestedName: payload.username,
                  credentialId: payload.credentialId,
              })
            : persistence.authenticatePasskeyCredential({
                  requestedName: payload.username,
                  credentialId: payload.credentialId,
              });

    if (!result.accepted) {
        return createJsonResponse({
            status: resolveFailedAuthStatus(pathname),
            payload: { ok: false, reason: result.reason },
        });
    }

    return createJsonResponse({
        status: 200,
        payload: {
            ok: true,
            accountNameKey: result.accountNameKey,
            displayName: result.profile.displayName,
        },
        cookies: createAuthSuccessCookies(result.accountNameKey, result.profile.displayName),
    });
}
