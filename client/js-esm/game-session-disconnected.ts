type DisconnectPlayer = {
    die(): void;
};

type DisconnectedHost<TPlayer extends DisconnectPlayer> = {
    player: TPlayer | null;
    message: string;
    onDisconnect: ((message: string) => void) | null;
};

export function handleDisconnected<TPlayer extends DisconnectPlayer>(host: DisconnectedHost<TPlayer>): void {
    if (host.player) {
        host.player.die();
    }

    if (host.onDisconnect) {
        host.onDisconnect(host.message);
    }
}
