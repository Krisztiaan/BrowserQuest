import { SUBPIXELS, TILE_SUBPX } from '../world/worldpos';

export type MovementTuningProfileId = 'farming_social' | 'combat_proximity' | 'minigame_critical';

export type MovementRolloutFlags = Readonly<{
    localPresentationMotor: boolean;
    remoteSmoothingTimeline: boolean;
    serverMoveStepGrace: boolean;
    serverInteractionGrace: boolean;
    playerPathingIgnoresPlayers: boolean;
}>;

export type ClientMovementTuningValues = Readonly<{
    moveCooldownMs: number;
    diagonalNumerator: number;
    diagonalDenominator: number;
    reconcileDeadzoneErrSubpx: number;
    softReconcileErrSubpx: number;
    hardReconcileErrSubpx: number;
    localPresentationSnapDistancePx: number;
    localPresentationTauActiveMs: number;
    localPresentationTauIdleMs: number;
    localPresentationMinStepPx: number;
    remotePresentationSnapDistancePx: number;
    remotePresentationTauMs: number;
    remoteInterpolationDelayMs: number;
    remoteSnapshotDiscontinuitySubpx: number;
    remoteExtrapolationMaxMs: number;
    remoteExtrapolationUndershoot: number;
    remoteSnapshotHistoryLimit: number;
}>;

export type ServerMovementTuningValues = Readonly<{
    interactionGraceMaxAgeTicks: number;
    interactionGraceHistoryLimit: number;
}>;

export type MovementTuningProfile = Readonly<{
    id: MovementTuningProfileId;
    label: string;
    intendedUse: string;
    client: ClientMovementTuningValues;
    server: ServerMovementTuningValues;
}>;

export const DEFAULT_CLIENT_MOVEMENT_TUNING_PROFILE: MovementTuningProfileId = 'combat_proximity';
export const DEFAULT_SERVER_MOVEMENT_TUNING_PROFILE: MovementTuningProfileId = 'farming_social';

export const DEFAULT_MOVEMENT_ROLLOUT_FLAGS: MovementRolloutFlags = Object.freeze({
    localPresentationMotor: true,
    remoteSmoothingTimeline: true,
    serverMoveStepGrace: true,
    serverInteractionGrace: true,
    playerPathingIgnoresPlayers: true,
});

export const MOVEMENT_TUNING_PROFILES: Readonly<Record<MovementTuningProfileId, MovementTuningProfile>> = Object.freeze(
    {
        farming_social: Object.freeze({
            id: 'farming_social',
            label: 'Farming / Social Traversal',
            intendedUse: 'Default MMO traversal feel with high continuity and moderate catch-up.',
            client: Object.freeze({
                moveCooldownMs: 200,
                diagonalNumerator: 181,
                diagonalDenominator: 256,
                reconcileDeadzoneErrSubpx: 3 * SUBPIXELS,
                softReconcileErrSubpx: 10 * SUBPIXELS,
                hardReconcileErrSubpx: TILE_SUBPX,
                localPresentationSnapDistancePx: 96,
                localPresentationTauActiveMs: 24,
                localPresentationTauIdleMs: 48,
                localPresentationMinStepPx: 0.6,
                remotePresentationSnapDistancePx: 96,
                remotePresentationTauMs: 80,
                remoteInterpolationDelayMs: 100,
                remoteSnapshotDiscontinuitySubpx: TILE_SUBPX * 2,
                remoteExtrapolationMaxMs: 75,
                remoteExtrapolationUndershoot: 0.75,
                remoteSnapshotHistoryLimit: 6,
            }),
            server: Object.freeze({
                interactionGraceMaxAgeTicks: 8,
                interactionGraceHistoryLimit: 4,
            }),
        }),
        combat_proximity: Object.freeze({
            id: 'combat_proximity',
            label: 'Combat Proximity',
            intendedUse: 'Tighter reconciliation and lower grace for combat-heavy slices.',
            client: Object.freeze({
                moveCooldownMs: 200,
                diagonalNumerator: 181,
                diagonalDenominator: 256,
                reconcileDeadzoneErrSubpx: 2 * SUBPIXELS,
                softReconcileErrSubpx: 8 * SUBPIXELS,
                hardReconcileErrSubpx: TILE_SUBPX,
                localPresentationSnapDistancePx: 76,
                localPresentationTauActiveMs: 16,
                localPresentationTauIdleMs: 32,
                localPresentationMinStepPx: 0.8,
                remotePresentationSnapDistancePx: 76,
                remotePresentationTauMs: 60,
                remoteInterpolationDelayMs: 84,
                remoteSnapshotDiscontinuitySubpx: Math.round(TILE_SUBPX * 1.6),
                remoteExtrapolationMaxMs: 50,
                remoteExtrapolationUndershoot: 0.6,
                remoteSnapshotHistoryLimit: 6,
            }),
            server: Object.freeze({
                interactionGraceMaxAgeTicks: 6,
                interactionGraceHistoryLimit: 4,
            }),
        }),
        minigame_critical: Object.freeze({
            id: 'minigame_critical',
            label: 'Minigame Critical',
            intendedUse: 'Fast catch-up and reduced grace for precision minigames.',
            client: Object.freeze({
                moveCooldownMs: 200,
                diagonalNumerator: 181,
                diagonalDenominator: 256,
                reconcileDeadzoneErrSubpx: 2 * SUBPIXELS,
                softReconcileErrSubpx: 6 * SUBPIXELS,
                hardReconcileErrSubpx: TILE_SUBPX,
                localPresentationSnapDistancePx: 72,
                localPresentationTauActiveMs: 14,
                localPresentationTauIdleMs: 28,
                localPresentationMinStepPx: 0.85,
                remotePresentationSnapDistancePx: 72,
                remotePresentationTauMs: 56,
                remoteInterpolationDelayMs: 80,
                remoteSnapshotDiscontinuitySubpx: Math.round(TILE_SUBPX * 1.5),
                remoteExtrapolationMaxMs: 45,
                remoteExtrapolationUndershoot: 0.55,
                remoteSnapshotHistoryLimit: 5,
            }),
            server: Object.freeze({
                interactionGraceMaxAgeTicks: 4,
                interactionGraceHistoryLimit: 3,
            }),
        }),
    }
);
