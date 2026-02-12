export type ClientEnvironmentSystemHost = Readonly<{
    started: boolean;
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
    client: { sendCheck(id: number | string): void } | null;
    audioManager: { updateMusic(): void } | null;
}>;

export function runClientEnvironmentSystem(host: ClientEnvironmentSystemHost): void {
    if (!host.started || !host.player || !host.map) {
        return;
    }

    host.player.isOnPlateau = host.map.isPlateau(host.player.gridX, host.player.gridY);

    const checkpoint = host.map.getCurrentCheckpoint(host.player);
    if (checkpoint) {
        const lastId = host.player.lastCheckpoint?.id;
        if (lastId !== checkpoint.id) {
            host.player.lastCheckpoint = checkpoint;
            if (checkpoint.id !== undefined) {
                host.client?.sendCheck(checkpoint.id);
            }
        }
    }

    host.audioManager?.updateMusic();
}

