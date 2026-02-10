type StopPathingCharacter = {
    on(eventName: 'stopPathing', callback: (x: number, y: number) => void): void;
};

type SpawnCharacterStopPathingHost = {
    character: StopPathingCharacter;
    isDying(): boolean;
    maybeLookAtTarget(): void;
    maybeHandleDoorDestination(): void;
    updateAttackers(): void;
    reregisterPosition(): void;
};

export function installSpawnedCharacterStopPathingHandler(host: SpawnCharacterStopPathingHost): void {
    host.character.on('stopPathing', function (_x, _y) {
        if (host.isDying()) {
            return;
        }

        host.maybeLookAtTarget();
        host.maybeHandleDoorDestination();
        host.updateAttackers();
        host.reregisterPosition();
    });
}
