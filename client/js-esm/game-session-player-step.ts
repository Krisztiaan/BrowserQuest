type StepPlayer = {
    id: string | number;
    gridX: number;
    gridY: number;
    isDead: boolean;
    hasNextStep(): boolean;
    on(eventName: 'step', callback: () => void): void;
    forEachAttacker(callback: (attacker: StepAttacker) => void): void;
};

type StepAttacker = {
    target: CharacterLike | null;
    isAdjacent(target: CharacterLike | null): boolean;
    lookAtTarget(): void;
    follow(player: CharacterLike | null): void;
};

type CharacterLike = {
    id: string | number;
    gridX: number;
    gridY: number;
};

type PlayerStepAchievement = 'INTO_THE_WILD' | 'AT_WORLDS_END' | 'NO_MANS_LAND' | 'HOT_SPOT' | 'TOMB_RAIDER';

type PlayerStepHost = {
    player: StepPlayer;
    registerEntityDualPosition(player: StepPlayer): void;
    isZoningTile(x: number, y: number): boolean;
    enqueueZoningFrom(x: number, y: number): void;
    tryUnlockingAchievement(id: PlayerStepAchievement): void;
    updatePlayerCheckpoint(): void;
    updateMusic(): void;
};

export function installPlayerStepHandler(host: PlayerStepHost): void {
    host.player.on('step', function (): void {
        if (host.player.hasNextStep()) {
            host.registerEntityDualPosition(host.player);
        }

        if (host.isZoningTile(host.player.gridX, host.player.gridY)) {
            host.enqueueZoningFrom(host.player.gridX, host.player.gridY);
        }

        host.player.forEachAttacker(function (attacker: StepAttacker): void {
            if (attacker.isAdjacent(attacker.target)) {
                attacker.lookAtTarget();
            } else {
                attacker.follow(host.player);
            }
        });

        if (
            (host.player.gridX <= 85 && host.player.gridY <= 179 && host.player.gridY > 178) ||
            (host.player.gridX <= 85 && host.player.gridY <= 266 && host.player.gridY > 265)
        ) {
            host.tryUnlockingAchievement('INTO_THE_WILD');
        }

        if (host.player.gridX <= 85 && host.player.gridY <= 293 && host.player.gridY > 292) {
            host.tryUnlockingAchievement('AT_WORLDS_END');
        }

        if (host.player.gridX <= 85 && host.player.gridY <= 100 && host.player.gridY > 99) {
            host.tryUnlockingAchievement('NO_MANS_LAND');
        }

        if (host.player.gridX <= 85 && host.player.gridY <= 51 && host.player.gridY > 50) {
            host.tryUnlockingAchievement('HOT_SPOT');
        }

        if (host.player.gridX <= 27 && host.player.gridY <= 123 && host.player.gridY > 112) {
            host.tryUnlockingAchievement('TOMB_RAIDER');
        }

        host.updatePlayerCheckpoint();

        if (!host.player.isDead) {
            host.updateMusic();
        }
    });
}
