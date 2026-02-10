type DeathAttacker = {
    disengage(): void;
};

type DeathCharacter = {
    id: string | number;
    gridX: number;
    gridY: number;
    isDying: boolean;
    on(eventName: 'death', callback: () => void): void;
    setSprite(sprite: unknown): void;
    animate(name: string, speed: number, count: number, callback: () => void): void;
    forEachAttacker(callback: (attacker: DeathAttacker) => void): void;
};

type SpawnCharacterDeathHost<TCharacter extends DeathCharacter> = {
    character: TCharacter;
    onCharacterDeathStart(character: TCharacter): void;
    getDeathSprite(character: TCharacter): unknown;
    onCharacterRemoved(character: TCharacter): void;
    disengagePlayerIfTarget(character: TCharacter): void;
    removeCharacterFromInteractionGrids(character: TCharacter): void;
    playKillSoundIfVisible(character: TCharacter): void;
    updateCursor(): void;
};

export function installSpawnedCharacterDeathHandler<TCharacter extends DeathCharacter>(
    host: SpawnCharacterDeathHost<TCharacter>
): void {
    host.character.on('death', function () {
        host.onCharacterDeathStart(host.character);

        host.character.isDying = true;
        host.character.setSprite(host.getDeathSprite(host.character));
        host.character.animate('death', 120, 1, function () {
            host.onCharacterRemoved(host.character);
        });

        host.character.forEachAttacker(function (attacker) {
            attacker.disengage();
        });

        host.disengagePlayerIfTarget(host.character);
        host.removeCharacterFromInteractionGrids(host.character);
        host.playKillSoundIfVisible(host.character);
        host.updateCursor();
    });
}
