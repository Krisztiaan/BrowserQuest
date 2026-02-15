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
    options?: unknown;
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

function encodeArrayBufferToBase64Url(value: ArrayBuffer): string {
    const bytes = new Uint8Array(value);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i]!);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64UrlToArrayBuffer(value: string): ArrayBuffer {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '==='.slice((normalized.length + 3) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
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

function supportsWebAuthn(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }
    if (typeof window.PublicKeyCredential === 'undefined') {
        return false;
    }
    const credentials = (navigator as Navigator | undefined)?.credentials;
    return !!credentials && typeof credentials.create === 'function' && typeof credentials.get === 'function';
}

async function postOptions(
    pathname: '/auth/passkey/register/options' | '/auth/passkey/login/options',
    username: string
): Promise<{ ok: true; options: unknown } | PasskeyAuthFailure> {
    let response: Response;
    try {
        response = await fetch(pathname, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ username }),
        });
    } catch {
        return { ok: false, reason: 'Network error while contacting auth endpoint.' };
    }

    const payload = await parseAuthResponse(response);
    if (!response.ok || payload.ok !== true) {
        return {
            ok: false,
            reason: resolveString(payload.reason) ?? `Auth request failed (${response.status}).`,
        };
    }

    return {
        ok: true,
        options: payload.options,
    };
}

async function postVerify(
    pathname: '/auth/passkey/register/verify' | '/auth/passkey/login/verify',
    username: string,
    responsePayload: unknown
): Promise<PasskeyAuthResult> {
    let response: Response;
    try {
        response = await fetch(pathname, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                username,
                response: responsePayload,
            }),
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

function parseCreationOptions(options: unknown): PublicKeyCredentialCreationOptions | null {
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
        return null;
    }
    const record = options as Record<string, unknown>;
    const challenge = resolveString(record.challenge);
    const user = record.user;
    if (!challenge || !user || typeof user !== 'object' || Array.isArray(user)) {
        return null;
    }

    const userRecord = user as Record<string, unknown>;
    const userId = resolveString(userRecord.id);
    if (!userId) {
        return null;
    }

    const excludeCredentials = Array.isArray(record.excludeCredentials)
        ? record.excludeCredentials
              .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object' && !Array.isArray(entry))
              .map((entry) => {
                  const id = resolveString(entry.id);
                  if (!id) {
                      return null;
                  }
                  return {
                      ...entry,
                      id: decodeBase64UrlToArrayBuffer(id),
                  } as PublicKeyCredentialDescriptor;
              })
              .filter((entry): entry is PublicKeyCredentialDescriptor => entry !== null)
        : [];

    return {
        ...(record as unknown as PublicKeyCredentialCreationOptions),
        challenge: decodeBase64UrlToArrayBuffer(challenge),
        user: {
            ...(userRecord as unknown as PublicKeyCredentialUserEntity),
            id: decodeBase64UrlToArrayBuffer(userId),
        },
        excludeCredentials,
    };
}

function parseRequestOptions(options: unknown): PublicKeyCredentialRequestOptions | null {
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
        return null;
    }
    const record = options as Record<string, unknown>;
    const challenge = resolveString(record.challenge);
    if (!challenge) {
        return null;
    }
    const allowCredentials = Array.isArray(record.allowCredentials)
        ? record.allowCredentials
              .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object' && !Array.isArray(entry))
              .map((entry) => {
                  const id = resolveString(entry.id);
                  if (!id) {
                      return null;
                  }
                  return {
                      ...entry,
                      id: decodeBase64UrlToArrayBuffer(id),
                  } as PublicKeyCredentialDescriptor;
              })
              .filter((entry): entry is PublicKeyCredentialDescriptor => entry !== null)
        : [];

    return {
        ...(record as unknown as PublicKeyCredentialRequestOptions),
        challenge: decodeBase64UrlToArrayBuffer(challenge),
        allowCredentials,
    };
}

function serializeRegistrationCredential(credential: PublicKeyCredential): unknown | null {
    const asJson = credential as PublicKeyCredential & { toJSON?: () => unknown };
    if (typeof asJson.toJSON === 'function') {
        return asJson.toJSON();
    }

    const response = credential.response;
    if (!(response instanceof AuthenticatorAttestationResponse)) {
        return null;
    }

    const transports = typeof response.getTransports === 'function' ? response.getTransports() : undefined;
    return {
        id: credential.id,
        rawId: encodeArrayBufferToBase64Url(credential.rawId),
        type: credential.type,
        authenticatorAttachment: credential.authenticatorAttachment ?? undefined,
        clientExtensionResults: credential.getClientExtensionResults(),
        response: {
            attestationObject: encodeArrayBufferToBase64Url(response.attestationObject),
            clientDataJSON: encodeArrayBufferToBase64Url(response.clientDataJSON),
            transports,
        },
    };
}

function serializeAuthenticationCredential(credential: PublicKeyCredential): unknown | null {
    const asJson = credential as PublicKeyCredential & { toJSON?: () => unknown };
    if (typeof asJson.toJSON === 'function') {
        return asJson.toJSON();
    }

    const response = credential.response;
    if (!(response instanceof AuthenticatorAssertionResponse)) {
        return null;
    }

    return {
        id: credential.id,
        rawId: encodeArrayBufferToBase64Url(credential.rawId),
        type: credential.type,
        authenticatorAttachment: credential.authenticatorAttachment ?? undefined,
        clientExtensionResults: credential.getClientExtensionResults(),
        response: {
            authenticatorData: encodeArrayBufferToBase64Url(response.authenticatorData),
            clientDataJSON: encodeArrayBufferToBase64Url(response.clientDataJSON),
            signature: encodeArrayBufferToBase64Url(response.signature),
            userHandle: response.userHandle ? encodeArrayBufferToBase64Url(response.userHandle) : null,
        },
    };
}

export async function registerWithPasskey(params: { username: string }): Promise<PasskeyAuthResult> {
    const cleanUsername = toUserInput(params.username);
    if (!cleanUsername) {
        return { ok: false, reason: 'Username is required.' };
    }
    if (!supportsWebAuthn()) {
        return { ok: false, reason: 'WebAuthn is not supported in this browser.' };
    }

    const optionsResult = await postOptions('/auth/passkey/register/options', cleanUsername);
    if (!optionsResult.ok) {
        return optionsResult;
    }

    const options = parseCreationOptions(optionsResult.options);
    if (!options) {
        return { ok: false, reason: 'Registration options payload is invalid.' };
    }

    let created: Credential | null;
    try {
        created = await navigator.credentials.create({ publicKey: options });
    } catch {
        return { ok: false, reason: 'Passkey registration was cancelled or failed.' };
    }
    if (!(created instanceof PublicKeyCredential)) {
        return { ok: false, reason: 'Passkey registration did not return a credential.' };
    }

    const credentialPayload = serializeRegistrationCredential(created);
    if (!credentialPayload) {
        return { ok: false, reason: 'Unable to serialize passkey registration credential.' };
    }

    return postVerify('/auth/passkey/register/verify', cleanUsername, credentialPayload);
}

export async function loginWithPasskey(params: { username: string }): Promise<PasskeyAuthResult> {
    const cleanUsername = toUserInput(params.username);
    if (!cleanUsername) {
        return { ok: false, reason: 'Username is required.' };
    }
    if (!supportsWebAuthn()) {
        return { ok: false, reason: 'WebAuthn is not supported in this browser.' };
    }

    const optionsResult = await postOptions('/auth/passkey/login/options', cleanUsername);
    if (!optionsResult.ok) {
        return optionsResult;
    }

    const options = parseRequestOptions(optionsResult.options);
    if (!options) {
        return { ok: false, reason: 'Authentication options payload is invalid.' };
    }

    let asserted: Credential | null;
    try {
        asserted = await navigator.credentials.get({ publicKey: options });
    } catch {
        return { ok: false, reason: 'Passkey authentication was cancelled or failed.' };
    }
    if (!(asserted instanceof PublicKeyCredential)) {
        return { ok: false, reason: 'Passkey authentication did not return a credential.' };
    }

    const credentialPayload = serializeAuthenticationCredential(asserted);
    if (!credentialPayload) {
        return { ok: false, reason: 'Unable to serialize passkey authentication credential.' };
    }

    return postVerify('/auth/passkey/login/verify', cleanUsername, credentialPayload);
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
