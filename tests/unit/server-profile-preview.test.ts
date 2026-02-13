import { expect, test } from 'bun:test';
import Types from '../../shared/gametypes-browser';
import { createProfilePreviewJsonResponse, createProfilePreviewResponse } from '../../server/profile-preview';
import type { PersistedPlayerProfile } from '../../server/player-persistence';

function createProfile(armorKind: number): PersistedPlayerProfile {
    return {
        nameKey: 'hero',
        displayName: 'Hero',
        armorKind,
        weaponKind: Types.Entities.SWORD1,
        checkpointId: null,
        achievements: {
            unlockedIds: [],
            ratCount: 0,
            skeletonCount: 0,
            totalKills: 0,
            totalDmg: 0,
            totalRevives: 0,
        },
    };
}

test('profile preview falls back to default armor when username cookie is missing', async () => {
    const response = createProfilePreviewResponse({
        cookieHeader: null,
        profileLookup: {
            getProfileByName: () => null,
        },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('image/svg+xml');
    const body = await response.text();
    expect(body).toContain('armor:clotharmor;weapon:sword1');
    expect(body).toContain('data:image/png;base64,');
});

test('profile preview uses persisted armor when username cookie resolves a profile', async () => {
    const response = createProfilePreviewResponse({
        cookieHeader: 'foo=bar; bq_username=hero',
        profileLookup: {
            getProfileByName: (playerName) => (playerName === 'hero' ? createProfile(Types.Entities.GOLDENARMOR) : null),
        },
    });

    const body = await response.text();
    expect(body).toContain('armor:goldenarmor;weapon:sword1');
});

test('profile preview decodes username cookie values before profile lookup', async () => {
    const response = createProfilePreviewResponse({
        cookieHeader: 'bq_username=Knight%20Hero',
        profileLookup: {
            getProfileByName: (playerName) =>
                playerName === 'Knight Hero' ? createProfile(Types.Entities.REDARMOR) : null,
        },
    });

    const body = await response.text();
    expect(body).toContain('armor:redarmor;weapon:sword1');
});

test('profile preview composes persisted weapon layer metadata', async () => {
    const response = createProfilePreviewResponse({
        cookieHeader: 'bq_username=hero',
        profileLookup: {
            getProfileByName: () => ({
                ...createProfile(Types.Entities.LEATHERARMOR),
                weaponKind: Types.Entities.GOLDENSWORD,
            }),
        },
    });

    const body = await response.text();
    expect(body).toContain('armor:leatherarmor;weapon:goldensword');
});

test('profile preview json exposes resolved armor/weapon metadata for client composition', async () => {
    const response = createProfilePreviewJsonResponse({
        cookieHeader: 'bq_username=hero',
        profileLookup: {
            getProfileByName: () => ({
                ...createProfile(Types.Entities.GOLDENARMOR),
                weaponKind: Types.Entities.MORNINGSTAR,
            }),
        },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/json');
    const payload = (await response.json()) as {
        armorSpriteName?: string;
        weaponSpriteName?: string;
        hasProfile?: boolean;
    };
    expect(payload.armorSpriteName).toBe('goldenarmor');
    expect(payload.weaponSpriteName).toBe('morningstar');
    expect(payload.hasProfile).toBe(true);
});
