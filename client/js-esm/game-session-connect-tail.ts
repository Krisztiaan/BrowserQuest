type ConnectTailHost = {
    emitGameStart(): void;
    hasNeverStarted: boolean;
    startGame(): void;
    onStarted(): void;
};

export function handleConnectStartupTail(host: ConnectTailHost): void {
    host.emitGameStart();

    if (host.hasNeverStarted) {
        host.startGame();
        host.onStarted();
    }
}
