import type { EntityId } from '../../../shared/domain/ids';
import type { ClientWorldKernel } from '../world-kernel';
import { SUBPIXELS, TILE_SUBPX, worldDelta, worldPos, type WorldPos } from '../../../shared/world/worldpos';
import {
    clampWorldPosInsideMap,
    resolveSubTileMotionAgainstTiles,
} from '../../../shared/world/collision/tile-collision';
import log from '../../platform/log';
import Types from '../../../shared/gametypes-browser';
import {
    MOVE_INPUT_KEY_A,
    MOVE_INPUT_KEY_D,
    MOVE_INPUT_KEY_S,
    MOVE_INPUT_KEY_W,
} from '../../../shared/protocol/intents';
import { resolveClientMovementNetcodeConfig } from '../../movement-netcode-config';
import { bridgeCharacterWorldUpdate } from '../visual-movement-bridge';
import type { VisualDivergenceClass, VisualMoveMode } from '../../visual-character-state';
import { classifyPredictionDivergence } from '../visual-movement-divergence';

export type ClientMoveInputPredictionSystemHost = Readonly<{
    started: boolean;
    currentTime: number;
    kernel: ClientWorldKernel;
    playerId: EntityId | null;
    player: {
        gridX: number;
        gridY: number;
        worldX: number;
        worldY: number;
        orientation: number;
        isDead: boolean;
        isOnPlateau: boolean;
        isMoving(): boolean;
        setVisualFacing(orientation: number): void;
        walk(orientation?: number): void;
        idle(orientation?: number): void;
        setLogicalWorldPositionSub(worldX: number, worldY: number): void;
        setVisualDivergenceClass(divergenceClass: VisualDivergenceClass): void;
        setVisualRenderTarget(x: number, y: number, mode?: VisualMoveMode): void;
        setVisualRenderPosition(
            x: number,
            y: number,
            options?: { velocityX?: number; velocityY?: number; mode?: VisualMoveMode }
        ): void;
    } | null;
    map: {
        isOutOfBounds(x: number, y: number): boolean;
        isColliding(x: number, y: number): boolean;
        isPlateau(x: number, y: number): boolean;
        width?: number;
        height?: number;
    } | null;
    isZoning(): boolean;
    isZoningTile(x: number, y: number): boolean;
}>;

const PLAYER_HALF_EXTENTS = { hx: 6 * SUBPIXELS, hy: 6 * SUBPIXELS } as const;
// Client-owned movement streams position at ~20Hz while moving (plus immediate
// updates on facing/moving changes) - frequent enough for smooth remote
// playback, sparse enough to stay well inside the server's speed envelope.
const MOVE_POS_SEND_INTERVAL_MS = 50;

let lastPredictionTimeMs = 0;
let lastMovePosSendMs = 0;
let lastMovePosSent: { x: number; y: number; facing: number; moving: boolean } | null = null;

export function resetClientMovePosOutboxForTests(): void {
    lastMovePosSendMs = 0;
    lastMovePosSent = null;
}

function resolveMoveInputFacing(kernel: ClientWorldKernel, fallback: number): number {
    switch (kernel.resolveClientMoveInputActiveKey()) {
        case MOVE_INPUT_KEY_W:
            return Types.Orientations.UP;
        case MOVE_INPUT_KEY_A:
            return Types.Orientations.LEFT;
        case MOVE_INPUT_KEY_S:
            return Types.Orientations.DOWN;
        case MOVE_INPUT_KEY_D:
            return Types.Orientations.RIGHT;
        default:
            return fallback >= 1 && fallback <= 4 ? fallback : Types.Orientations.DOWN;
    }
}

function maybeSendMovePos(
    kernel: ClientWorldKernel,
    pos: WorldPos,
    facing: number,
    moving: boolean,
    now: number
): void {
    const last = lastMovePosSent;
    const stateChanged = last?.facing !== facing || last.moving !== moving;
    const positionChanged = last?.x !== pos.x || last.y !== pos.y;
    const sendDue = now - lastMovePosSendMs >= MOVE_POS_SEND_INTERVAL_MS;
    if (!stateChanged && !(positionChanged && sendDue)) {
        return;
    }
    lastMovePosSendMs = now;
    lastMovePosSent = { x: pos.x, y: pos.y, facing, moving };
    kernel.enqueueClientCommand({ type: 'clientSendMovePos', x: pos.x, y: pos.y, facing, moving });
}

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
    // Owned mode: the client is the authority on its own sub-tile position and
    // streams it via move.pos; the server validates (speed envelope + collision)
    // instead of re-simulating, so there is no per-frame reconciliation pull.
    const ownedMovement = config.rollout.clientOwnedMovement && host.kernel.clientMovePosIntentSupported;

    const map = host.map;
    const fallbackGrid = host.kernel.clientPathingGrid;
    const mapWidthTiles =
        Number.isInteger(map.width) && (map.width ?? 0) > 0 ? (map.width as number) : (fallbackGrid?.[0]?.length ?? 0);
    const mapHeightTiles =
        Number.isInteger(map.height) && (map.height ?? 0) > 0 ? (map.height as number) : (fallbackGrid?.length ?? 0);
    const keysMask = host.kernel.clientMoveInputKeysMask >>> 0;
    if (keysMask === 0) {
        if (ownedMovement && lastMovePosSent?.moving && !host.kernel.clientMovementSuppressed && !host.player.isDead) {
            // Keys released: publish one final resting position so remote
            // clients settle exactly where we stopped and end their walk anim.
            const stopPos =
                host.kernel.getClientPresentationTargetWorldPosition(host.playerId) ??
                host.kernel.clientPredictedWorldPos ??
                worldPos(host.player.worldX, host.player.worldY);
            maybeSendMovePos(host.kernel, stopPos, lastMovePosSent.facing, false, host.currentTime);
        }
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
        // A correction/teleport overrides local ownership; restart the move.pos
        // stream from the resynced position once suppression clears.
        lastMovePosSent = null;
        lastMovePosSendMs = 0;
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
            player.setLogicalWorldPositionSub(clampedAuth.x, clampedAuth.y);
            bridgeCharacterWorldUpdate(player, {
                worldX: clampedAuth.x,
                worldY: clampedAuth.y,
                divergenceClass: classifyPredictionDivergence({ suppressed: true, predictionError: 0 }),
            });
            log.warn({
                scope: 'movement_prediction',
                level: 'warn',
                event: 'prediction.suppressed_snap',
                playerId: host.playerId,
                profile: config.profileId,
                worldX: clampedAuth.x,
                worldY: clampedAuth.y,
                divergenceClass: 'suppressed_resync',
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
        host.kernel.getClientPresentationTargetWorldPosition(host.playerId) ??
        host.kernel.clientPredictedWorldPos ??
        worldPos(player.worldX, player.worldY);

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
    // In owned mode MOVE_SYNC just echoes the positions we streamed, so pulling
    // toward it would fight the in-flight updates - hard resyncs arrive as
    // CORRECTIONs through the suppressed path instead.
    const auth = host.kernel.worldPosition.get(host.playerId);
    const predictionError = auth ? Math.max(Math.abs(auth.x - next.x), Math.abs(auth.y - next.y)) : 0;
    let reconciled = ownedMovement ? next : reconcileTowardAuthoritative(next, auth);
    reconciled = clampWorldPosInsideMap({
        pos: reconciled,
        halfExtents: PLAYER_HALF_EXTENTS,
        mapWidthTiles,
        mapHeightTiles,
    });
    if (!ownedMovement && auth && predictionError > tuning.hardReconcileErrSubpx) {
        const divergenceClass = classifyPredictionDivergence({ suppressed: false, predictionError });
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
            divergenceClass,
        });
    }

    host.kernel.clientPredictedWorldPos = reconciled;
    host.kernel.setClientPresentationTargetWorldPosition(host.playerId, reconciled.x, reconciled.y);
    player.setLogicalWorldPositionSub(reconciled.x, reconciled.y);
    if (ownedMovement) {
        maybeSendMovePos(host.kernel, reconciled, resolveMoveInputFacing(host.kernel, player.orientation), true, now);
    }
    bridgeCharacterWorldUpdate(player, {
        worldX: reconciled.x,
        worldY: reconciled.y,
        divergenceClass: classifyPredictionDivergence({
            suppressed: false,
            predictionError,
        }),
    });
}
