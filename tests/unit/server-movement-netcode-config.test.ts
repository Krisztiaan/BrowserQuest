import { afterEach, expect, test } from 'bun:test';
import {
    resolveServerMovementNetcodeConfig,
    setServerMovementNetcodeConfigForTests,
} from '../../server/movement-netcode-config';

afterEach(() => {
    setServerMovementNetcodeConfigForTests(null);
});

test('server movement netcode config defaults to farming/social profile', () => {
    const config = resolveServerMovementNetcodeConfig({});

    expect(config.profileId).toBe('farming_social');
    expect(config.rollout.serverMoveStepGrace).toBe(true);
    expect(config.rollout.serverInteractionGrace).toBe(true);
    expect(config.tuning.interactionGraceMaxAgeTicks).toBe(8);
    expect(config.tuning.interactionGraceHistoryLimit).toBe(4);
});

test('server movement netcode config honors env overrides', () => {
    const config = resolveServerMovementNetcodeConfig({
        BQ_MOVEMENT_PROFILE: 'minigame-critical',
        BQ_SERVER_MOVE_STEP_GRACE: '0',
        BQ_SERVER_INTERACTION_GRACE: 'false',
        BQ_PLAYER_PATHING_IGNORES_PLAYERS: 'no',
    });

    expect(config.profileId).toBe('minigame_critical');
    expect(config.rollout.serverMoveStepGrace).toBe(false);
    expect(config.rollout.serverInteractionGrace).toBe(false);
    expect(config.rollout.playerPathingIgnoresPlayers).toBe(false);
    expect(config.tuning.interactionGraceMaxAgeTicks).toBe(4);
    expect(config.tuning.interactionGraceHistoryLimit).toBe(3);
});

