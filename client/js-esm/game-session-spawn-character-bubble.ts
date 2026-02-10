type BubbleCharacter = {
    id: string | number;
    x: number;
    y: number;
    on(eventName: 'hasMoved', callback: (character: BubbleCharacter) => void): void;
};

type SpawnCharacterBubbleHost = {
    character: BubbleCharacter;
    assignBubbleTo(character: BubbleCharacter): void;
};

export function installSpawnedCharacterBubbleHandler(host: SpawnCharacterBubbleHost): void {
    host.character.on('hasMoved', function (character) {
        host.assignBubbleTo(character);
    });
}
