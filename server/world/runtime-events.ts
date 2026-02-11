type Position = { x: number; y: number };

type MobAttackerLike = {
    type: string;
    target: string | number;
};

type RegeneratingCharacterLike = {
    type: string;
    maxHitPoints: number;
    hasFullHealth(): boolean;
    regenHealthBy(amount: number): void;
    regen(): unknown;
};

type RuntimeEventsWorld = {
    on(eventName: 'entityAttack', callback: (attacker: MobAttackerLike) => void): void;
    on(eventName: 'regenTick', callback: () => void): void;
    getEntityById(id: string | number): unknown;
    findPositionNextTo(entity: MobAttackerLike, target: unknown): Position;
    moveEntity(entity: MobAttackerLike, x: number, y: number): void;
    forEachCharacter(callback: (character: RegeneratingCharacterLike) => void): void;
    pushToPlayer(player: RegeneratingCharacterLike, message: unknown): void;
};

export function installWorldRuntimeEvents(world: RuntimeEventsWorld): void {
    world.on('entityAttack', function (attacker) {
        if (attacker.type === 'mob') {
            const target = world.getEntityById(attacker.target);
            if (target) {
                const pos = world.findPositionNextTo(attacker, target);
                world.moveEntity(attacker, pos.x, pos.y);
            }
        }
    });

    world.on('regenTick', function () {
        world.forEachCharacter(function (character) {
            if (!character.hasFullHealth()) {
                character.regenHealthBy(Math.floor(character.maxHitPoints / 25));

                if (character.type === 'player') {
                    world.pushToPlayer(character, character.regen());
                }
            }
        });
    });
}
