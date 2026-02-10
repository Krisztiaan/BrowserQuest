type TeleportAttacker = {
    disengage(): void;
    idle(): void;
    stop(): void;
};

type TeleportableCharacter = {
    orientation: number;
    setOrientation(orientation: number): void;
    forEachAttacker(callback: (attacker: TeleportAttacker) => void): void;
};

type PlayerTeleportHost<TCharacter extends TeleportableCharacter> = {
    entityId: string | number;
    localPlayerId: string | number | null;
    x: number;
    y: number;
    resolveEntity(entityId: string | number): TCharacter | null;
    teleportEntity(entity: TCharacter, x: number, y: number): void;
};

export function handlePlayerTeleport<TCharacter extends TeleportableCharacter>(
    host: PlayerTeleportHost<TCharacter>
): void {
    if (host.entityId === host.localPlayerId) {
        return;
    }

    const entity = host.resolveEntity(host.entityId);
    if (!entity) {
        return;
    }

    const currentOrientation = entity.orientation;
    host.teleportEntity(entity, host.x, host.y);
    entity.setOrientation(currentOrientation);

    entity.forEachAttacker(function (attacker) {
        attacker.disengage();
        attacker.idle();
        attacker.stop();
    });
}
