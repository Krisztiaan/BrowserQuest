import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import Types from '../shared/gametypes-browser';
import type { EntityKind } from '../shared/entity-kind-domain';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/server';

const DEFAULT_PLAYER_DB_PATH = './server/.data/player-profiles.sqlite';
const DEFAULT_ARMOR_KIND = Types.Entities.CLOTHARMOR as EntityKind;
const DEFAULT_WEAPON_KIND = Types.Entities.SWORD1 as EntityKind;

type ProfileRow = {
    name_key: string;
    display_name: string;
    armor_kind: number;
    weapon_kind: number;
    checkpoint_id: number | null;
    progression_json: string | null;
};

type AchievementProgressRow = {
    rat_count: number;
    skeleton_count: number;
    total_kills: number;
    total_dmg: number;
    total_revives: number;
};

type AchievementUnlockRow = {
    achievement_id: number;
};

type SessionByNameRow = {
    connection_id: string;
};

type SessionByConnectionRow = {
    name_key: string;
};

type PasskeyCredentialByNameRow = {
    credential_id: string;
    public_key?: Uint8Array;
    counter?: number;
    transports_json?: string | null;
};

type PasskeyCredentialByIdRow = {
    name_key: string;
    credential_id: string;
    public_key: Uint8Array;
    counter: number;
    transports_json: string | null;
};

export type PersistedAchievementProgress = Readonly<{
    unlockedIds: number[];
    ratCount: number;
    skeletonCount: number;
    totalKills: number;
    totalDmg: number;
    totalRevives: number;
}>;

export type PersistedPlayerProfile = Readonly<{
    accountNameKey: string;
    nameKey: string;
    displayName: string;
    armorKind: EntityKind;
    weaponKind: EntityKind;
    checkpointId: number | null;
    achievements: PersistedAchievementProgress;
    progression: PersistedProgressionState;
}>;

export type ClaimPlayerSessionResult =
    | Readonly<{ accepted: true; profile: PersistedPlayerProfile }>
    | Readonly<{ accepted: false; reason: string }>;

export type PasskeyRegisterResult =
    | Readonly<{ accepted: true; accountNameKey: string; profile: PersistedPlayerProfile }>
    | Readonly<{ accepted: false; reason: string }>;

export type PasskeyAuthenticateResult =
    | Readonly<{ accepted: true; accountNameKey: string; profile: PersistedPlayerProfile }>
    | Readonly<{ accepted: false; reason: string }>;

export type PersistedPasskeyCredential = Readonly<{
    accountNameKey: string;
    credentialId: string;
    credentialPublicKey: Uint8Array;
    counter: number;
    transports: AuthenticatorTransportFuture[];
}>;

export type PersistedInventoryEntry = Readonly<{
    itemKind: EntityKind;
    quantity: number;
}>;

export type PersistedProgressionState = Readonly<{
    gold: number;
    farmingLevel: number;
    farmingXp: number;
    homePlotClaimId: number | null;
    inventory: PersistedInventoryEntry[];
}>;

function normalizePlayerName(name: string): string {
    return name.trim().toLowerCase();
}

function resolveDisplayName(name: string, normalizedName: string): string {
    const trimmed = name.trim();
    if (trimmed.length > 0) {
        return trimmed;
    }
    if (normalizedName.length > 0) {
        return normalizedName;
    }
    return 'lorem ipsum';
}

function defaultProgressionState(): PersistedProgressionState {
    return {
        gold: 0,
        farmingLevel: 1,
        farmingXp: 0,
        homePlotClaimId: null,
        inventory: [],
    };
}

function sanitizeProgressionState(candidate: unknown): PersistedProgressionState {
    const fallback = defaultProgressionState();
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        return fallback;
    }
    const raw = candidate as Record<string, unknown>;
    const gold = typeof raw.gold === 'number' && Number.isFinite(raw.gold) ? Math.max(0, Math.trunc(raw.gold)) : fallback.gold;
    const farmingLevel =
        typeof raw.farmingLevel === 'number' && Number.isFinite(raw.farmingLevel)
            ? Math.max(1, Math.trunc(raw.farmingLevel))
            : fallback.farmingLevel;
    const farmingXp =
        typeof raw.farmingXp === 'number' && Number.isFinite(raw.farmingXp)
            ? Math.max(0, Math.trunc(raw.farmingXp))
            : fallback.farmingXp;
    const homePlotClaimId =
        typeof raw.homePlotClaimId === 'number' && Number.isFinite(raw.homePlotClaimId)
            ? Math.max(0, Math.trunc(raw.homePlotClaimId))
            : null;
    const inventory = Array.isArray(raw.inventory)
        ? raw.inventory
              .map((entry) => {
                  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
                      return null;
                  }
                  const record = entry as Record<string, unknown>;
                  const itemKind = record.itemKind;
                  const quantity = record.quantity;
                  if (
                      (typeof itemKind !== 'number' && typeof itemKind !== 'string')
                      || typeof quantity !== 'number'
                      || !Number.isFinite(quantity)
                  ) {
                      return null;
                  }
                  const safeQuantity = Math.max(1, Math.trunc(quantity));
                  return {
                      itemKind: itemKind as EntityKind,
                      quantity: safeQuantity,
                  } satisfies PersistedInventoryEntry;
              })
              .filter((entry): entry is PersistedInventoryEntry => entry !== null)
        : fallback.inventory;

    return {
        gold,
        farmingLevel,
        farmingXp,
        homePlotClaimId,
        inventory,
    };
}

function decodeProgressionState(jsonText: string | null | undefined): PersistedProgressionState {
    if (typeof jsonText !== 'string' || jsonText.trim().length === 0) {
        return defaultProgressionState();
    }
    try {
        return sanitizeProgressionState(JSON.parse(jsonText));
    } catch (_) {
        return defaultProgressionState();
    }
}

function encodeProgressionState(state: PersistedProgressionState): string {
    return JSON.stringify(state);
}

function normalizeTransportValue(value: unknown): AuthenticatorTransportFuture | null {
    switch (value) {
        case 'ble':
        case 'cable':
        case 'hybrid':
        case 'internal':
        case 'nfc':
        case 'smart-card':
        case 'usb':
            return value;
        default:
            return null;
    }
}

function decodeTransportsJson(value: unknown): AuthenticatorTransportFuture[] {
    if (typeof value !== 'string' || value.trim().length === 0) {
        return [];
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(value);
    } catch {
        return [];
    }
    if (!Array.isArray(parsed)) {
        return [];
    }
    const deduped = new Set<AuthenticatorTransportFuture>();
    for (let i = 0; i < parsed.length; i += 1) {
        const normalized = normalizeTransportValue(parsed[i]);
        if (normalized) {
            deduped.add(normalized);
        }
    }
    return [...deduped];
}

function encodeTransportsJson(value: ReadonlyArray<AuthenticatorTransportFuture> | undefined): string {
    const deduped = new Set<AuthenticatorTransportFuture>();
    for (const raw of value ?? []) {
        const normalized = normalizeTransportValue(raw);
        if (normalized) {
            deduped.add(normalized);
        }
    }
    return JSON.stringify([...deduped]);
}

function toUint8Array(value: unknown): Uint8Array | null {
    if (value instanceof Uint8Array) {
        return value.slice();
    }
    if (value instanceof ArrayBuffer) {
        return new Uint8Array(value.slice(0));
    }
    if (ArrayBuffer.isView(value)) {
        const view = value as ArrayBufferView;
        return new Uint8Array(view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength));
    }
    return null;
}

function asPersistedPlayerProfile(row: ProfileRow, achievements: PersistedAchievementProgress): PersistedPlayerProfile {
    return {
        accountNameKey: row.name_key,
        nameKey: row.name_key,
        displayName: row.display_name,
        armorKind: row.armor_kind as EntityKind,
        weaponKind: row.weapon_kind as EntityKind,
        checkpointId: typeof row.checkpoint_id === 'number' ? row.checkpoint_id : null,
        achievements,
        progression: decodeProgressionState(row.progression_json),
    };
}

function resolveDatabasePath(configuredPath: string | null | undefined): string {
    const trimmed = typeof configuredPath === 'string' ? configuredPath.trim() : '';
    if (!trimmed) {
        return path.resolve(DEFAULT_PLAYER_DB_PATH);
    }
    if (trimmed === ':memory:') {
        return trimmed;
    }
    return path.resolve(trimmed);
}

export class SqlitePlayerPersistence {
    readonly databasePath: string;
    #db: Database;
    #selectProfile: ReturnType<Database['prepare']>;
    #insertProfile: ReturnType<Database['prepare']>;
    #updateProfileDisplayName: ReturnType<Database['prepare']>;
    #upsertEquipment: ReturnType<Database['prepare']>;
    #upsertCheckpoint: ReturnType<Database['prepare']>;
    #upsertProgression: ReturnType<Database['prepare']>;
    #selectSessionByName: ReturnType<Database['prepare']>;
    #selectSessionByConnection: ReturnType<Database['prepare']>;
    #insertSession: ReturnType<Database['prepare']>;
    #deleteSessionByConnection: ReturnType<Database['prepare']>;
    #clearSessions: ReturnType<Database['prepare']>;
    #selectAchievementProgress: ReturnType<Database['prepare']>;
    #insertAchievementProgress: ReturnType<Database['prepare']>;
    #incrementAchievementProgress: ReturnType<Database['prepare']>;
    #selectUnlockedAchievements: ReturnType<Database['prepare']>;
    #insertUnlockedAchievement: ReturnType<Database['prepare']>;
    #selectPasskeyCredentialByNameAndCredential: ReturnType<Database['prepare']>;
    #selectPasskeyCredentialByCredential: ReturnType<Database['prepare']>;
    #selectPasskeyCredentialsByName: ReturnType<Database['prepare']>;
    #selectAnyPasskeyCredentialByName: ReturnType<Database['prepare']>;
    #insertPasskeyCredential: ReturnType<Database['prepare']>;
    #touchPasskeyCredentialUse: ReturnType<Database['prepare']>;

    constructor(configuredPath?: string | null) {
        this.databasePath = resolveDatabasePath(configuredPath);
        if (this.databasePath !== ':memory:') {
            mkdirSync(path.dirname(this.databasePath), { recursive: true });
        }

        this.#db = new Database(this.databasePath, { create: true });
        this.#db.exec(`
            PRAGMA foreign_keys = ON;
            CREATE TABLE IF NOT EXISTS players (
                name_key TEXT PRIMARY KEY,
                display_name TEXT NOT NULL,
                armor_kind INTEGER NOT NULL,
                weapon_kind INTEGER NOT NULL,
                checkpoint_id INTEGER NULL,
                progression_json TEXT NOT NULL DEFAULT '{}',
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS active_sessions (
                name_key TEXT PRIMARY KEY,
                connection_id TEXT NOT NULL UNIQUE,
                claimed_at INTEGER NOT NULL,
                FOREIGN KEY(name_key) REFERENCES players(name_key) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS player_achievement_progress (
                name_key TEXT PRIMARY KEY,
                rat_count INTEGER NOT NULL DEFAULT 0,
                skeleton_count INTEGER NOT NULL DEFAULT 0,
                total_kills INTEGER NOT NULL DEFAULT 0,
                total_dmg INTEGER NOT NULL DEFAULT 0,
                total_revives INTEGER NOT NULL DEFAULT 0,
                updated_at INTEGER NOT NULL,
                FOREIGN KEY(name_key) REFERENCES players(name_key) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS player_achievement_unlocks (
                name_key TEXT NOT NULL,
                achievement_id INTEGER NOT NULL,
                unlocked_at INTEGER NOT NULL,
                PRIMARY KEY(name_key, achievement_id),
                FOREIGN KEY(name_key) REFERENCES players(name_key) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS player_passkeys (
                name_key TEXT NOT NULL,
                credential_id TEXT NOT NULL UNIQUE,
                public_key BLOB,
                counter INTEGER NOT NULL DEFAULT 0,
                transports_json TEXT NOT NULL DEFAULT '[]',
                created_at INTEGER NOT NULL,
                last_used_at INTEGER NOT NULL,
                PRIMARY KEY(name_key, credential_id),
                FOREIGN KEY(name_key) REFERENCES players(name_key) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS player_passkeys_name_key ON player_passkeys(name_key);
        `);
        this.#ensurePlayersTableColumns();
        this.#ensurePasskeysTableColumns();

        this.#selectProfile = this.#db.prepare(
            `SELECT name_key, display_name, armor_kind, weapon_kind, checkpoint_id, progression_json
             FROM players WHERE name_key = ?1`
        );
        this.#insertProfile = this.#db.prepare(
            `INSERT INTO players
                (name_key, display_name, armor_kind, weapon_kind, checkpoint_id, progression_json, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
        );
        this.#updateProfileDisplayName = this.#db.prepare(
            `UPDATE players SET display_name = ?2, updated_at = ?3 WHERE name_key = ?1`
        );
        this.#upsertEquipment = this.#db.prepare(
            `INSERT INTO players
                (name_key, display_name, armor_kind, weapon_kind, checkpoint_id, progression_json, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, NULL, ?5, ?6, ?7)
             ON CONFLICT(name_key) DO UPDATE SET
                display_name = excluded.display_name,
                armor_kind = excluded.armor_kind,
                weapon_kind = excluded.weapon_kind,
                updated_at = excluded.updated_at`
        );
        this.#upsertCheckpoint = this.#db.prepare(
            `INSERT INTO players
                (name_key, display_name, armor_kind, weapon_kind, checkpoint_id, progression_json, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             ON CONFLICT(name_key) DO UPDATE SET
                display_name = excluded.display_name,
                checkpoint_id = excluded.checkpoint_id,
                updated_at = excluded.updated_at`
        );
        this.#upsertProgression = this.#db.prepare(
            `INSERT INTO players
                (name_key, display_name, armor_kind, weapon_kind, checkpoint_id, progression_json, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             ON CONFLICT(name_key) DO UPDATE SET
                display_name = excluded.display_name,
                progression_json = excluded.progression_json,
                updated_at = excluded.updated_at`
        );
        this.#selectSessionByName = this.#db.prepare(
            `SELECT connection_id FROM active_sessions WHERE name_key = ?1`
        );
        this.#selectSessionByConnection = this.#db.prepare(
            `SELECT name_key FROM active_sessions WHERE connection_id = ?1`
        );
        this.#insertSession = this.#db.prepare(
            `INSERT INTO active_sessions (name_key, connection_id, claimed_at) VALUES (?1, ?2, ?3)`
        );
        this.#deleteSessionByConnection = this.#db.prepare(
            `DELETE FROM active_sessions WHERE connection_id = ?1`
        );
        this.#clearSessions = this.#db.prepare(`DELETE FROM active_sessions`);
        this.#selectAchievementProgress = this.#db.prepare(
            `SELECT rat_count, skeleton_count, total_kills, total_dmg, total_revives
             FROM player_achievement_progress
             WHERE name_key = ?1`
        );
        this.#insertAchievementProgress = this.#db.prepare(
            `INSERT OR IGNORE INTO player_achievement_progress
             (name_key, rat_count, skeleton_count, total_kills, total_dmg, total_revives, updated_at)
             VALUES (?1, 0, 0, 0, 0, 0, ?2)`
        );
        this.#incrementAchievementProgress = this.#db.prepare(
            `UPDATE player_achievement_progress
             SET rat_count = MIN(10, MAX(0, rat_count + ?2)),
                 skeleton_count = MIN(10, MAX(0, skeleton_count + ?3)),
                 total_kills = MIN(50, MAX(0, total_kills + ?4)),
                 total_dmg = MIN(5000, MAX(0, total_dmg + ?5)),
                 total_revives = MIN(5, MAX(0, total_revives + ?6)),
                 updated_at = ?7
             WHERE name_key = ?1`
        );
        this.#selectUnlockedAchievements = this.#db.prepare(
            `SELECT achievement_id
             FROM player_achievement_unlocks
             WHERE name_key = ?1
             ORDER BY achievement_id ASC`
        );
        this.#insertUnlockedAchievement = this.#db.prepare(
            `INSERT OR IGNORE INTO player_achievement_unlocks (name_key, achievement_id, unlocked_at)
             VALUES (?1, ?2, ?3)`
        );
        this.#selectPasskeyCredentialByNameAndCredential = this.#db.prepare(
            `SELECT credential_id, public_key, counter, transports_json
             FROM player_passkeys
             WHERE name_key = ?1 AND credential_id = ?2`
        );
        this.#selectPasskeyCredentialByCredential = this.#db.prepare(
            `SELECT name_key, credential_id, public_key, counter, transports_json
             FROM player_passkeys
             WHERE credential_id = ?1`
        );
        this.#selectPasskeyCredentialsByName = this.#db.prepare(
            `SELECT credential_id, transports_json
             FROM player_passkeys
             WHERE name_key = ?1`
        );
        this.#selectAnyPasskeyCredentialByName = this.#db.prepare(
            `SELECT credential_id
             FROM player_passkeys
             WHERE name_key = ?1
             LIMIT 1`
        );
        this.#insertPasskeyCredential = this.#db.prepare(
            `INSERT INTO player_passkeys
                (name_key, credential_id, public_key, counter, transports_json, created_at, last_used_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT(credential_id) DO UPDATE SET
                name_key = excluded.name_key,
                public_key = excluded.public_key,
                counter = excluded.counter,
                transports_json = excluded.transports_json,
                last_used_at = excluded.last_used_at`
        );
        this.#touchPasskeyCredentialUse = this.#db.prepare(
            `UPDATE player_passkeys
             SET counter = MAX(counter, ?3),
                 last_used_at = ?4
             WHERE name_key = ?1 AND credential_id = ?2`
        );

        this.#clearSessions.run();
    }

    #ensurePlayersTableColumns(): void {
        const columns = this.#db
            .prepare(`PRAGMA table_info(players)`)
            .all() as Array<{ name?: unknown }>;
        const hasProgressionJson = columns.some((column) => column?.name === 'progression_json');
        if (!hasProgressionJson) {
            this.#db.exec(`ALTER TABLE players ADD COLUMN progression_json TEXT NOT NULL DEFAULT '{}'`);
        }
    }

    #ensurePasskeysTableColumns(): void {
        const columns = this.#db
            .prepare(`PRAGMA table_info(player_passkeys)`)
            .all() as Array<{ name?: unknown }>;

        const hasPublicKey = columns.some((column) => column?.name === 'public_key');
        if (!hasPublicKey) {
            this.#db.exec(`ALTER TABLE player_passkeys ADD COLUMN public_key BLOB`);
        }

        const hasCounter = columns.some((column) => column?.name === 'counter');
        if (!hasCounter) {
            this.#db.exec(`ALTER TABLE player_passkeys ADD COLUMN counter INTEGER NOT NULL DEFAULT 0`);
        }

        const hasTransportsJson = columns.some((column) => column?.name === 'transports_json');
        if (!hasTransportsJson) {
            this.#db.exec(`ALTER TABLE player_passkeys ADD COLUMN transports_json TEXT NOT NULL DEFAULT '[]'`);
        }
    }

    #ensureAchievementProgress(nameKey: string): void {
        this.#insertAchievementProgress.run(nameKey, Date.now());
    }

    #getAchievementProgressByNameKey(nameKey: string): PersistedAchievementProgress {
        this.#ensureAchievementProgress(nameKey);

        const row = this.#selectAchievementProgress.get(nameKey) as AchievementProgressRow | null;
        const unlockedRows = this.#selectUnlockedAchievements.all(nameKey) as AchievementUnlockRow[];
        const unlockedIds = unlockedRows
            .map((entry) => entry.achievement_id)
            .filter((id) => Number.isSafeInteger(id) && id > 0);

        return {
            unlockedIds,
            ratCount: row?.rat_count ?? 0,
            skeletonCount: row?.skeleton_count ?? 0,
            totalKills: row?.total_kills ?? 0,
            totalDmg: row?.total_dmg ?? 0,
            totalRevives: row?.total_revives ?? 0,
        };
    }

    claimPlayerSession({
        connectionId,
        requestedName,
        authenticatedAccountNameKey,
    }: {
        connectionId: string;
        requestedName: string;
        authenticatedAccountNameKey?: string;
    }): ClaimPlayerSessionResult {
        const normalizedRequestedName = normalizePlayerName(requestedName);
        const normalizedAuthenticatedName = normalizePlayerName(authenticatedAccountNameKey ?? '');
        const accountNameKey = normalizedAuthenticatedName || normalizedRequestedName;
        if (!accountNameKey) {
            return {
                accepted: false,
                reason: 'Invalid player name.',
            };
        }

        const existingByName = this.#selectSessionByName.get(accountNameKey) as SessionByNameRow | null;
        if (existingByName && existingByName.connection_id !== connectionId) {
            return {
                accepted: false,
                reason: 'A player with this name is already connected.',
            };
        }

        const existingByConnection = this.#selectSessionByConnection.get(connectionId) as SessionByConnectionRow | null;
        if (existingByConnection && existingByConnection.name_key !== accountNameKey) {
            return {
                accepted: false,
                reason: 'Connection is already bound to a different player name.',
            };
        }

        const displayName = resolveDisplayName(requestedName, accountNameKey);
        let row = this.#selectProfile.get(accountNameKey) as ProfileRow | null;
        const now = Date.now();
        if (!row) {
            this.#insertProfile.run(
                accountNameKey,
                displayName,
                Number(DEFAULT_ARMOR_KIND),
                Number(DEFAULT_WEAPON_KIND),
                null,
                encodeProgressionState(defaultProgressionState()),
                now,
                now
            );
            row = this.#selectProfile.get(accountNameKey) as ProfileRow | null;
        } else if (row.display_name !== displayName) {
            this.#updateProfileDisplayName.run(accountNameKey, displayName, now);
            row = {
                ...row,
                display_name: displayName,
            };
        }

        if (!existingByName && !existingByConnection) {
            this.#insertSession.run(accountNameKey, connectionId, Date.now());
        }

        if (!row) {
            return {
                accepted: false,
                reason: 'Unable to load player profile.',
            };
        }

        const achievements = this.#getAchievementProgressByNameKey(accountNameKey);

        return {
            accepted: true,
            profile: asPersistedPlayerProfile(row, achievements),
        };
    }

    releasePlayerSession(connectionId: string): void {
        this.#deleteSessionByConnection.run(connectionId);
    }

    persistEquipment({
        playerName,
        armorKind,
        weaponKind,
    }: {
        playerName: string;
        armorKind: EntityKind;
        weaponKind: EntityKind;
    }): void {
        const normalizedName = normalizePlayerName(playerName);
        if (!normalizedName) {
            return;
        }
        const existing = this.#selectProfile.get(normalizedName) as ProfileRow | null;
        const displayName = existing?.display_name ?? resolveDisplayName(playerName, normalizedName);
        const now = Date.now();
        this.#upsertEquipment.run(
            normalizedName,
            displayName,
            Number(armorKind),
            Number(weaponKind),
            existing?.progression_json ?? encodeProgressionState(defaultProgressionState()),
            now,
            now
        );
    }

    persistCheckpoint({
        playerName,
        checkpointId,
    }: {
        playerName: string;
        checkpointId: number;
    }): void {
        const normalizedName = normalizePlayerName(playerName);
        if (!normalizedName || !Number.isFinite(checkpointId)) {
            return;
        }
        const existing = this.#selectProfile.get(normalizedName) as ProfileRow | null;
        const displayName = existing?.display_name ?? resolveDisplayName(playerName, normalizedName);
        const armorKind = existing ? existing.armor_kind : Number(DEFAULT_ARMOR_KIND);
        const weaponKind = existing ? existing.weapon_kind : Number(DEFAULT_WEAPON_KIND);
        const now = Date.now();
        this.#upsertCheckpoint.run(
            normalizedName,
            displayName,
            armorKind,
            weaponKind,
            checkpointId,
            existing?.progression_json ?? encodeProgressionState(defaultProgressionState()),
            now,
            now
        );
    }

    persistProgression({
        playerName,
        progression,
    }: {
        playerName: string;
        progression: Partial<PersistedProgressionState>;
    }): void {
        const normalizedName = normalizePlayerName(playerName);
        if (!normalizedName) {
            return;
        }

        const existing = this.#selectProfile.get(normalizedName) as ProfileRow | null;
        const displayName = existing?.display_name ?? resolveDisplayName(playerName, normalizedName);
        const armorKind = existing ? existing.armor_kind : Number(DEFAULT_ARMOR_KIND);
        const weaponKind = existing ? existing.weapon_kind : Number(DEFAULT_WEAPON_KIND);
        const checkpointId = existing ? existing.checkpoint_id : null;
        const existingProgression = decodeProgressionState(existing?.progression_json);
        const mergedProgression = sanitizeProgressionState({
            ...existingProgression,
            ...progression,
            inventory: progression.inventory ?? existingProgression.inventory,
        });
        const now = Date.now();

        this.#upsertProgression.run(
            normalizedName,
            displayName,
            armorKind,
            weaponKind,
            checkpointId,
            encodeProgressionState(mergedProgression),
            now,
            now
        );
    }

    getProfileByName(playerName: string): PersistedPlayerProfile | null {
        const normalizedName = normalizePlayerName(playerName);
        if (!normalizedName) {
            return null;
        }
        const row = this.#selectProfile.get(normalizedName) as ProfileRow | null;
        if (!row) {
            return null;
        }
        return asPersistedPlayerProfile(row, this.#getAchievementProgressByNameKey(normalizedName));
    }

    getProfileByAccountNameKey(accountNameKey: string): PersistedPlayerProfile | null {
        return this.getProfileByName(accountNameKey);
    }

    getAchievementProgressByName(playerName: string): PersistedAchievementProgress | null {
        const normalizedName = normalizePlayerName(playerName);
        if (!normalizedName) {
            return null;
        }
        const row = this.#selectProfile.get(normalizedName) as ProfileRow | null;
        if (!row) {
            return null;
        }
        return this.#getAchievementProgressByNameKey(normalizedName);
    }

    persistAchievementUnlock({
        playerName,
        achievementId,
    }: {
        playerName: string;
        achievementId: number;
    }): void {
        const normalizedName = normalizePlayerName(playerName);
        if (!normalizedName || !Number.isSafeInteger(achievementId) || achievementId <= 0) {
            return;
        }
        this.#ensureAchievementProgress(normalizedName);
        this.#insertUnlockedAchievement.run(normalizedName, achievementId, Date.now());
    }

    incrementAchievementCounters({
        playerName,
        ratDelta = 0,
        skeletonDelta = 0,
        killsDelta = 0,
        damageDelta = 0,
        revivesDelta = 0,
    }: {
        playerName: string;
        ratDelta?: number;
        skeletonDelta?: number;
        killsDelta?: number;
        damageDelta?: number;
        revivesDelta?: number;
    }): void {
        const normalizedName = normalizePlayerName(playerName);
        if (!normalizedName) {
            return;
        }

        const rat = Math.trunc(ratDelta);
        const skeleton = Math.trunc(skeletonDelta);
        const kills = Math.trunc(killsDelta);
        const damage = Math.trunc(damageDelta);
        const revives = Math.trunc(revivesDelta);

        if (rat === 0 && skeleton === 0 && kills === 0 && damage === 0 && revives === 0) {
            return;
        }

        this.#ensureAchievementProgress(normalizedName);
        this.#incrementAchievementProgress.run(normalizedName, rat, skeleton, kills, damage, revives, Date.now());
    }

    listPasskeyCredentialsByName(
        accountNameKey: string
    ): Array<Readonly<{ credentialId: string; transports: AuthenticatorTransportFuture[] }>> {
        const normalizedName = normalizePlayerName(accountNameKey);
        if (!normalizedName) {
            return [];
        }
        const rows = this.#selectPasskeyCredentialsByName.all(normalizedName) as PasskeyCredentialByNameRow[];
        const out: Array<Readonly<{ credentialId: string; transports: AuthenticatorTransportFuture[] }>> = [];
        for (let i = 0; i < rows.length; i += 1) {
            const row = rows[i];
            if (!row?.credential_id) {
                continue;
            }
            out.push({
                credentialId: row.credential_id,
                transports: decodeTransportsJson(row.transports_json),
            });
        }
        return out;
    }

    getPasskeyCredentialByCredentialId(credentialId: string): PersistedPasskeyCredential | null {
        const normalizedCredentialId = credentialId.trim();
        if (!normalizedCredentialId) {
            return null;
        }
        const row = this.#selectPasskeyCredentialByCredential.get(normalizedCredentialId) as PasskeyCredentialByIdRow | null;
        if (!row) {
            return null;
        }
        const publicKey = toUint8Array(row.public_key);
        if (!publicKey || publicKey.length === 0) {
            return null;
        }
        return {
            accountNameKey: row.name_key,
            credentialId: row.credential_id,
            credentialPublicKey: publicKey,
            counter: Number.isSafeInteger(row.counter) && row.counter >= 0 ? row.counter : 0,
            transports: decodeTransportsJson(row.transports_json),
        };
    }

    registerPasskeyCredential({
        requestedName,
        credentialId,
        credentialPublicKey,
        counter = 0,
        transports = [],
    }: {
        requestedName: string;
        credentialId: string;
        credentialPublicKey: Uint8Array;
        counter?: number;
        transports?: ReadonlyArray<AuthenticatorTransportFuture>;
    }): PasskeyRegisterResult {
        const normalizedName = normalizePlayerName(requestedName);
        const normalizedCredentialId = credentialId.trim();
        const normalizedPublicKey = toUint8Array(credentialPublicKey);
        const normalizedCounter = Number.isSafeInteger(counter) && counter >= 0 ? counter : 0;

        if (!normalizedName) {
            return { accepted: false, reason: 'Invalid username.' };
        }
        if (normalizedCredentialId.length === 0) {
            return { accepted: false, reason: 'Invalid passkey credential id.' };
        }
        if (!normalizedPublicKey || normalizedPublicKey.length === 0) {
            return { accepted: false, reason: 'Invalid passkey public key.' };
        }

        const credentialOwner = this.#selectPasskeyCredentialByCredential.get(normalizedCredentialId) as
            | PasskeyCredentialByIdRow
            | null;
        if (credentialOwner && credentialOwner.name_key !== normalizedName) {
            return { accepted: false, reason: 'Passkey credential is already bound to another account.' };
        }

        let row = this.#selectProfile.get(normalizedName) as ProfileRow | null;
        const now = Date.now();
        const displayName = row?.display_name ?? resolveDisplayName(requestedName, normalizedName);
        if (!row) {
            this.#insertProfile.run(
                normalizedName,
                displayName,
                Number(DEFAULT_ARMOR_KIND),
                Number(DEFAULT_WEAPON_KIND),
                null,
                encodeProgressionState(defaultProgressionState()),
                now,
                now
            );
            row = this.#selectProfile.get(normalizedName) as ProfileRow | null;
        }

        this.#insertPasskeyCredential.run(
            normalizedName,
            normalizedCredentialId,
            normalizedPublicKey,
            normalizedCounter,
            encodeTransportsJson(transports),
            now,
            now
        );

        if (!row) {
            return { accepted: false, reason: 'Unable to load player profile.' };
        }

        return {
            accepted: true,
            accountNameKey: normalizedName,
            profile: asPersistedPlayerProfile(row, this.#getAchievementProgressByNameKey(normalizedName)),
        };
    }

    authenticatePasskeyCredential({
        requestedName,
        credentialId,
        nextCounter,
    }: {
        requestedName: string;
        credentialId: string;
        nextCounter?: number;
    }): PasskeyAuthenticateResult {
        const normalizedName = normalizePlayerName(requestedName);
        const normalizedCredentialId = credentialId.trim();
        if (!normalizedName) {
            return { accepted: false, reason: 'Invalid username.' };
        }
        if (normalizedCredentialId.length === 0) {
            return { accepted: false, reason: 'Invalid passkey credential id.' };
        }

        const hasAnyCredential = this.#selectAnyPasskeyCredentialByName.get(normalizedName) as
            | PasskeyCredentialByNameRow
            | null;
        if (!hasAnyCredential) {
            return { accepted: false, reason: 'No passkey is registered for this account.' };
        }

        const credential = this.#selectPasskeyCredentialByNameAndCredential.get(normalizedName, normalizedCredentialId) as
            | PasskeyCredentialByNameRow
            | null;
        if (!credential) {
            return { accepted: false, reason: 'Passkey assertion did not match this account.' };
        }

        const now = Date.now();
        const currentCounter =
            typeof credential.counter === 'number' && Number.isSafeInteger(credential.counter) && credential.counter >= 0
                ? credential.counter
                : 0;
        const normalizedCounter =
            typeof nextCounter === 'number' && Number.isSafeInteger(nextCounter) && nextCounter >= 0
                ? nextCounter
                : currentCounter;
        this.#touchPasskeyCredentialUse.run(normalizedName, normalizedCredentialId, normalizedCounter, now);
        const row = this.#selectProfile.get(normalizedName) as ProfileRow | null;
        if (!row) {
            return { accepted: false, reason: 'Unable to load player profile.' };
        }

        return {
            accepted: true,
            accountNameKey: normalizedName,
            profile: asPersistedPlayerProfile(row, this.#getAchievementProgressByNameKey(normalizedName)),
        };
    }

    close(): void {
        this.#db.close();
    }
}

export { DEFAULT_PLAYER_DB_PATH };
