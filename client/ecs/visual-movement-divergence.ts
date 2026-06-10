import type { WorldPos } from '../../shared/world/worldpos';
import { resolveClientMovementNetcodeConfig } from '../movement-netcode-config';
import type { VisualDivergenceClass, VisualMoveMode } from '../visual-character-state';

/**
 * Ticket 771:
 * Centralize the contract between gameplay divergence and visual recovery.
 * Ordinary movement should stay on continuous interpolation paths; only explicit
 * discontinuity classes may request snap-style recovery.
 */

export function classifyRemoteReplicationDivergence(
    currentPresentation: WorldPos | null,
    nextWorldPos: WorldPos
): VisualDivergenceClass {
    const tuning = resolveClientMovementNetcodeConfig().tuning;
    if (!currentPresentation) {
        return 'ordinary';
    }
    const divergence = Math.max(
        Math.abs(nextWorldPos.x - currentPresentation.x),
        Math.abs(nextWorldPos.y - currentPresentation.y)
    );
    return divergence > tuning.remoteSnapshotDiscontinuitySubpx ? 'remote_discontinuity' : 'ordinary';
}

export function classifyPredictionDivergence({
    suppressed,
    predictionError,
}: {
    suppressed: boolean;
    predictionError: number;
}): VisualDivergenceClass {
    if (suppressed) {
        return 'suppressed_resync';
    }
    if (predictionError > resolveClientMovementNetcodeConfig().tuning.hardReconcileErrSubpx) {
        return 'prediction_hard_reconcile';
    }
    return 'ordinary';
}

export function classifyInterpolationDivergence({
    isLocalPlayer,
    maxAxisDistancePx,
}: {
    isLocalPlayer: boolean;
    maxAxisDistancePx: number;
}): VisualDivergenceClass {
    const tuning = resolveClientMovementNetcodeConfig().tuning;
    const snapDistancePx = isLocalPlayer
        ? tuning.localPresentationSnapDistancePx
        : tuning.remotePresentationSnapDistancePx;
    return maxAxisDistancePx > snapDistancePx ? 'teleport' : 'ordinary';
}

export function isSnapVisualDivergenceClass(divergenceClass: VisualDivergenceClass): boolean {
    return (
        divergenceClass === 'suppressed_resync' ||
        divergenceClass === 'remote_discontinuity' ||
        divergenceClass === 'teleport'
    );
}

export function resolveVisualMoveModeForDivergenceClass(divergenceClass: VisualDivergenceClass): VisualMoveMode {
    return isSnapVisualDivergenceClass(divergenceClass) ? 'snap' : 'interpolate';
}
