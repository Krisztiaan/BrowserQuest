import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import Types from '../shared/gametypes-browser';
import type { EntityKind } from '../shared/entity-kind-domain';

const DEFAULT_PLAYER_DB_PATH = './server/.data/player-profiles.sqlite';
const DEFAULT_ARMOR_KIND = Types.Entities.CLOTHARMOR as EntityKind;
const DEFAULT_WEAPON_KIND = Types.Entities.SWORD1 as EntityKind;

type ProfileRow = {
    name_key: string;
    display_name: string;
    armor_kind: number;
    weapon_kind: number;
    checkpoint_id: number | null;
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

export type PersistedAchievementProgress = Readonly<{
    unlockedIds: number[];
    ratCount: number;
    skeletonCount: number;
    totalKills: number;
    totalDmg: number;
    totalRevives: number;
}>;

export type PersistedPlayerProfile = Readonly<{
    nameKey: string;
    displayName: string;
    armorKind: EntityKind;
    weaponKind: EntityKind;
    checkpointId: number | null;
    achievements: PersistedAchievementProgress;
}>;

export type ClaimPlayerSessionResult =
    | Readonly<{ accepted: true; profile: PersistedPlayerProfile }>
    | Readonly<{ accepted: false; reason: string }>;

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

function asPersistedPlayerProfile(row: ProfileRow, achievements: PersistedAchievementProgress): PersistedPlayerProfile {
    return {
        nameKey: row.name_key,
        displayName: row.display_name,
        armorKind: row.armor_kind as EntityKind,
        weaponKind: row.weapon_kind as EntityKind,
        checkpointId: typeof row.checkpoint_id === 'number' ? row.checkpoint_id : null,
        achievements,
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
        `);

        this.#selectProfile = this.#db.prepare(
            `SELECT name_key, display_name, armor_kind, weapon_kind, checkpoint_id
             FROM players WHERE name_key = ?1`
        );
        this.#insertProfile = this.#db.prepare(
            `INSERT INTO players (name_key, display_name, armor_kind, weapon_kind, checkpoint_id, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
        );
        this.#updateProfileDisplayName = this.#db.prepare(
            `UPDATE players SET display_name = ?2, updated_at = ?3 WHERE name_key = ?1`
        );
        this.#upsertEquipment = this.#db.prepare(
            `INSERT INTO players (name_key, display_name, armor_kind, weapon_kind, checkpoint_id, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, NULL, ?5, ?6)
             ON CONFLICT(name_key) DO UPDATE SET
                display_name = excluded.display_name,
                armor_kind = excluded.armor_kind,
                weapon_kind = excluded.weapon_kind,
                updated_at = excluded.updated_at`
        );
        this.#upsertCheckpoint = this.#db.prepare(
            `INSERT INTO players (name_key, display_name, armor_kind, weapon_kind, checkpoint_id, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT(name_key) DO UPDATE SET
                display_name = excluded.display_name,
                checkpoint_id = excluded.checkpoint_id,
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

        this.#clearSessions.run();
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
    }: {
        connectionId: string;
        requestedName: string;
    }): ClaimPlayerSessionResult {
        const normalizedName = normalizePlayerName(requestedName);
        if (!normalizedName) {
            return {
                accepted: false,
                reason: 'Invalid player name.',
            };
        }

        const existingByName = this.#selectSessionByName.get(normalizedName) as SessionByNameRow | null;
        if (existingByName && existingByName.connection_id !== connectionId) {
            return {
                accepted: false,
                reason: 'A player with this name is already connected.',
            };
        }

        const existingByConnection = this.#selectSessionByConnection.get(connectionId) as SessionByConnectionRow | null;
        if (existingByConnection && existingByConnection.name_key !== normalizedName) {
            return {
                accepted: false,
                reason: 'Connection is already bound to a different player name.',
            };
        }

        const displayName = resolveDisplayName(requestedName, normalizedName);
        let row = this.#selectProfile.get(normalizedName) as ProfileRow | null;
        const now = Date.now();
        if (!row) {
            this.#insertProfile.run(
                normalizedName,
                displayName,
                Number(DEFAULT_ARMOR_KIND),
                Number(DEFAULT_WEAPON_KIND),
                null,
                now,
                now
            );
            row = this.#selectProfile.get(normalizedName) as ProfileRow | null;
        } else if (row.display_name !== displayName) {
            this.#updateProfileDisplayName.run(normalizedName, displayName, now);
            row = {
                ...row,
                display_name: displayName,
            };
        }

        if (!existingByName && !existingByConnection) {
            this.#insertSession.run(normalizedName, connectionId, Date.now());
        }

        if (!row) {
            return {
                accepted: false,
                reason: 'Unable to load player profile.',
            };
        }

        const achievements = this.#getAchievementProgressByNameKey(normalizedName);

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
        const displayName = resolveDisplayName(playerName, normalizedName);
        const now = Date.now();
        this.#upsertEquipment.run(
            normalizedName,
            displayName,
            Number(armorKind),
            Number(weaponKind),
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
        const displayName = resolveDisplayName(playerName, normalizedName);
        const existing = this.#selectProfile.get(normalizedName) as ProfileRow | null;
        const armorKind = existing ? existing.armor_kind : Number(DEFAULT_ARMOR_KIND);
        const weaponKind = existing ? existing.weapon_kind : Number(DEFAULT_WEAPON_KIND);
        const now = Date.now();
        this.#upsertCheckpoint.run(
            normalizedName,
            displayName,
            armorKind,
            weaponKind,
            checkpointId,
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

    close(): void {
        this.#db.close();
    }
}

export { DEFAULT_PLAYER_DB_PATH };
