type AggroPlayer = {
    id: string | number;
    gridX: number;
    gridY: number;
    on(eventName: 'checkAggro', callback: () => void): void;
    on(eventName: 'aggro', callback: (character: AggroCharacter) => void): void;
    isNear(mob: AggroMob, range: number): boolean;
    aggro(mob: AggroMob): void;
    isAttackedBy(character: AggroCharacter): boolean;
    log_info(message: string): void;
};

type AggroCharacter = {
    id: string | number;
    gridX: number;
    gridY: number;
    isWaitingToAttack?: (character: AggroCharacter) => boolean;
    waitToAttack?: (character: AggroCharacter) => void;
};

type AggroMob = AggroCharacter & {
    isAggressive: boolean;
    aggroRange: number;
    isAttacking(): boolean;
};

type AggroHost = {
    player: AggroPlayer;
    forEachMob(callback: (mob: AggroMob) => void): void;
    sendAggro(character: AggroCharacter): void;
};

export function installPlayerAggroHandlers(host: AggroHost): void {
    host.player.on('checkAggro', function () {
        host.forEachMob(function (mob) {
            if (mob.isAggressive && !mob.isAttacking() && host.player.isNear(mob, mob.aggroRange)) {
                host.player.aggro(mob);
            }
        });
    });

    host.player.on('aggro', function (character) {
        if (
            character.isWaitingToAttack
            && character.waitToAttack
            && !character.isWaitingToAttack(host.player)
            && !host.player.isAttackedBy(character)
        ) {
            host.player.log_info(
                'Aggroed by ' + character.id + ' at (' + host.player.gridX + ', ' + host.player.gridY + ')'
            );
            host.sendAggro(character);
            character.waitToAttack(host.player);
        }
    });
}
