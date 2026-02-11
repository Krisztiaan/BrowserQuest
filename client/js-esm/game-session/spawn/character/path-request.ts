type PathRequestTarget = {
    id: string | number;
    forEachAttacker?(callback: (attacker: unknown) => void): void;
};

type PathRequestCharacter = {
    target: PathRequestTarget | null;
    previousTarget: PathRequestTarget | null;
    hasTarget(): boolean;
    setPathRequestResolver(callback: (x: number, y: number) => unknown): void;
};

type SpawnCharacterPathRequestHost = {
    character: PathRequestCharacter;
    findPath(character: PathRequestCharacter, x: number, y: number, ignored: unknown[]): unknown;
};

export function installSpawnedCharacterPathRequestHandler(host: SpawnCharacterPathRequestHost): void {
    host.character.setPathRequestResolver(function (x: number, y: number) {
        const ignored: unknown[] = [host.character];
        const ignoreTarget = function (target: PathRequestTarget): void {
            ignored.push(target);

            if (typeof target.forEachAttacker === 'function') {
                target.forEachAttacker(function (attacker: unknown) {
                    ignored.push(attacker);
                });
            }
        };

        if (host.character.hasTarget() && host.character.target) {
            ignoreTarget(host.character.target);
        } else if (host.character.previousTarget) {
            // If repositioning before attacking again, ignore previous target
            // See: tryMovingToADifferentTile()
            ignoreTarget(host.character.previousTarget);
        }

        return host.findPath(host.character, x, y, ignored);
    });
}
