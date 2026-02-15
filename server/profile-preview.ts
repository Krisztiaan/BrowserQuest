import Types from '../shared/gametypes-browser';
import { readFileSync } from 'node:fs';
import type { PersistedPlayerProfile } from './player-persistence';
import { AUTH_SESSION_COOKIE_KEY, USERNAME_COOKIE_KEY } from '../shared/auth/cookie-keys';
import { verifySignedAuthSessionToken } from './auth-session';

const DEFAULT_ARMOR_SPRITE = 'clotharmor';
const DEFAULT_WEAPON_SPRITE = 'sword1';
const SHADOW_SPRITE = 'shadow16';
const SPRITE_SCALE = 1;
const FRAME_SIZE = 32;
const DATA_URI_PREFIX = 'data:image/png;base64,';

type SpriteAnimation = {
    length: number;
    row: number;
};

type SpriteSpec = {
    id: string;
    width: number;
    height: number;
    offset_x?: number;
    offset_y?: number;
    animations?: Record<string, SpriteAnimation>;
};

type ProfileLookup = {
    getProfileByName(playerName: string): PersistedPlayerProfile | null;
    getProfileByAccountNameKey?(accountNameKey: string): PersistedPlayerProfile | null;
};
type ProfilePreviewPayload = Readonly<{
    armorSpriteName: string;
    weaponSpriteName: string;
    hasProfile: boolean;
}>;

const spriteSpecCache = new Map<string, SpriteSpec | null>();
const spriteDataUriCache = new Map<string, string | null>();

function parseCookieValue(cookieHeader: string | null | undefined, key: string): string | null {
    if (typeof cookieHeader !== 'string' || cookieHeader.length === 0) {
        return null;
    }

    const entries = cookieHeader.split(';');
    for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index];
        if (!entry) {
            continue;
        }
        const separatorIndex = entry.indexOf('=');
        if (separatorIndex <= 0) {
            continue;
        }
        const entryKey = entry.slice(0, separatorIndex).trim();
        if (entryKey !== key) {
            continue;
        }
        const rawValue = entry.slice(separatorIndex + 1).trim();
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

function resolveArmorSpriteName(profile: PersistedPlayerProfile | null): string {
    if (!profile || !Types.isArmor(profile.armorKind)) {
        return DEFAULT_ARMOR_SPRITE;
    }
    const kindName = Types.getKindAsString(profile.armorKind);
    if (typeof kindName !== 'string' || !/^[a-z0-9]+$/u.test(kindName)) {
        return DEFAULT_ARMOR_SPRITE;
    }
    return kindName;
}

function resolveWeaponSpriteName(profile: PersistedPlayerProfile | null): string {
    if (!profile || !Types.isWeapon(profile.weaponKind)) {
        return DEFAULT_WEAPON_SPRITE;
    }
    const kindName = Types.getKindAsString(profile.weaponKind);
    if (typeof kindName !== 'string' || !/^[a-z0-9]+$/u.test(kindName)) {
        return DEFAULT_WEAPON_SPRITE;
    }
    return kindName;
}

function loadSpriteSpec(spriteName: string): SpriteSpec | null {
    const cached = spriteSpecCache.get(spriteName);
    if (cached !== undefined) {
        return cached;
    }

    try {
        const jsonUrl = new URL(`../client/sprites/${spriteName}.json`, import.meta.url);
        const parsed = JSON.parse(readFileSync(jsonUrl, 'utf8')) as unknown;
        if (
            typeof parsed !== 'object'
            || parsed === null
            || typeof (parsed as { width?: unknown }).width !== 'number'
            || typeof (parsed as { height?: unknown }).height !== 'number'
        ) {
            spriteSpecCache.set(spriteName, null);
            return null;
        }
        const spec = parsed as SpriteSpec;
        spriteSpecCache.set(spriteName, spec);
        return spec;
    } catch {
        spriteSpecCache.set(spriteName, null);
        return null;
    }
}

function loadSpriteDataUri(spriteName: string): string | null {
    const cached = spriteDataUriCache.get(spriteName);
    if (cached !== undefined) {
        return cached;
    }

    try {
        const pngUrl = new URL(`../client/public/img/${SPRITE_SCALE}/${spriteName}.png`, import.meta.url);
        const bytes = readFileSync(pngUrl);
        const dataUri = `${DATA_URI_PREFIX}${bytes.toString('base64')}`;
        spriteDataUriCache.set(spriteName, dataUri);
        return dataUri;
    } catch {
        spriteDataUriCache.set(spriteName, null);
        return null;
    }
}

function getFrameRows(spec: SpriteSpec): number {
    const animations = spec.animations;
    if (!animations) {
        return 1;
    }
    let maxRow = 0;
    for (const key in animations) {
        const row = animations[key]?.row;
        if (typeof row === 'number' && Number.isFinite(row) && row > maxRow) {
            maxRow = row;
        }
    }
    return Math.max(1, maxRow + 1);
}

function getFrameColumns(spec: SpriteSpec): number {
    const animations = spec.animations;
    if (!animations) {
        return 1;
    }
    let maxLength = 0;
    for (const key in animations) {
        const length = animations[key]?.length;
        if (typeof length === 'number' && Number.isFinite(length) && length > maxLength) {
            maxLength = length;
        }
    }
    return Math.max(1, maxLength);
}

function getIdleDownRow(spec: SpriteSpec): number {
    const idleDown = spec.animations?.idle_down;
    if (idleDown && Number.isFinite(idleDown.row)) {
        return Math.max(0, idleDown.row);
    }
    return 0;
}

function getOffset(spec: SpriteSpec): { x: number; y: number } {
    return {
        x: Number.isFinite(spec.offset_x) ? Number(spec.offset_x) : -16,
        y: Number.isFinite(spec.offset_y) ? Number(spec.offset_y) : -16,
    };
}

function buildComposedPreviewSvg({
    armorSpriteName,
    weaponSpriteName,
}: {
    armorSpriteName: string;
    weaponSpriteName: string;
}): string {
    const armorSpec = loadSpriteSpec(armorSpriteName) ?? loadSpriteSpec(DEFAULT_ARMOR_SPRITE);
    const weaponSpec = loadSpriteSpec(weaponSpriteName) ?? loadSpriteSpec(DEFAULT_WEAPON_SPRITE);
    const shadowSpec = loadSpriteSpec(SHADOW_SPRITE);
    const armorDataUri = loadSpriteDataUri(armorSpriteName) ?? loadSpriteDataUri(DEFAULT_ARMOR_SPRITE);
    const weaponDataUri = loadSpriteDataUri(weaponSpriteName) ?? loadSpriteDataUri(DEFAULT_WEAPON_SPRITE);
    const shadowDataUri = loadSpriteDataUri(SHADOW_SPRITE);

    if (!armorSpec || !weaponSpec || !shadowSpec || !armorDataUri || !weaponDataUri || !shadowDataUri) {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${FRAME_SIZE}" height="${FRAME_SIZE}" viewBox="0 0 ${FRAME_SIZE} ${FRAME_SIZE}" shape-rendering="crispEdges"><rect width="${FRAME_SIZE}" height="${FRAME_SIZE}" fill="#1b1b1b"/></svg>`;
    }

    const armorRows = getFrameRows(armorSpec);
    const armorCols = getFrameColumns(armorSpec);
    const armorOffset = getOffset(armorSpec);
    const armorIdleDownRow = getIdleDownRow(armorSpec);
    const armorSheetWidth = armorSpec.width * armorCols;
    const armorSheetHeight = armorSpec.height * armorRows;

    const weaponRows = getFrameRows(weaponSpec);
    const weaponCols = getFrameColumns(weaponSpec);
    const weaponOffset = getOffset(weaponSpec);
    const weaponIdleDownRow = getIdleDownRow(weaponSpec);
    const weaponSheetWidth = weaponSpec.width * weaponCols;
    const weaponSheetHeight = weaponSpec.height * weaponRows;

    const shadowX = -armorOffset.x;
    const shadowY = -armorOffset.y;
    const weaponDrawX = weaponOffset.x - armorOffset.x;
    const weaponDrawY = weaponOffset.y - armorOffset.y - weaponSpec.height * weaponIdleDownRow;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${FRAME_SIZE}" height="${FRAME_SIZE}" viewBox="0 0 ${FRAME_SIZE} ${FRAME_SIZE}" shape-rendering="crispEdges"><!-- armor:${armorSpriteName};weapon:${weaponSpriteName} --><image href="${shadowDataUri}" x="${shadowX}" y="${shadowY}" width="${shadowSpec.width}" height="${shadowSpec.height}" preserveAspectRatio="none"/><image href="${armorDataUri}" x="0" y="${-armorSpec.height * armorIdleDownRow}" width="${armorSheetWidth}" height="${armorSheetHeight}" preserveAspectRatio="none"/><image href="${weaponDataUri}" x="${weaponDrawX}" y="${weaponDrawY}" width="${weaponSheetWidth}" height="${weaponSheetHeight}" preserveAspectRatio="none"/></svg>`;
}

export function createProfilePreviewResponse({
    cookieHeader,
    profileLookup,
}: {
    cookieHeader: string | null | undefined;
    profileLookup: ProfileLookup;
}): Response {
    const payload = createProfilePreviewPayload({
        cookieHeader,
        profileLookup,
    });
    const svg = buildComposedPreviewSvg(payload);

    return new Response(svg, {
        status: 200,
        headers: {
            'Content-Type': 'image/svg+xml; charset=utf-8',
            'Cache-Control': 'private, no-store, max-age=0',
        },
    });
}

export function createProfilePreviewPayload({
    cookieHeader,
    profileLookup,
}: {
    cookieHeader: string | null | undefined;
    profileLookup: ProfileLookup;
}): ProfilePreviewPayload {
    const accountSessionToken = parseCookieValue(cookieHeader, AUTH_SESSION_COOKIE_KEY);
    const accountNameKey = verifySignedAuthSessionToken({ token: accountSessionToken });
    const playerName = parseCookieValue(cookieHeader, USERNAME_COOKIE_KEY);
    const profile = accountNameKey
        ? (typeof profileLookup.getProfileByAccountNameKey === 'function'
              ? profileLookup.getProfileByAccountNameKey(accountNameKey)
              : profileLookup.getProfileByName(accountNameKey))
        : playerName
            ? profileLookup.getProfileByName(playerName)
            : null;
    const armorSpriteName = resolveArmorSpriteName(profile);
    const weaponSpriteName = resolveWeaponSpriteName(profile);
    return {
        hasProfile: profile !== null,
        armorSpriteName,
        weaponSpriteName,
    };
}

export function createProfilePreviewJsonResponse({
    cookieHeader,
    profileLookup,
}: {
    cookieHeader: string | null | undefined;
    profileLookup: ProfileLookup;
}): Response {
    const payload = createProfilePreviewPayload({
        cookieHeader,
        profileLookup,
    });

    return new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'private, no-store, max-age=0',
        },
    });
}

export { USERNAME_COOKIE_KEY, AUTH_SESSION_COOKIE_KEY };
export type { ProfilePreviewPayload };
