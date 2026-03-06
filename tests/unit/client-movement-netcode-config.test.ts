import { afterEach, expect, test } from 'bun:test';
import {
    resolveClientMovementNetcodeConfig,
    setClientMovementNetcodeConfigForTests,
} from '../../client/movement-netcode-config';

type MovementGlobals = typeof globalThis & {
    __BQ_MOVEMENT_PROFILE__?: string;
    __BQ_MOVEMENT_FLAGS__?: Record<string, boolean | string | number | null> | undefined;
};

const originalProfile = (globalThis as MovementGlobals).__BQ_MOVEMENT_PROFILE__;
const originalFlags = (globalThis as MovementGlobals).__BQ_MOVEMENT_FLAGS__;

afterEach(() => {
    setClientMovementNetcodeConfigForTests(null);
    if (originalProfile === undefined) {
        delete (globalThis as MovementGlobals).__BQ_MOVEMENT_PROFILE__;
    } else {
        (globalThis as MovementGlobals).__BQ_MOVEMENT_PROFILE__ = originalProfile;
    }
    if (originalFlags === undefined) {
        delete (globalThis as MovementGlobals).__BQ_MOVEMENT_FLAGS__;
    } else {
        (globalThis as MovementGlobals).__BQ_MOVEMENT_FLAGS__ = originalFlags;
    }
});

test('client movement netcode config defaults to combat-proximity profile for a tighter presentation feel', () => {
    delete (globalThis as MovementGlobals).__BQ_MOVEMENT_PROFILE__;
    delete (globalThis as MovementGlobals).__BQ_MOVEMENT_FLAGS__;

    const config = resolveClientMovementNetcodeConfig();

    expect(config.profileId).toBe('combat_proximity');
    expect(config.rollout.localPresentationMotor).toBe(true);
    expect(config.rollout.remoteSmoothingTimeline).toBe(true);
    expect(config.tuning.remoteInterpolationDelayMs).toBe(90);
    expect(config.tuning.localPresentationTauActiveMs).toBe(18);
});

test('client movement netcode config honors global rollout overrides', () => {
    (globalThis as MovementGlobals).__BQ_MOVEMENT_PROFILE__ = 'combat-proximity';
    (globalThis as MovementGlobals).__BQ_MOVEMENT_FLAGS__ = {
        remoteSmoothingTimeline: 0,
        playerPathingIgnoresPlayers: 'false',
    };

    const config = resolveClientMovementNetcodeConfig();

    expect(config.profileId).toBe('combat_proximity');
    expect(config.tuning.remoteInterpolationDelayMs).toBe(90);
    expect(config.rollout.remoteSmoothingTimeline).toBe(false);
    expect(config.rollout.playerPathingIgnoresPlayers).toBe(false);
    expect(config.rollout.localPresentationMotor).toBe(true);
});
