import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { AUTH_COOKIE_MAX_AGE_SECONDS } from '../shared/auth/cookie-keys';
import { normalizeIdentityKeyOrNull } from './identity';

let runtimeSessionSecret: string | null = null;

function resolveSessionSecretFilePath(): string {
    const override = process.env.BQ_AUTH_SESSION_SECRET_FILE;
    return path.resolve(
        typeof override === 'string' && override.trim().length > 0 ? override.trim() : './server/.data/auth-session-secret'
    );
}

function loadOrCreatePersistedSecret(): string | null {
    // Persist the generated secret so restarts do not invalidate every
    // session token (logging all players out). Env var still wins.
    const secretFile = resolveSessionSecretFilePath();
    try {
        const existing = readFileSync(secretFile, 'utf8').trim();
        if (existing.length > 0) {
            return existing;
        }
    } catch {
        // fall through to creation
    }
    try {
        const secret = randomBytes(32).toString('base64url');
        mkdirSync(path.dirname(secretFile), { recursive: true });
        writeFileSync(secretFile, `${secret}\n`, { mode: 0o600 });
        return secret;
    } catch {
        return null;
    }
}

function encodeBase64Url(value: string): string {
    return Buffer.from(value, 'utf8').toString('base64url');
}

function decodeBase64Url(value: string): string | null {
    try {
        return Buffer.from(value, 'base64url').toString('utf8');
    } catch {
        return null;
    }
}

function resolveSessionSecret(explicitSecret?: string): string {
    const explicit = typeof explicitSecret === 'string' ? explicitSecret.trim() : '';
    if (explicit.length > 0) {
        return explicit;
    }

    if (runtimeSessionSecret === null) {
        const fromEnv = typeof process.env.BQ_AUTH_SESSION_SECRET === 'string'
            ? process.env.BQ_AUTH_SESSION_SECRET.trim()
            : '';
        runtimeSessionSecret =
            fromEnv.length > 0
                ? fromEnv
                : (loadOrCreatePersistedSecret() ?? randomBytes(32).toString('base64url'));
    }

    return runtimeSessionSecret;
}

/** Test-only: clears the process-cached secret so persistence across "restarts" can be exercised. */
export function resetRuntimeSessionSecretForTest(): void {
    runtimeSessionSecret = null;
}

function computeSignature(input: string, secret: string): string {
    return createHmac('sha256', secret).update(input).digest('base64url');
}

export function createSignedAuthSessionToken({
    accountNameKey,
    secret,
    nowMs = Date.now(),
    ttlSeconds = AUTH_COOKIE_MAX_AGE_SECONDS,
}: {
    accountNameKey: string;
    secret?: string;
    nowMs?: number;
    ttlSeconds?: number;
}): string {
    const normalized = normalizeIdentityKeyOrNull(accountNameKey);
    if (!normalized) {
        throw new Error('createSignedAuthSessionToken: accountNameKey is required');
    }
    if (!Number.isFinite(nowMs) || nowMs <= 0) {
        throw new Error('createSignedAuthSessionToken: invalid nowMs');
    }
    if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
        throw new Error('createSignedAuthSessionToken: invalid ttlSeconds');
    }

    const expSeconds = Math.floor(nowMs / 1000) + Math.floor(ttlSeconds);
    const payload = `${encodeBase64Url(normalized)}.${expSeconds}`;
    const signature = computeSignature(payload, resolveSessionSecret(secret));
    return `${payload}.${signature}`;
}

export function verifySignedAuthSessionToken({
    token,
    secret,
    nowMs = Date.now(),
}: {
    token: string | null | undefined;
    secret?: string;
    nowMs?: number;
}): string | null {
    if (typeof token !== 'string' || token.length === 0) {
        return null;
    }
    if (!Number.isFinite(nowMs) || nowMs <= 0) {
        return null;
    }

    const [nameB64, expRaw, signature] = token.split('.');
    if (!nameB64 || !expRaw || !signature) {
        return null;
    }

    const expSeconds = Number.parseInt(expRaw, 10);
    if (!Number.isSafeInteger(expSeconds) || expSeconds <= 0) {
        return null;
    }
    if (Math.floor(nowMs / 1000) > expSeconds) {
        return null;
    }

    const decodedName = decodeBase64Url(nameB64);
    if (!decodedName) {
        return null;
    }
    const normalizedName = normalizeIdentityKeyOrNull(decodedName);
    if (!normalizedName) {
        return null;
    }

    const expectedInput = `${nameB64}.${expRaw}`;
    const expectedSignature = computeSignature(expectedInput, resolveSessionSecret(secret));
    if (expectedSignature.length !== signature.length) {
        return null;
    }

    const actualBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    if (actualBuffer.length !== expectedBuffer.length) {
        return null;
    }
    if (!timingSafeEqual(actualBuffer, expectedBuffer)) {
        return null;
    }

    return normalizedName;
}
