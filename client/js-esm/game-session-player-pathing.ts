type PathingPlayer = {
    isLootMoving: boolean;
    on(eventName: 'startPathing', callback: (path: Array<[number, number]>) => void): void;
    isMovingToLoot(): boolean;
    isAttacking(): boolean;
};

type PathingRenderer = {
    mobile: boolean;
    tablet: boolean;
    getTargetBoundingRect(): Record<string, number>;
};

type StartPathingHost = {
    player: PathingPlayer;
    renderer: PathingRenderer;
    sendMove(x: number, y: number): void;
    setSelection(x: number, y: number): void;
    enableMobileTargeting(targetRect: Record<string, number>): void;
    checkTargetDirtyRect(targetRect: Record<string, number>, x: number, y: number): void;
};

export function installPlayerStartPathingHandler(host: StartPathingHost): void {
    host.player.on('startPathing', function (path: Array<[number, number]>): void {
        var i = path.length - 1;
        var x = path[i][0];
        var y = path[i][1];

        if (host.player.isMovingToLoot()) {
            host.player.isLootMoving = false;
        } else if (!host.player.isAttacking()) {
            host.sendMove(x, y);
        }

        host.setSelection(x, y);

        if (host.renderer.mobile || host.renderer.tablet) {
            var targetRect = host.renderer.getTargetBoundingRect();
            host.enableMobileTargeting(targetRect);
            host.checkTargetDirtyRect(targetRect, x, y);
        }
    });
}
