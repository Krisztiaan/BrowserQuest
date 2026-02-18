import type { EntityId } from '../../../shared/domain/ids';
import { MOVE_INPUT_KEY_A, MOVE_INPUT_KEY_D, MOVE_INPUT_KEY_S, MOVE_INPUT_KEY_W } from '../../../shared/protocol/intents';
import type { ClientWorldKernel } from '../world-kernel';

export type ClientMoveInputPredictionSystemHost = Readonly<{
    started: boolean;
    kernel: ClientWorldKernel;
    playerId: EntityId | null;
    player:
        | {
              gridX: number;
              gridY: number;
              isDead: boolean;
              isOnPlateau: boolean;
              isMoving(): boolean;
              followPath(path: Array<[number, number]>): void;
          }
        | null;
    map:
        | {
              isColliding(x: number, y: number): boolean;
              isPlateau(x: number, y: number): boolean;
          }
        | null;
    isZoning(): boolean;
    isZoningTile(x: number, y: number): boolean;
}>;

export function runClientMoveInputPredictionSystem(host: ClientMoveInputPredictionSystemHost): void {
    if (!host.started || !host.playerId || !host.player || !host.map) {
        return;
    }

    const keysMask = host.kernel.clientMoveInputKeysMask >>> 0;
    if (keysMask === 0) {
        return;
    }

    if (host.isZoning() || host.player.isDead) {
        return;
    }

    const player = host.player;
    if (player.isMoving()) {
        return;
    }

    const activeKey = host.kernel.resolveClientMoveInputActiveKey();
    if (activeKey === null) {
        return;
    }

    let dx = 0;
    let dy = 0;
    if (activeKey === MOVE_INPUT_KEY_W) dy = -1;
    else if (activeKey === MOVE_INPUT_KEY_A) dx = -1;
    else if (activeKey === MOVE_INPUT_KEY_S) dy = 1;
    else if (activeKey === MOVE_INPUT_KEY_D) dx = 1;

    const nextX = player.gridX + dx;
    const nextY = player.gridY + dy;

    if (host.isZoningTile(nextX, nextY)) {
        return;
    }

    const hoveringCollidingTile = host.map.isColliding(nextX, nextY);
    const hoveringPlateauTile = player.isOnPlateau ? !host.map.isPlateau(nextX, nextY) : host.map.isPlateau(nextX, nextY);
    if (hoveringCollidingTile || hoveringPlateauTile) {
        return;
    }

    // Predict exactly one step; a held key will enqueue another step once the current one completes.
    player.followPath([
        [player.gridX, player.gridY],
        [nextX, nextY],
    ]);
}

