import log from './compat/log';

type IdentifiedEntity = {
    id: string | number;
};

type BeforeStepPlayer = {
    nextGridX: number;
    nextGridY: number;
    on(eventName: 'beforeStep', callback: () => void): void;
};

type BeforeStepHost = {
    player: BeforeStepPlayer;
    playerId: string | number | null;
    getEntityAt(x: number, y: number): IdentifiedEntity | null;
    unregisterPlayerPosition(): void;
};

export function installPlayerBeforeStepHandler(host: BeforeStepHost): void {
    host.player.on('beforeStep', function () {
        var blockingEntity = host.getEntityAt(host.player.nextGridX, host.player.nextGridY);
        if (blockingEntity && blockingEntity.id !== host.playerId) {
            log.debug('Blocked by ' + blockingEntity.id);
        }
        host.unregisterPlayerPosition();
    });
}
