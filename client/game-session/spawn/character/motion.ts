type SpawnedCharacterLike = {
    isDying: boolean;
    on(eventName: 'beforeStep', callback: () => void): void;
    on(eventName: 'step', callback: () => void): void;
};

type SpawnCharacterMotionHost<TCharacter extends SpawnedCharacterLike> = {
    character: TCharacter;
    handleBeforeStep(character: TCharacter): void;
    handleActiveStep(character: TCharacter): void;
};

export function installSpawnedCharacterMotionHandlers<TCharacter extends SpawnedCharacterLike>(
    host: SpawnCharacterMotionHost<TCharacter>
): void {
    host.character.on('beforeStep', function (): void {
        host.handleBeforeStep(host.character);
    });

    host.character.on('step', function (): void {
        if (!host.character.isDying) {
            host.handleActiveStep(host.character);
        }
    });
}
