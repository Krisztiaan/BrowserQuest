import {
    DEFAULT_MOVEMENT_ROLLOUT_FLAGS,
    DEFAULT_MOVEMENT_TUNING_PROFILE,
    MOVEMENT_TUNING_PROFILES,
    type ClientMovementTuningValues,
    type MovementRolloutFlags,
    type MovementTuningProfileId,
} from '../shared/netcode/movement-tuning';

type MovementConfigGlobals = typeof globalThis & {
    __BQ_MOVEMENT_PROFILE__?: string;
    __BQ_MOVEMENT_FLAGS__?: Partial<Record<keyof MovementRolloutFlags, boolean | string | number | null>>;
};

type ClientMovementNetcodeConfig = Readonly<{
    profileId: MovementTuningProfileId;
    profileLabel: string;
    rollout: MovementRolloutFlags;
    tuning: ClientMovementTuningValues;
}>;

let configOverride: ClientMovementNetcodeConfig | null = null;

function normalizeProfileId(value: string | null | undefined): MovementTuningProfileId | null {
    if (typeof value !== 'string') {
        return null;
    }
    const normalized = value.trim().toLowerCase().replaceAll('-', '_');
    if (
        normalized === 'farming_social'
        || normalized === 'combat_proximity'
        || normalized === 'minigame_critical'
    ) {
        return normalized;
    }
    return null;
}

function normalizeFlagValue(value: boolean | string | number | null | undefined): boolean | null {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number') {
        return value !== 0;
    }
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

function readGlobalRolloutFlags(): MovementRolloutFlags {
    const override = (globalThis as MovementConfigGlobals).__BQ_MOVEMENT_FLAGS__;
    if (!override || typeof override !== 'object') {
        return DEFAULT_MOVEMENT_ROLLOUT_FLAGS;
    }

    return Object.freeze({
        localPresentationMotor:
            normalizeFlagValue(override.localPresentationMotor) ?? DEFAULT_MOVEMENT_ROLLOUT_FLAGS.localPresentationMotor,
        remoteSmoothingTimeline:
            normalizeFlagValue(override.remoteSmoothingTimeline) ?? DEFAULT_MOVEMENT_ROLLOUT_FLAGS.remoteSmoothingTimeline,
        serverMoveStepGrace:
            normalizeFlagValue(override.serverMoveStepGrace) ?? DEFAULT_MOVEMENT_ROLLOUT_FLAGS.serverMoveStepGrace,
        serverInteractionGrace:
            normalizeFlagValue(override.serverInteractionGrace) ?? DEFAULT_MOVEMENT_ROLLOUT_FLAGS.serverInteractionGrace,
        playerPathingIgnoresPlayers:
            normalizeFlagValue(override.playerPathingIgnoresPlayers) ?? DEFAULT_MOVEMENT_ROLLOUT_FLAGS.playerPathingIgnoresPlayers,
    });
}

export function resolveClientMovementNetcodeConfig(): ClientMovementNetcodeConfig {
    if (configOverride) {
        return configOverride;
    }

    const profileId =
        normalizeProfileId((globalThis as MovementConfigGlobals).__BQ_MOVEMENT_PROFILE__)
        ?? DEFAULT_MOVEMENT_TUNING_PROFILE;
    const profile = MOVEMENT_TUNING_PROFILES[profileId];
    return Object.freeze({
        profileId,
        profileLabel: profile.label,
        rollout: readGlobalRolloutFlags(),
        tuning: profile.client,
    });
}

export function setClientMovementNetcodeConfigForTests(config: ClientMovementNetcodeConfig | null): void {
    configOverride = config;
}

