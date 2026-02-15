import {
    clearUsernameCookie,
    STORAGE_KEY,
    writeUsernameCookie,
} from './storage';

export type PasskeyAuthSuccess = Readonly<{
    ok: true;
    accountNameKey: string;
    displayName: string;
}>;

export type PasskeyAuthFailure = Readonly<{
    ok: false;
    reason: string;
}>;

export type PasskeyAuthResult = PasskeyAuthSuccess | PasskeyAuthFailure;

export type PasskeyLogoutResult = Readonly<{
    ok: boolean;
    reason?: string;
}>;

type AuthResponsePayload = Readonly<{
    ok?: unknown;
    reason?: unknown;
    accountNameKey?: unknown;
    displayName?: unknown;
}>;

function resolveString(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function toUserInput(value: string): string | null {
    return resolveString(value);
}

async function parseAuthResponse(response: Response): Promise<AuthResponsePayload> {
    try {
        return (await response.json()) as AuthResponsePayload;
    } catch {
        return {};
    }
}

function persistSignedInIdentity(accountNameKey: string, displayName: string): void {
    void accountNameKey;
    writeUsernameCookie(displayName);
    try {
        localStorage.setItem(STORAGE_KEY, displayName);
    } catch {
        // ignore unavailable storage
    }
}

function clearSignedInLocalIdentity(): void {
    clearUsernameCookie();
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch {
        // ignore unavailable storage
    }
}

async function sendPasskeyAuthRequest({
    pathname,
    username,
    credentialId,
}: {
    pathname: '/auth/passkey/register' | '/auth/passkey/login';
    username: string;
    credentialId: string;
}): Promise<PasskeyAuthResult> {
    const cleanUsername = toUserInput(username);
    if (!cleanUsername) {
        return { ok: false, reason: 'Username is required.' };
    }

    const cleanCredentialId = toUserInput(credentialId);
    if (!cleanCredentialId) {
        return { ok: false, reason: 'Passkey credential is required.' };
    }

    let response: Response;
    try {
        response = await fetch(pathname, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ username: cleanUsername, credentialId: cleanCredentialId }),
        });
    } catch {
        return {
            ok: false,
            reason: 'Network error while contacting auth endpoint.',
        };
    }

    const payload = await parseAuthResponse(response);
    if (!response.ok || payload.ok !== true) {
        return {
            ok: false,
            reason: resolveString(payload.reason) ?? `Auth request failed (${response.status}).`,
        };
    }

    const accountNameKey = resolveString(payload.accountNameKey);
    const displayName = resolveString(payload.displayName);
    if (!accountNameKey || !displayName) {
        return {
            ok: false,
            reason: 'Auth response is missing account identity fields.',
        };
    }

    persistSignedInIdentity(accountNameKey, displayName);
    return {
        ok: true,
        accountNameKey,
        displayName,
    };
}

export function registerWithPasskey(params: { username: string; credentialId: string }): Promise<PasskeyAuthResult> {
    return sendPasskeyAuthRequest({
        pathname: '/auth/passkey/register',
        username: params.username,
        credentialId: params.credentialId,
    });
}

export function loginWithPasskey(params: { username: string; credentialId: string }): Promise<PasskeyAuthResult> {
    return sendPasskeyAuthRequest({
        pathname: '/auth/passkey/login',
        username: params.username,
        credentialId: params.credentialId,
    });
}

export async function logoutPasskeySession(): Promise<PasskeyLogoutResult> {
    const response = await fetch('/auth/passkey/logout', {
        method: 'POST',
        credentials: 'same-origin',
    });
    const payload = await parseAuthResponse(response);
    if (!response.ok || payload.ok !== true) {
        return {
            ok: false,
            reason: resolveString(payload.reason) ?? `Logout failed (${response.status}).`,
        };
    }

    clearSignedInLocalIdentity();
    return { ok: true };
}
