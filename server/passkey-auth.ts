import {
    generateAuthenticationOptions,
    generateRegistrationOptions,
    verifyAuthenticationResponse,
    verifyRegistrationResponse,
    type AuthenticationResponseJSON,
    type AuthenticatorTransportFuture,
    type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import {
    ACCOUNT_COOKIE_KEY,
    AUTH_COOKIE_MAX_AGE_SECONDS,
    AUTH_SESSION_COOKIE_KEY,
    USERNAME_COOKIE_KEY,
} from '../shared/auth/cookie-keys';
import type { SqlitePlayerPersistence } from './player-persistence';
import { createSignedAuthSessionToken } from './auth-session';
import { parseRequestPathname } from './http-utils';
import { normalizeIdentityKey } from './identity';

type PasskeyAuthPersistence = Pick<
    SqlitePlayerPersistence,
    | 'registerPasskeyCredential'
    | 'authenticatePasskeyCredential'
    | 'listPasskeyCredentialsByName'
    | 'getPasskeyCredentialByCredentialId'
>;

type PasskeyAuthOptionsPayload = Readonly<{
    username: string;
}>;

type PasskeyRegisterVerifyPayload = Readonly<{
    username: string;
    response: RegistrationResponseJSON;
}>;

type PasskeyLoginVerifyPayload = Readonly<{
    username: string;
    response: AuthenticationResponseJSON;
}>;

type PendingChallenge = Readonly<{
    challenge: string;
    rpId: string;
    expectedOrigins: string[];
    expiresAtMs: number;
}>;

type PasskeyAuthDependencies = Readonly<{
    nowMs?: () => number;
    generateRegistrationOptionsFn?: typeof generateRegistrationOptions;
    generateAuthenticationOptionsFn?: typeof generateAuthenticationOptions;
    verifyRegistrationResponseFn?: typeof verifyRegistrationResponse;
    verifyAuthenticationResponseFn?: typeof verifyAuthenticationResponse;
}>;

const DEFAULT_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const pendingRegisterChallenges = new Map<string, PendingChallenge>();
const pendingLoginChallenges = new Map<string, PendingChallenge>();
const textEncoder = new TextEncoder();
type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
type JsonRecord = Record<string, JsonValue>;
type LooseValue = string | number | boolean | null | undefined | object;
type ResponsePayload = JsonPrimitive | object;

function resolveString(value: LooseValue): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function resolveOriginsFromRequest(request: Request): { origin: string; hostname: string } {
    try {
        const url = new URL(request.url);
        return {
            origin: url.origin,
            hostname: url.hostname,
        };
    } catch {
        return {
            origin: 'http://localhost',
            hostname: 'localhost',
        };
    }
}

function resolveRelyingPartyId(request: Request): string {
    const envValue = resolveString(process.env.BQ_WEBAUTHN_RP_ID);
    if (envValue) {
        return envValue;
    }
    return resolveOriginsFromRequest(request).hostname;
}

function resolveExpectedOrigins(request: Request): string[] {
    const envValue = resolveString(process.env.BQ_WEBAUTHN_EXPECTED_ORIGINS);
    if (!envValue) {
        return [resolveOriginsFromRequest(request).origin];
    }
    const out: string[] = [];
    for (const raw of envValue.split(',')) {
        const trimmed = raw.trim();
        if (trimmed.length > 0 && !out.includes(trimmed)) {
            out.push(trimmed);
        }
    }
    return out.length > 0 ? out : [resolveOriginsFromRequest(request).origin];
}

function resolveRelyingPartyName(): string {
    return resolveString(process.env.BQ_WEBAUTHN_RP_NAME) ?? 'BrowserQuest';
}

function isSecureRequest(request: Request): boolean {
    try {
        return new URL(request.url).protocol === 'https:';
    } catch {
        return false;
    }
}

function buildCookie({
    name,
    value,
    maxAge,
    httpOnly = false,
    secure = false,
}: {
    name: string;
    value: string;
    maxAge: number;
    httpOnly?: boolean;
    secure?: boolean;
}): string {
    let cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
    if (httpOnly) {
        cookie += '; HttpOnly';
    }
    if (secure) {
        cookie += '; Secure';
    }
    return cookie;
}

function createAuthSuccessCookies(accountNameKey: string, displayName: string, secure: boolean): string[] {
    const sessionToken = createSignedAuthSessionToken({ accountNameKey });
    return [
        buildCookie({
            name: AUTH_SESSION_COOKIE_KEY,
            value: sessionToken,
            maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
            httpOnly: true,
            secure,
        }),
        buildCookie({
            name: ACCOUNT_COOKIE_KEY,
            value: accountNameKey,
            maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
            httpOnly: true,
            secure,
        }),
        buildCookie({
            name: USERNAME_COOKIE_KEY,
            value: displayName,
            maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
            secure,
        }),
    ];
}

function createAuthClearCookies(secure: boolean): string[] {
    return [
        buildCookie({
            name: AUTH_SESSION_COOKIE_KEY,
            value: '',
            maxAge: 0,
            httpOnly: true,
            secure,
        }),
        buildCookie({
            name: ACCOUNT_COOKIE_KEY,
            value: '',
            maxAge: 0,
            httpOnly: true,
            secure,
        }),
        buildCookie({
            name: USERNAME_COOKIE_KEY,
            value: '',
            maxAge: 0,
            secure,
        }),
    ];
}

function createJsonResponse({
    status,
    payload,
    cookies,
}: {
    status: number;
    payload: ResponsePayload;
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

function isJsonRecord(value: JsonValue | object | null | undefined): value is JsonRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function parseJsonBody(request: Request): Promise<JsonRecord | null> {
    let parsed: JsonValue;
    try {
        parsed = (await request.json()) as JsonValue;
    } catch {
        return null;
    }
    if (!isJsonRecord(parsed)) {
        return null;
    }
    return parsed;
}

async function parsePasskeyAuthOptionsPayload(request: Request): Promise<PasskeyAuthOptionsPayload | null> {
    const parsed = await parseJsonBody(request);
    if (!parsed) {
        return null;
    }
    const username = resolveString(parsed.username);
    if (!username) {
        return null;
    }
    return { username };
}

async function parsePasskeyRegisterVerifyPayload(request: Request): Promise<PasskeyRegisterVerifyPayload | null> {
    const parsed = await parseJsonBody(request);
    if (!parsed) {
        return null;
    }
    const username = resolveString(parsed.username);
    const response = parsed.response;
    if (!username || !isRegistrationResponseJson(response)) {
        return null;
    }
    return {
        username,
        response,
    };
}

async function parsePasskeyLoginVerifyPayload(request: Request): Promise<PasskeyLoginVerifyPayload | null> {
    const parsed = await parseJsonBody(request);
    if (!parsed) {
        return null;
    }
    const username = resolveString(parsed.username);
    const response = parsed.response;
    if (!username || !isAuthenticationResponseJson(response)) {
        return null;
    }
    return {
        username,
        response,
    };
}

function isRegistrationResponseJson(value: JsonValue | object | null | undefined): value is RegistrationResponseJSON {
    if (!isJsonRecord(value)) {
        return false;
    }
    const response = value.response;
    return (
        typeof value.id === 'string' &&
        typeof value.rawId === 'string' &&
        typeof value.type === 'string' &&
        isJsonRecord(response)
    );
}

function isAuthenticationResponseJson(
    value: JsonValue | object | null | undefined
): value is AuthenticationResponseJSON {
    if (!isJsonRecord(value)) {
        return false;
    }
    const response = value.response;
    return (
        typeof value.id === 'string' &&
        typeof value.rawId === 'string' &&
        typeof value.type === 'string' &&
        isJsonRecord(response)
    );
}

function resolvePasskeyTransports(value: ReadonlyArray<string> | null | undefined): AuthenticatorTransportFuture[] {
    if (!Array.isArray(value)) {
        return [];
    }
    const out = new Set<AuthenticatorTransportFuture>();
    for (const raw of value) {
        if (typeof raw !== 'string') {
            continue;
        }
        switch (raw) {
            case 'ble':
            case 'cable':
            case 'hybrid':
            case 'internal':
            case 'nfc':
            case 'smart-card':
            case 'usb':
                out.add(raw);
                break;
            default:
                break;
        }
    }
    return [...out];
}

type RegistrationCredentialLike = Readonly<{
    id: string;
    publicKey: Uint8Array;
    counter: number;
    transports?: ReadonlyArray<string>;
}>;

function isRegistrationCredentialLike(value: unknown): value is RegistrationCredentialLike {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return false;
    }
    const candidate = value as Record<string, unknown>;
    if (typeof candidate.id !== 'string') {
        return false;
    }
    if (!(candidate.publicKey instanceof Uint8Array)) {
        return false;
    }
    if (typeof candidate.counter !== 'number' || !Number.isFinite(candidate.counter) || candidate.counter < 0) {
        return false;
    }
    const transports = candidate.transports;
    if (transports === undefined) {
        return true;
    }
    if (!Array.isArray(transports)) {
        return false;
    }
    for (let i = 0; i < transports.length; i += 1) {
        if (typeof transports[i] !== 'string') {
            return false;
        }
    }
    return true;
}

function resolveVerifiedRegistrationCredential(
    verification: Awaited<ReturnType<typeof verifyRegistrationResponse>>
): RegistrationCredentialLike | null {
    if (!verification.verified) {
        return null;
    }
    const registrationInfoValue: unknown = Reflect.get(verification as Record<string, unknown>, 'registrationInfo');
    if (
        typeof registrationInfoValue !== 'object' ||
        registrationInfoValue === null ||
        Array.isArray(registrationInfoValue)
    ) {
        return null;
    }
    const credentialValue: unknown = Reflect.get(registrationInfoValue as Record<string, unknown>, 'credential');
    return isRegistrationCredentialLike(credentialValue) ? credentialValue : null;
}

function setPendingChallenge({
    store,
    username,
    challenge,
    rpId,
    expectedOrigins,
    nowMs,
}: {
    store: Map<string, PendingChallenge>;
    username: string;
    challenge: string;
    rpId: string;
    expectedOrigins: string[];
    nowMs: number;
}): void {
    const normalizedUsername = normalizeIdentityKey(username);
    store.set(normalizedUsername, {
        challenge,
        rpId,
        expectedOrigins,
        expiresAtMs: nowMs + DEFAULT_CHALLENGE_TTL_MS,
    });
}

function consumePendingChallenge({
    store,
    username,
    nowMs,
}: {
    store: Map<string, PendingChallenge>;
    username: string;
    nowMs: number;
}): PendingChallenge | null {
    const normalizedUsername = normalizeIdentityKey(username);
    const pending = store.get(normalizedUsername) ?? null;
    store.delete(normalizedUsername);
    if (!pending) {
        return null;
    }
    if (pending.expiresAtMs <= nowMs) {
        return null;
    }
    return pending;
}

/** Test-only: observe pending challenge store sizes to lock the sweep property. */
export function getPendingChallengeCountsForTest(): Readonly<{ register: number; login: number }> {
    return Object.freeze({ register: pendingRegisterChallenges.size, login: pendingLoginChallenges.size });
}

function pruneExpiredChallenges(store: Map<string, PendingChallenge>, nowMs: number): void {
    for (const [key, pending] of store.entries()) {
        if (pending.expiresAtMs <= nowMs) {
            store.delete(key);
        }
    }
}

function resolveFailedAuthStatus(pathname: string): number {
    if (pathname.includes('/verify')) {
        return 401;
    }
    return 400;
}

export async function createPasskeyAuthResponse({
    request,
    persistence,
    dependencies,
}: {
    request: Request;
    persistence: PasskeyAuthPersistence;
    dependencies?: PasskeyAuthDependencies;
}): Promise<Response> {
    const pathname = parseRequestPathname(request.url);
    const deps = dependencies ?? {};
    const nowMs = deps.nowMs ?? (() => Date.now());
    const generateRegistrationOptionsFn = deps.generateRegistrationOptionsFn ?? generateRegistrationOptions;
    const generateAuthenticationOptionsFn = deps.generateAuthenticationOptionsFn ?? generateAuthenticationOptions;
    const verifyRegistrationResponseFn = deps.verifyRegistrationResponseFn ?? verifyRegistrationResponse;
    const verifyAuthenticationResponseFn = deps.verifyAuthenticationResponseFn ?? verifyAuthenticationResponse;

    const now = nowMs();
    const secureCookies = isSecureRequest(request);
    pruneExpiredChallenges(pendingRegisterChallenges, now);
    pruneExpiredChallenges(pendingLoginChallenges, now);

    if (pathname === '/auth/passkey/logout') {
        if (request.method !== 'POST') {
            return createJsonResponse({ status: 405, payload: { ok: false, reason: 'Method not allowed.' } });
        }
        return createJsonResponse({
            status: 200,
            payload: { ok: true },
            cookies: createAuthClearCookies(secureCookies),
        });
    }

    if (
        pathname !== '/auth/passkey/register/options' &&
        pathname !== '/auth/passkey/register/verify' &&
        pathname !== '/auth/passkey/login/options' &&
        pathname !== '/auth/passkey/login/verify'
    ) {
        return createJsonResponse({ status: 404, payload: { ok: false, reason: 'Not found.' } });
    }

    if (request.method !== 'POST') {
        return createJsonResponse({ status: 405, payload: { ok: false, reason: 'Method not allowed.' } });
    }

    const rpId = resolveRelyingPartyId(request);
    const expectedOrigins = resolveExpectedOrigins(request);

    if (pathname === '/auth/passkey/register/options') {
        const payload = await parsePasskeyAuthOptionsPayload(request);
        if (!payload) {
            return createJsonResponse({ status: 400, payload: { ok: false, reason: 'Invalid JSON payload.' } });
        }

        const normalizedName = normalizeIdentityKey(payload.username);
        const requestedDisplayName = payload.username.trim();
        const credentials = persistence.listPasskeyCredentialsByName(normalizedName);
        const options = await generateRegistrationOptionsFn({
            rpName: resolveRelyingPartyName(),
            rpID: rpId,
            userName: normalizedName,
            userDisplayName: requestedDisplayName,
            userID: textEncoder.encode(normalizedName),
            excludeCredentials: credentials.map((credential) => ({
                id: credential.credentialId,
                transports: credential.transports,
            })),
            timeout: 60000,
        });

        setPendingChallenge({
            store: pendingRegisterChallenges,
            username: normalizedName,
            challenge: options.challenge,
            rpId,
            expectedOrigins,
            nowMs: now,
        });

        return createJsonResponse({
            status: 200,
            payload: {
                ok: true,
                options,
            },
        });
    }

    if (pathname === '/auth/passkey/login/options') {
        const payload = await parsePasskeyAuthOptionsPayload(request);
        if (!payload) {
            return createJsonResponse({ status: 400, payload: { ok: false, reason: 'Invalid JSON payload.' } });
        }

        const normalizedName = normalizeIdentityKey(payload.username);
        const credentials = persistence.listPasskeyCredentialsByName(normalizedName);
        if (credentials.length === 0) {
            return createJsonResponse({
                status: 400,
                payload: { ok: false, reason: 'No passkey is registered for this account.' },
            });
        }

        const options = await generateAuthenticationOptionsFn({
            rpID: rpId,
            allowCredentials: credentials.map((credential) => ({
                id: credential.credentialId,
                transports: credential.transports,
            })),
            timeout: 60000,
            userVerification: 'preferred',
        });

        setPendingChallenge({
            store: pendingLoginChallenges,
            username: normalizedName,
            challenge: options.challenge,
            rpId,
            expectedOrigins,
            nowMs: now,
        });

        return createJsonResponse({
            status: 200,
            payload: {
                ok: true,
                options,
            },
        });
    }

    if (pathname === '/auth/passkey/register/verify') {
        const payload = await parsePasskeyRegisterVerifyPayload(request);
        if (!payload) {
            return createJsonResponse({ status: 400, payload: { ok: false, reason: 'Invalid JSON payload.' } });
        }

        const normalizedName = normalizeIdentityKey(payload.username);
        const requestedDisplayName = payload.username.trim();
        const pending = consumePendingChallenge({
            store: pendingRegisterChallenges,
            username: normalizedName,
            nowMs: now,
        });
        if (!pending) {
            return createJsonResponse({
                status: 400,
                payload: { ok: false, reason: 'Passkey registration challenge is missing or expired.' },
            });
        }

        let verification: Awaited<ReturnType<typeof verifyRegistrationResponse>>;
        try {
            verification = await verifyRegistrationResponseFn({
                response: payload.response,
                expectedChallenge: pending.challenge,
                expectedOrigin: pending.expectedOrigins,
                expectedRPID: pending.rpId,
                requireUserVerification: true,
            });
        } catch {
            return createJsonResponse({
                status: 401,
                payload: { ok: false, reason: 'Passkey registration verification failed.' },
            });
        }

        const credential = resolveVerifiedRegistrationCredential(verification);
        if (!credential) {
            return createJsonResponse({
                status: 401,
                payload: { ok: false, reason: 'Passkey registration verification failed.' },
            });
        }

        const registered = persistence.registerPasskeyCredential({
            requestedName: requestedDisplayName,
            credentialId: credential.id,
            credentialPublicKey: credential.publicKey,
            counter: credential.counter,
            transports: resolvePasskeyTransports(credential.transports),
        });
        if (!registered.accepted) {
            return createJsonResponse({
                status: resolveFailedAuthStatus(pathname),
                payload: { ok: false, reason: registered.reason },
            });
        }

        return createJsonResponse({
            status: 200,
            payload: {
                ok: true,
                accountNameKey: registered.accountNameKey,
                displayName: registered.profile.displayName,
            },
            cookies: createAuthSuccessCookies(registered.accountNameKey, registered.profile.displayName, secureCookies),
        });
    }

    const payload = await parsePasskeyLoginVerifyPayload(request);
    if (!payload) {
        return createJsonResponse({ status: 400, payload: { ok: false, reason: 'Invalid JSON payload.' } });
    }

    const normalizedName = normalizeIdentityKey(payload.username);
    const pending = consumePendingChallenge({
        store: pendingLoginChallenges,
        username: normalizedName,
        nowMs: now,
    });
    if (!pending) {
        return createJsonResponse({
            status: 400,
            payload: { ok: false, reason: 'Passkey login challenge is missing or expired.' },
        });
    }

    const credentialId = resolveString(payload.response.id);
    if (!credentialId) {
        return createJsonResponse({
            status: 401,
            payload: { ok: false, reason: 'Passkey assertion payload is invalid.' },
        });
    }

    const storedCredential = persistence.getPasskeyCredentialByCredentialId(credentialId);
    if (storedCredential?.accountNameKey !== normalizedName) {
        return createJsonResponse({
            status: 401,
            payload: { ok: false, reason: 'Passkey assertion did not match this account.' },
        });
    }

    let verification: Awaited<ReturnType<typeof verifyAuthenticationResponse>>;
    try {
        verification = await verifyAuthenticationResponseFn({
            response: payload.response,
            expectedChallenge: pending.challenge,
            expectedOrigin: pending.expectedOrigins,
            expectedRPID: pending.rpId,
            requireUserVerification: true,
            credential: {
                id: storedCredential.credentialId,
                publicKey: new Uint8Array(storedCredential.credentialPublicKey),
                counter: storedCredential.counter,
                transports: storedCredential.transports,
            },
        });
    } catch {
        return createJsonResponse({
            status: 401,
            payload: { ok: false, reason: 'Passkey authentication verification failed.' },
        });
    }

    if (!verification.verified) {
        return createJsonResponse({
            status: 401,
            payload: { ok: false, reason: 'Passkey authentication verification failed.' },
        });
    }

    const authenticated = persistence.authenticatePasskeyCredential({
        requestedName: normalizedName,
        credentialId: storedCredential.credentialId,
        nextCounter: verification.authenticationInfo.newCounter,
    });
    if (!authenticated.accepted) {
        return createJsonResponse({
            status: 401,
            payload: { ok: false, reason: authenticated.reason },
        });
    }

    return createJsonResponse({
        status: 200,
        payload: {
            ok: true,
            accountNameKey: authenticated.accountNameKey,
            displayName: authenticated.profile.displayName,
        },
        cookies: createAuthSuccessCookies(
            authenticated.accountNameKey,
            authenticated.profile.displayName,
            secureCookies
        ),
    });
}
