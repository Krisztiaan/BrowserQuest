import Character from './character';
import Player from './player';

type AttackEntity = {
    id: string | number;
};

type EntityAttackHost = {
    attacker: AttackEntity | null;
    target: AttackEntity | null;
    playerId: string | number | null;
    logAttack(attacker: AttackEntity, target: AttackEntity): void;
    createAttackLink(attacker: Character, target: Character): void;
    scheduleAttackLink(attacker: Character, target: Character, delayMs: number): void;
};

export function handleEntityAttack(host: EntityAttackHost): void {
    if (!host.attacker || !host.target || host.attacker.id === host.playerId) {
        return;
    }

    host.logAttack(host.attacker, host.target);

    if (
        host.attacker instanceof Character &&
        host.target instanceof Character &&
        host.target instanceof Player &&
        host.target.id !== host.playerId &&
        host.target.target &&
        host.target.target.id === host.attacker.id &&
        host.attacker.getDistanceToEntity(host.target) < 3
    ) {
        host.scheduleAttackLink(host.attacker, host.target, 200);
        return;
    }

    if (host.attacker instanceof Character && host.target instanceof Character) {
        host.createAttackLink(host.attacker, host.target);
    }
}
