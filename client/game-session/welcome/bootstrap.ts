import log from '../../platform/log';
import type { AchievementKey } from '../../achievement-domain';

type EntityId = string | number;

type WelcomePlayer = {
    id: EntityId;
    name: string;
    dirtyRect: Record<string, number> | null;
    setGridPosition(x: number, y: number): void;
    setMaxHitPoints(hp: number): void;
    getSpriteName(): string;
    getWeaponName(): string;
};

type WelcomeRenderer = {
    getPlayerBoundingRect(): Record<string, number>;
    getPlayerImage(callback: (playerImage: unknown) => void): void;
};

type WelcomeGameHost = {
    player: WelcomePlayer;
    setPlayerId(id: EntityId): void;
    renderer: WelcomeRenderer;
    storage: {
        hasAlreadyPlayed(): boolean;
        initPlayer(name: string): void;
        savePlayer(playerImage: unknown, spriteName: string, weaponName: string): void;
        setPlayerName(name: string): void;
    };
    updateBars(): void;
    resetCamera(): void;
    updatePlateauMode(): void;
    updateMusic(): void;
    addPlayerEntity(): void;
    tryUnlockingAchievement(id: AchievementKey): void;
    showNotification(message: string): void;
};

type WelcomePayload = {
    id: EntityId;
    name: string;
    x: number;
    y: number;
    hp: number;
};

export function applyWelcomeBootstrap(game: WelcomeGameHost, payload: WelcomePayload): void {
    log.info('Received player ID from server : ' + payload.id);
    game.player.id = payload.id;
    game.setPlayerId(payload.id);
    game.player.name = payload.name;
    game.player.setGridPosition(payload.x, payload.y);
    game.player.setMaxHitPoints(payload.hp);

    game.updateBars();
    game.resetCamera();
    game.updatePlateauMode();
    game.updateMusic();

    game.addPlayerEntity();
    game.player.dirtyRect = game.renderer.getPlayerBoundingRect();

    setTimeout(function (): void {
        game.tryUnlockingAchievement('STILL_ALIVE');
    }, 1500);

    if (!game.storage.hasAlreadyPlayed()) {
        game.storage.initPlayer(game.player.name);
        game.renderer.getPlayerImage(function (playerImage: unknown) {
            game.storage.savePlayer(playerImage, game.player.getSpriteName(), game.player.getWeaponName());
        });
        game.showNotification('Welcome to BrowserQuest!');
        return;
    }

    game.showNotification('Welcome back to BrowserQuest!');
    game.storage.setPlayerName(payload.name);
}
