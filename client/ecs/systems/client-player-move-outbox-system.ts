import { gridPos } from '../../../shared/domain/positions';
import type { EntityId } from '../../../shared/domain/ids';
import type { ClientWorldKernel } from '../world-kernel';

export type ClientPlayerMoveOutboxSystemHost = Readonly<{
    started: boolean;
    kernel: ClientWorldKernel;
    client: { sendMove(x: number, y: number): void } | null;
    playerId: EntityId | null;
    player: { gridX: number; gridY: number } | null;

    isZoning(): boolean;
    isZoningTile(x: number, y: number): boolean;
    enqueueZoningFrom(x: number, y: number): void;
}>;

export function runClientPlayerMoveOutboxSystem(host: ClientPlayerMoveOutboxSystemHost): void {
    if (!host.started || !host.client || !host.playerId || !host.player) {
        return;
    }

    const x = host.player.gridX;
    const y = host.player.gridY;
    const last = host.kernel.clientLastSentMovePos;
    if (last && last.x === x && last.y === y) {
        return;
    }

    host.kernel.clientLastSentMovePos = gridPos(x, y);
    host.client.sendMove(x, y);

    if (!host.isZoning() && host.isZoningTile(x, y)) {
        host.enqueueZoningFrom(x, y);
    }
}

