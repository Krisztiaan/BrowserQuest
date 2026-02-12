import type { EntityId } from '../../../shared/domain/ids';
import type { ClientWorldKernel } from '../world-kernel';

export type ClientPlayerMoveOutboxSystemHost = Readonly<{
    started: boolean;
    kernel: ClientWorldKernel;
    playerId: EntityId | null;
    player: { gridX: number; gridY: number } | null;

    isZoning(): boolean;
    isZoningTile(x: number, y: number): boolean;
}>;

export function runClientPlayerMoveOutboxSystem(host: ClientPlayerMoveOutboxSystemHost): void {
    if (!host.started || !host.playerId || !host.player) {
        return;
    }

    const x = host.player.gridX;
    const y = host.player.gridY;
    const last = host.kernel.clientLastSentMovePos;
    if (last && last.x === x && last.y === y) {
        return;
    }

    host.kernel.enqueueClientCommand({ type: 'clientSendMove', x, y });

    if (!host.isZoning() && host.isZoningTile(x, y)) {
        host.kernel.enqueueClientCommand({ type: 'enqueueZoningFrom', x, y });
    }
}
