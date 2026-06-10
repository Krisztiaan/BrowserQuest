import { afterEach, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { rmSync } from 'node:fs';
import path from 'node:path';
import Types from '../../shared/gametypes-browser';
import { SqlitePlayerPersistence } from '../../server/player-persistence';

const tempDbPaths: string[] = [];

function createPersistence(): SqlitePlayerPersistence {
    const dbPath = path.resolve(
        `./server/.tmp-player-persistence-${Date.now()}-${Math.floor(Math.random() * 100000)}.sqlite`
    );
    tempDbPaths.push(dbPath);
    return new SqlitePlayerPersistence(dbPath);
}

afterEach(() => {
    for (const dbPath of tempDbPaths.splice(0, tempDbPaths.length)) {
        try {
            rmSync(dbPath, { force: true });
            rmSync(`${dbPath}-wal`, { force: true });
            rmSync(`${dbPath}-shm`, { force: true });
        } catch (_) {
            // ignore cleanup errors
        }
    }
});

test('player persistence initializes schema metadata version', () => {
    const persistence = createPersistence();
    const dbPath = persistence.databasePath;
    persistence.close();

    const db = new Database(dbPath, { readonly: true });
    try {
        const row = db.query(`SELECT value FROM schema_meta WHERE key = 'schema_version'`).get() as { value?: string } | null;
        expect(row?.value).toBe('1');
    } finally {
        db.close();
    }
});

test('player persistence creates default profile on first claim and reuses it later', () => {
    const persistence = createPersistence();
    const first = persistence.claimPlayerSession({
        connectionId: 'conn-1',
        requestedName: 'K',
    });
    expect(first.accepted).toBe(true);
    if (first.accepted) {
        expect(first.profile.displayName).toBe('K');
        expect(first.profile.armorKind).toBe(Types.Entities.CLOTHARMOR);
        expect(first.profile.weaponKind).toBe(Types.Entities.SWORD1);
        expect(first.profile.achievements.unlockedIds).toEqual([]);
        expect(first.profile.achievements.totalKills).toBe(0);
    }

    persistence.releasePlayerSession('conn-1');

    const second = persistence.claimPlayerSession({
        connectionId: 'conn-2',
        requestedName: 'k',
    });
    expect(second.accepted).toBe(true);
    if (second.accepted) {
        expect(second.profile.nameKey).toBe('k');
        expect(second.profile.displayName).toBe('k');
        expect(second.profile.armorKind).toBe(Types.Entities.CLOTHARMOR);
        expect(second.profile.weaponKind).toBe(Types.Entities.SWORD1);
        expect(second.profile.achievements.unlockedIds).toEqual([]);
    }

    persistence.close();
});

test('player persistence rejects duplicate active name on another connection', () => {
    const persistence = createPersistence();
    const first = persistence.claimPlayerSession({
        connectionId: 'conn-1',
        requestedName: 'K',
    });
    expect(first.accepted).toBe(true);

    const second = persistence.claimPlayerSession({
        connectionId: 'conn-2',
        requestedName: 'k',
    });
    expect(second.accepted).toBe(false);
    if (!second.accepted) {
        expect(second.reason).toContain('already connected');
    }

    persistence.close();
});

test('player persistence stores equipment and checkpoint updates server-side', () => {
    const persistence = createPersistence();
    const claim = persistence.claimPlayerSession({
        connectionId: 'conn-1',
        requestedName: 'Hero',
    });
    expect(claim.accepted).toBe(true);

    persistence.persistEquipment({
        playerName: 'Hero',
        armorKind: Types.Entities.GOLDENARMOR,
        weaponKind: Types.Entities.GOLDENSWORD,
    });
    persistence.persistCheckpoint({
        playerName: 'Hero',
        checkpointId: 42,
    });

    const profile = persistence.getProfileByName('hero');
    expect(profile).not.toBeNull();
    expect(profile?.armorKind).toBe(Types.Entities.GOLDENARMOR);
    expect(profile?.weaponKind).toBe(Types.Entities.GOLDENSWORD);
    expect(profile?.checkpointId).toBe(42);

    persistence.close();
});

test('player persistence stores and caps achievement counters + unlock ids', () => {
    const persistence = createPersistence();
    const claim = persistence.claimPlayerSession({
        connectionId: 'conn-1',
        requestedName: 'Hero',
    });
    expect(claim.accepted).toBe(true);

    persistence.incrementAchievementCounters({
        playerName: 'Hero',
        killsDelta: 200,
        ratDelta: 20,
        skeletonDelta: 20,
        damageDelta: 7000,
        revivesDelta: 10,
    });
    persistence.persistAchievementUnlock({ playerName: 'Hero', achievementId: 3 });
    persistence.persistAchievementUnlock({ playerName: 'hero', achievementId: 13 });
    persistence.persistAchievementUnlock({ playerName: 'hero', achievementId: 3 });

    const progress = persistence.getAchievementProgressByName('hero');
    expect(progress).not.toBeNull();
    expect(progress?.totalKills).toBe(50);
    expect(progress?.ratCount).toBe(10);
    expect(progress?.skeletonCount).toBe(10);
    expect(progress?.totalDmg).toBe(5000);
    expect(progress?.totalRevives).toBe(5);
    expect(progress?.unlockedIds).toEqual([3, 13]);

    persistence.close();
});

test('player persistence supports passkey registration and passkey authentication by account name key', () => {
    const persistence = createPersistence();
    const publicKey = new Uint8Array([1, 2, 3, 4]);

    const registered = persistence.registerPasskeyCredential({
        requestedName: 'Hero',
        credentialId: 'cred-hero-1',
        credentialPublicKey: publicKey,
        counter: 5,
        transports: ['internal'],
    });
    expect(registered.accepted).toBe(true);
    if (registered.accepted) {
        expect(registered.accountNameKey).toBe('hero');
        expect(registered.profile.accountNameKey).toBe('hero');
    }

    const authenticated = persistence.authenticatePasskeyCredential({
        requestedName: 'hero',
        credentialId: 'cred-hero-1',
        nextCounter: 9,
    });
    expect(authenticated.accepted).toBe(true);
    if (authenticated.accepted) {
        expect(authenticated.accountNameKey).toBe('hero');
        expect(authenticated.profile.nameKey).toBe('hero');
    }

    const stored = persistence.getPasskeyCredentialByCredentialId('cred-hero-1');
    expect(stored).not.toBeNull();
    expect(stored?.counter).toBe(9);
    expect(stored?.transports).toEqual(['internal']);
    expect(stored?.credentialPublicKey).toEqual(publicKey);

    const rejected = persistence.authenticatePasskeyCredential({
        requestedName: 'hero',
        credentialId: 'cred-hero-mismatch',
    });
    expect(rejected.accepted).toBe(false);
    if (!rejected.accepted) {
        expect(rejected.reason).toContain('did not match');
    }

    persistence.close();
});

test('player session claiming is account-bound even if display name changes', () => {
    const persistence = createPersistence();
    const registration = persistence.registerPasskeyCredential({
        requestedName: 'Hero',
        credentialId: 'cred-account-1',
        credentialPublicKey: new Uint8Array([9, 9, 9]),
    });
    expect(registration.accepted).toBe(true);

    const firstClaim = persistence.claimPlayerSession({
        connectionId: 'conn-1',
        requestedName: 'Hero Display One',
        authenticatedAccountNameKey: 'hero',
    });
    expect(firstClaim.accepted).toBe(true);

    const duplicateClaim = persistence.claimPlayerSession({
        connectionId: 'conn-2',
        requestedName: 'Hero Display Two',
        authenticatedAccountNameKey: 'hero',
    });
    expect(duplicateClaim.accepted).toBe(false);

    persistence.releasePlayerSession('conn-1');
    const secondClaim = persistence.claimPlayerSession({
        connectionId: 'conn-2',
        requestedName: 'Hero Display Two',
        authenticatedAccountNameKey: 'hero',
    });
    expect(secondClaim.accepted).toBe(true);
    if (secondClaim.accepted) {
        expect(secondClaim.profile.accountNameKey).toBe('hero');
        expect(secondClaim.profile.nameKey).toBe('hero');
        expect(secondClaim.profile.displayName).toBe('Hero Display Two');
    }

    persistence.persistCheckpoint({
        playerName: 'hero',
        checkpointId: 91,
    });
    const profile = persistence.getProfileByAccountNameKey('hero');
    expect(profile?.checkpointId).toBe(91);
    expect(persistence.getProfileByName('Hero Display Two')).toBeNull();

    persistence.close();
});

test('player persistence round-trips progression state fields', () => {
    const persistence = createPersistence();
    const claim = persistence.claimPlayerSession({
        connectionId: 'conn-progression',
        requestedName: 'Farmer',
    });
    expect(claim.accepted).toBe(true);

    persistence.persistProgression({
        playerName: 'farmer',
        progression: {
            gold: 420,
            farmingLevel: 5,
            farmingXp: 1234,
            homePlotClaimId: 7,
            inventory: [
                { itemKind: Types.Entities.FLASK, quantity: 3 },
                { itemKind: Types.Entities.BURGER, quantity: 1 },
            ],
        },
    });

    const profile = persistence.getProfileByAccountNameKey('farmer');
    expect(profile).not.toBeNull();
    expect(profile?.progression.gold).toBe(420);
    expect(profile?.progression.farmingLevel).toBe(5);
    expect(profile?.progression.farmingXp).toBe(1234);
    expect(profile?.progression.homePlotClaimId).toBe(7);
    expect(profile?.progression.inventory).toEqual([
        { itemKind: Types.Entities.FLASK, quantity: 3 },
        { itemKind: Types.Entities.BURGER, quantity: 1 },
    ]);

    persistence.close();
});

test('player persistence transfers chest stacks atomically into inventory', () => {
    const persistence = createPersistence();
    const chestId = 'world_01:5,6';
    const claim = persistence.claimPlayerSession({
        connectionId: 'conn-transfer',
        requestedName: 'Farmer',
    });
    expect(claim.accepted).toBe(true);
    persistence.setChestInventoryItem({ chestId, itemKind: Types.Entities.FLASK, quantity: 3 });

    const result = persistence.transferChestItem({
        accountNameKey: 'farmer',
        chestId,
        itemKind: Types.Entities.FLASK,
        quantity: 2,
        direction: 'chest_to_inventory',
    });
    expect(result).toEqual({ accepted: true });
    expect(persistence.getChestInventoryQuantity(chestId, Types.Entities.FLASK)).toBe(1);
    expect(persistence.getProfileByName('farmer')?.progression.inventory).toEqual([
        { itemKind: Types.Entities.FLASK, quantity: 2 },
    ]);

    const rejected = persistence.transferChestItem({
        accountNameKey: 'farmer',
        chestId,
        itemKind: Types.Entities.FLASK,
        quantity: 2,
        direction: 'chest_to_inventory',
    });
    expect(rejected).toEqual({ accepted: false, reason: 'insufficient_chest_quantity' });
    expect(persistence.getChestInventoryQuantity(chestId, Types.Entities.FLASK)).toBe(1);
    expect(persistence.getProfileByName('farmer')?.progression.inventory).toEqual([
        { itemKind: Types.Entities.FLASK, quantity: 2 },
    ]);

    persistence.close();
});
