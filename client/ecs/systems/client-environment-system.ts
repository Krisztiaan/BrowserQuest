import type { ClientWorldKernel } from '../world-kernel';

export type ClientEnvironmentSystemHost = Readonly<{
    started: boolean;
    kernel: ClientWorldKernel;
    map: {
        isPlateau(x: number, y: number): boolean;
        getCurrentCheckpoint(player: unknown): { id?: string | number } | null;
    } | null;
    player:
        | (unknown & {
              gridX: number;
              gridY: number;
              isOnPlateau: boolean;
              lastCheckpoint: { id?: string | number } | null;
          })
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
        const lastId = host.player.lastCheckpoint?.id;
        if (lastId !== checkpoint.id) {
            host.kernel.enqueueClientCommand({ type: 'setPlayerLastCheckpoint', checkpoint });
            if (checkpoint.id !== undefined) {
                host.kernel.enqueueClientCommand({ type: 'clientSendCheck', checkpointId: checkpoint.id });
            }
        }
    }

    host.kernel.enqueueClientCommand({ type: 'audioUpdateMusic' });
}
