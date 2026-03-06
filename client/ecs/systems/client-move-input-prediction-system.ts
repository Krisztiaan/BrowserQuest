import type { EntityId } from '../../../shared/domain/ids';
import type { ClientWorldKernel } from '../world-kernel';
import { SUBPIXELS, TILE_SUBPX, worldDelta, worldPos, type WorldPos } from '../../../shared/world/worldpos';
import { clampWorldPosInsideMap, resolveSubTileMotionAgainstTiles } from '../../../shared/world/collision/tile-collision';
import log from '../../platform/log';
import { resolveClientMovementNetcodeConfig } from '../../movement-netcode-config';

export type ClientMoveInputPredictionSystemHost = Readonly<{
    started: boolean;
    currentTime: number;
    kernel: ClientWorldKernel;
    playerId: EntityId | null;
    player:
        | {
              gridX: number;
              gridY: number;
              worldX: number;
              worldY: number;
              isDead: boolean;
              isOnPlateau: boolean;
              isMoving(): boolean;
              setWorldPositionSub(worldX: number, worldY: number, options?: { snapRender?: boolean }): void;
          }
        | null;
    map:
        | {
              isOutOfBounds(x: number, y: number): boolean;
              isColliding(x: number, y: number): boolean;
              isPlateau(x: number, y: number): boolean;
              width?: number;
              height?: number;
          }
        | null;
    isZoning(): boolean;
    isZoningTile(x: number, y: number): boolean;
}>;

const PLAYER_HALF_EXTENTS = { hx: 6 * SUBPIXELS, hy: 6 * SUBPIXELS } as const;

let lastPredictionTimeMs = 0;

function reconcileTowardAuthoritative(next: WorldPos, auth: WorldPos | undefined): WorldPos {
    if (!auth) {
        return next;
    }

    const tuning = resolveClientMovementNetcodeConfig().tuning;
    const errX = auth.x - next.x;
    const errY = auth.y - next.y;
    const err = Math.max(Math.abs(errX), Math.abs(errY));
    if (err <= tuning.reconcileDeadzoneErrSubpx) {
        return next;
    }
    if (err > tuning.hardReconcileErrSubpx) {
        return auth;
    }

    const divisor = err > tuning.softReconcileErrSubpx ? 8 : 16;
    return worldPos(next.x + Math.trunc(errX / divisor), next.y + Math.trunc(errY / divisor));
}

export function runClientMoveInputPredictionSystem(host: ClientMoveInputPredictionSystemHost): void {
    if (!host.started || !host.playerId || !host.player || !host.map) {
        return;
    }

    if (host.kernel.clientMovementNetcodeMode === 'lockstep') {
        host.kernel.clientPredictedWorldPos = null;
        lastPredictionTimeMs = 0;
        return;
    }
    const config = resolveClientMovementNetcodeConfig();
    const tuning = config.tuning;

    const map = host.map;
    const fallbackGrid = host.kernel.clientPathingGrid;
    const mapWidthTiles = Number.isInteger(map.width) && (map.width ?? 0) > 0
        ? (map.width as number)
        : (fallbackGrid?.[0]?.length ?? 0);
    const mapHeightTiles = Number.isInteger(map.height) && (map.height ?? 0) > 0
        ? (map.height as number)
        : (fallbackGrid?.length ?? 0);
    const keysMask = host.kernel.clientMoveInputKeysMask >>> 0;
    if (keysMask === 0) {
        host.kernel.clientPredictedWorldPos = null;
        lastPredictionTimeMs = 0;
        return;
    }

    if (host.isZoning() || host.player.isDead) {
        return;
    }

    const player = host.player;

    const now = host.currentTime;
    const dtMs = lastPredictionTimeMs > 0 ? Math.max(0, Math.min(100, now - lastPredictionTimeMs)) : 16;
    lastPredictionTimeMs = now;

    if (host.kernel.clientMovementSuppressed) {
        const auth = host.kernel.worldPosition.get(host.playerId);
        if (auth) {
            const clampedAuth = clampWorldPosInsideMap({
                pos: auth,
                halfExtents: PLAYER_HALF_EXTENTS,
                mapWidthTiles,
                mapHeightTiles,
            });
            host.kernel.clientPredictedWorldPos = clampedAuth;
            host.kernel.setClientPresentationTargetWorldPosition(host.playerId, clampedAuth.x, clampedAuth.y);
            host.kernel.setClientRenderedWorldPosition(host.playerId, clampedAuth.x, clampedAuth.y);
            player.setWorldPositionSub(clampedAuth.x, clampedAuth.y, { snapRender: true });
            log.warn({
                scope: 'movement_prediction',
                level: 'warn',
                event: 'prediction.suppressed_snap',
                playerId: host.playerId,
                profile: config.profileId,
                worldX: clampedAuth.x,
                worldY: clampedAuth.y,
            });
        }
        return;
    }

    const axis = host.kernel.resolveClientMoveInputAxis();
    if (axis.dx === 0 && axis.dy === 0) {
        return;
    }

    // Seed prediction from the local presentation target first so new input resumes from what the player
    // is already trying to do, not from a slightly older render/auth snapshot.
    const predicted: WorldPos =
        host.kernel.getClientPresentationTargetWorldPosition(host.playerId)
        ?? host.kernel.clientPredictedWorldPos
        ?? worldPos(player.worldX, player.worldY);

    const baseMoveSubpx = Math.round((dtMs * TILE_SUBPX) / tuning.moveCooldownMs);
    if (baseMoveSubpx <= 0) {
        return;
    }

    const movingDiagonal = axis.dx !== 0 && axis.dy !== 0;
    const moveSubpx = movingDiagonal
        ? Math.round((baseMoveSubpx * tuning.diagonalNumerator) / tuning.diagonalDenominator)
        : baseMoveSubpx;

    const isBlockedTile = (tx: number, ty: number): boolean => {
        if (map.isOutOfBounds(tx, ty) || host.isZoningTile(tx, ty)) {
            return true;
        }
        if (map.isColliding(tx, ty)) {
            return true;
        }
        const plateauBlocked = player.isOnPlateau ? !map.isPlateau(tx, ty) : map.isPlateau(tx, ty);
        return plateauBlocked;
    };

    let next = resolveSubTileMotionAgainstTiles({
        pos: predicted,
        delta: worldDelta(axis.dx * moveSubpx, axis.dy * moveSubpx),
        halfExtents: PLAYER_HALF_EXTENTS,
        isBlockedTile,
    }).pos;
    next = clampWorldPosInsideMap({
        pos: next,
        halfExtents: PLAYER_HALF_EXTENTS,
        mapWidthTiles,
        mapHeightTiles,
    });

    // Reconcile softly against authoritative world position (from MOVE_SYNC).
    const auth = host.kernel.worldPosition.get(host.playerId);
    const predictionError = auth ? Math.max(Math.abs(auth.x - next.x), Math.abs(auth.y - next.y)) : 0;
    let reconciled = reconcileTowardAuthoritative(next, auth);
    reconciled = clampWorldPosInsideMap({
        pos: reconciled,
        halfExtents: PLAYER_HALF_EXTENTS,
        mapWidthTiles,
        mapHeightTiles,
    });
    if (auth && predictionError > tuning.hardReconcileErrSubpx) {
            log.warn({
                scope: 'movement_prediction',
                level: 'warn',
                event: 'prediction.hard_reconcile',
                playerId: host.playerId,
                profile: config.profileId,
                authX: auth.x,
                authY: auth.y,
                predictedX: next.x,
                predictedY: next.y,
                reconciledX: reconciled.x,
                reconciledY: reconciled.y,
                divergence: predictionError,
            });
    }

    host.kernel.clientPredictedWorldPos = reconciled;
    host.kernel.setClientPresentationTargetWorldPosition(host.playerId, reconciled.x, reconciled.y);
    player.setWorldPositionSub(reconciled.x, reconciled.y);
}
