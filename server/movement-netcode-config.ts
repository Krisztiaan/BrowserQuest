import {
    DEFAULT_MOVEMENT_ROLLOUT_FLAGS,
    DEFAULT_SERVER_MOVEMENT_TUNING_PROFILE,
    MOVEMENT_TUNING_PROFILES,
    type MovementRolloutFlags,
    type MovementTuningProfileId,
    type ServerMovementTuningValues,
} from '../shared/netcode/movement-tuning';

type ServerMovementNetcodeConfig = Readonly<{
    profileId: MovementTuningProfileId;
    profileLabel: string;
    rollout: MovementRolloutFlags;
    tuning: ServerMovementTuningValues;
}>;

type EnvMap = Readonly<Record<string, string | undefined>>;

let configOverride: ServerMovementNetcodeConfig | null = null;

function normalizeProfileId(value: string | undefined): MovementTuningProfileId | null {
    if (typeof value !== 'string') {
        return null;
    }
    const normalized = value.trim().toLowerCase().replaceAll('-', '_');
    if (normalized === 'farming_social' || normalized === 'combat_proximity' || normalized === 'minigame_critical') {
        return normalized;
    }
    return null;
}

function normalizeFlagValue(value: string | undefined): boolean | null {
    if (typeof value !== 'string') {
        return null;
    }
    const normalized = value.trim().toLowerCase();
    if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') {
        return true;
    }
    if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') {
        return false;
    }
    return null;
}

function resolveRolloutFlags(env: EnvMap): MovementRolloutFlags {
    return Object.freeze({
        localPresentationMotor:
            normalizeFlagValue(env.BQ_LOCAL_PRESENTATION_MOTOR) ??
            DEFAULT_MOVEMENT_ROLLOUT_FLAGS.localPresentationMotor,
        remoteSmoothingTimeline:
            normalizeFlagValue(env.BQ_REMOTE_SMOOTHING_TIMELINE) ??
            DEFAULT_MOVEMENT_ROLLOUT_FLAGS.remoteSmoothingTimeline,
        serverMoveStepGrace:
            normalizeFlagValue(env.BQ_SERVER_MOVE_STEP_GRACE) ?? DEFAULT_MOVEMENT_ROLLOUT_FLAGS.serverMoveStepGrace,
        serverInteractionGrace:
            normalizeFlagValue(env.BQ_SERVER_INTERACTION_GRACE) ??
            DEFAULT_MOVEMENT_ROLLOUT_FLAGS.serverInteractionGrace,
        playerPathingIgnoresPlayers:
            normalizeFlagValue(env.BQ_PLAYER_PATHING_IGNORES_PLAYERS) ??
            DEFAULT_MOVEMENT_ROLLOUT_FLAGS.playerPathingIgnoresPlayers,
        clientOwnedMovement:
            normalizeFlagValue(env.BQ_CLIENT_OWNED_MOVEMENT) ?? DEFAULT_MOVEMENT_ROLLOUT_FLAGS.clientOwnedMovement,
    });
}

export function resolveServerMovementNetcodeConfig(env: EnvMap = process.env): ServerMovementNetcodeConfig {
    if (configOverride) {
        return configOverride;
    }

    const profileId = normalizeProfileId(env.BQ_MOVEMENT_PROFILE) ?? DEFAULT_SERVER_MOVEMENT_TUNING_PROFILE;
    const profile = MOVEMENT_TUNING_PROFILES[profileId];
    return Object.freeze({
        profileId,
        profileLabel: profile.label,
        rollout: resolveRolloutFlags(env),
        tuning: profile.server,
    });
}

export function setServerMovementNetcodeConfigForTests(config: ServerMovementNetcodeConfig | null): void {
    configOverride = config;
}
