import type { EntityId } from '../../../shared/domain/ids';
import type { ClientWorldKernel } from '../world-kernel';
import { SUBPIXELS, TILE_SUBPX, worldDelta, worldPos, type WorldPos } from '../../../shared/world/worldpos';
import { clampWorldPosInsideMap, resolveSubTileMotionAgainstTiles } from '../../../shared/world/collision/tile-collision';

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

const MOVE_COOLDOWN_MS = 200;
const DIAG_NUM = 181;
const DIAG_DEN = 256;
const PLAYER_HALF_EXTENTS = { hx: 6 * SUBPIXELS, hy: 6 * SUBPIXELS } as const;
const SOFT_RECONCILE_ERR_SUBPX = 8 * SUBPIXELS;
const HARD_RECONCILE_ERR_SUBPX = 2 * TILE_SUBPX;

let lastPredictionTimeMs = 0;

export function runClientMoveInputPredictionSystem(host: ClientMoveInputPredictionSystemHost): void {
    if (!host.started || !host.playerId || !host.player || !host.map) {
        return;
    }

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
            player.setWorldPositionSub(clampedAuth.x, clampedAuth.y, { snapRender: true });
        }
        return;
    }

    const axis = host.kernel.resolveClientMoveInputAxis();
    if (axis.dx === 0 && axis.dy === 0) {
        return;
    }

    // Seed prediction from last predicted state (preferred), otherwise from the current entity world position.
    const predicted: WorldPos = host.kernel.clientPredictedWorldPos ?? worldPos(player.worldX, player.worldY);

    const baseMoveSubpx = Math.round((dtMs * TILE_SUBPX) / MOVE_COOLDOWN_MS);
    if (baseMoveSubpx <= 0) {
        return;
    }

    const movingDiagonal = axis.dx !== 0 && axis.dy !== 0;
    const moveSubpx = movingDiagonal ? Math.round((baseMoveSubpx * DIAG_NUM) / DIAG_DEN) : baseMoveSubpx;

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
    let reconciled = next;
    if (auth) {
        const errX = auth.x - next.x;
        const errY = auth.y - next.y;
        const err = Math.abs(errX) + Math.abs(errY);
        if (err > HARD_RECONCILE_ERR_SUBPX) {
            reconciled = auth;
        } else if (err > SOFT_RECONCILE_ERR_SUBPX) {
            reconciled = worldPos(next.x + Math.trunc(errX / 6), next.y + Math.trunc(errY / 6));
        }
    }
    reconciled = clampWorldPosInsideMap({
        pos: reconciled,
        halfExtents: PLAYER_HALF_EXTENTS,
        mapWidthTiles,
        mapHeightTiles,
    });

    host.kernel.clientPredictedWorldPos = reconciled;
    player.setWorldPositionSub(reconciled.x, reconciled.y, { snapRender: true });
}
