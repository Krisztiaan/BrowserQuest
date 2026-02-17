import type { ClientWorldKernel } from '../world-kernel';

export type ClientEnvironmentSystemHost = Readonly<{
    started: boolean;
    kernel: ClientWorldKernel;
    map: {
        isPlateau(x: number, y: number): boolean;
        getCurrentCheckpoint(player: { gridX: number; gridY: number }): { id?: string | number | null } | null | undefined;
    } | null;
    player:
        | {
              gridX: number;
              gridY: number;
              isOnPlateau: boolean;
              lastCheckpoint: { id?: string | number | null } | null;
          }
        | null;
}>;

export function runClientEnvironmentSystem(host: ClientEnvironmentSystemHost): void {
    if (!host.started || !host.player || !host.map) {
        return;
    }

    const isOnPlateau = host.map.isPlateau(host.player.gridX, host.player.gridY);
    if (host.player.isOnPlateau !== isOnPlateau) {
        host.kernel.enqueueClientCommand({ type: 'setPlayerIsOnPlateau', isOnPlateau });
    }

    const checkpoint = host.map.getCurrentCheckpoint(host.player);
    if (checkpoint) {
        const checkpointId = checkpoint.id ?? undefined;
        const lastId = host.player.lastCheckpoint?.id ?? undefined;
        if (lastId !== checkpointId) {
            host.kernel.enqueueClientCommand({
                type: 'setPlayerLastCheckpoint',
                checkpoint: checkpointId === undefined ? {} : { id: checkpointId },
            });
            if (checkpointId !== undefined) {
                host.kernel.enqueueClientCommand({ type: 'clientSendCheck', checkpointId });
            }
        }
    }

    host.kernel.enqueueClientCommand({ type: 'audioUpdateMusic' });
}
