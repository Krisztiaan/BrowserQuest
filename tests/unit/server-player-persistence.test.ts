import { afterEach, expect, test } from 'bun:test';
import { rmSync } from 'node:fs';
import path from 'node:path';
import Types from '../../shared/gametypes-browser';
import { SqlitePlayerPersistence } from '../../server/player-persistence';

const tempDbPaths: string[] = [];

function createPersistence(): SqlitePlayerPersistence {
    const dbPath = path.resolve(`./server/.tmp-player-persistence-${Date.now()}-${Math.floor(Math.random() * 100000)}.sqlite`);
    tempDbPaths.push(dbPath);
    return new SqlitePlayerPersistence(dbPath);
}

afterEach(() => {
    for (const dbPath of tempDbPaths.splice(0, tempDbPaths.length)) {
        try {
            rmSync(dbPath, { force: true });
        } catch (_) {
            // ignore cleanup errors
        }
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
