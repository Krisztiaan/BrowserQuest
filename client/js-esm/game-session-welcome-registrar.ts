import type Game from './game';
import { installConnectSessionHandlersFromGame } from './game-session-connect-registrations-builder';
import { handleConnectStartupTail } from './game-session-connect-tail';
import { installPlayerAggroHandlers } from './game-session-player-aggro';
import { installPlayerBeforeStepHandler } from './game-session-player-before-step';
import { installPlayerCosmeticHandlersFromGame } from './game-session-player-cosmetics-builder';
import { installPlayerDeathHandler } from './game-session-player-death';
import { installPlayerStartPathingHandler } from './game-session-player-pathing';
import { installPlayerRequestPathHandler } from './game-session-player-request-path';
import { installPlayerStepHandler } from './game-session-player-step';
import { installPlayerStopPathingHandler } from './game-session-player-stop-pathing';
import { installSpawnCharacterHandlerFromGame } from './game-session-spawn-character-registrar-builder';
import { installSpawnPrimitiveHandlersFromGame } from './game-session-spawn-primitives-host-builder';
import { applyWelcomeBootstrap } from './game-session-welcome';
import log from './compat/log';
import Types from '../../shared/js/gametypes-browser';

type AddEntityArg = Parameters<Game['addEntity']>[0];
type RemoveEntityArg = Parameters<Game['removeEntity']>[0];
type RemoveFromRenderingGridArg = Parameters<Game['removeFromRenderingGrid']>[0];
type AssignBubbleArg = Parameters<Game['assignBubbleTo']>[0];
type RegisterEntityDualArg = Parameters<Game['registerEntityDualPosition']>[0];
type FindPathCharacterArg = Parameters<Game['findPath']>[0];

export function registerWelcomeSessionHandlersFromGame(game: Game, startedCallback: () => void): void {
    const client = game.client;
    if (!client) {
        return;
    }

    client.on('welcome', function (id: string | number, name: string, x: number, y: number, hp: number) {
        applyWelcomeBootstrap(
            {
                player: game.player,
                setPlayerId(newPlayerId) {
                    game.playerId = newPlayerId;
                },
                renderer: {
                    getPlayerBoundingRect() {
                        return game.renderer!.getEntityBoundingRect(game.player);
                    },
                    getPlayerImage(callback) {
                        game.renderer!.getPlayerImage(callback);
                    },
                },
                storage: game.storage,
                updateBars() {
                    game.updateBars();
                },
                resetCamera() {
                    game.resetCamera();
                },
                updatePlateauMode() {
                    game.updatePlateauMode();
                },
                updateMusic() {
                    game.audioManager!.updateMusic();
                },
                addPlayerEntity() {
                    game.addEntity(game.player as unknown as AddEntityArg);
                },
                tryUnlockingAchievement(achievementId) {
                    game.tryUnlockingAchievement(achievementId);
                },
                showNotification(message) {
                    game.showNotification(message);
                },
            },
            { id, name, x, y, hp }
        );

        installPlayerStartPathingHandler({
            player: game.player,
            renderer: game.renderer!,
            sendMove(moveX, moveY) {
                client.sendMove(moveX, moveY);
            },
            setSelection(selectionX, selectionY) {
                game.selectedX = selectionX;
                game.selectedY = selectionY;
                game.selectedCellVisible = true;
            },
            enableMobileTargeting(targetRect) {
                game.drawTarget = true;
                game.clearTarget = true;
                game.renderer!.targetRect = targetRect;
            },
            checkTargetDirtyRect(targetRect, targetX, targetY) {
                game.checkOtherDirtyRects(targetRect, null, targetX, targetY);
            },
        });

        installPlayerAggroHandlers({
            player: game.player,
            forEachMob(callback) {
                game.forEachMob(callback);
            },
            sendAggro(mob) {
                client.sendAggro(mob);
            },
        });

        installPlayerBeforeStepHandler({
            player: game.player,
            playerId: game.playerId,
            getEntityAt(entityX, entityY) {
                return game.getEntityAt(entityX, entityY) || null;
            },
            unregisterPlayerPosition() {
                game.unregisterEntityPosition(game.player as unknown as Parameters<Game['unregisterEntityPosition']>[0]);
            },
        });

        installPlayerStepHandler({
            player: game.player,
            registerEntityDualPosition(playerEntity) {
                game.registerEntityDualPosition(playerEntity as unknown as RegisterEntityDualArg);
            },
            isZoningTile(tileX, tileY) {
                return game.isZoningTile(tileX, tileY);
            },
            enqueueZoningFrom(zoneX, zoneY) {
                game.enqueueZoningFrom(zoneX, zoneY);
            },
            tryUnlockingAchievement(achievementId) {
                game.tryUnlockingAchievement(achievementId);
            },
            updatePlayerCheckpoint() {
                game.updatePlayerCheckpoint();
            },
            updateMusic() {
                game.audioManager.updateMusic();
            },
        });

        installPlayerStopPathingHandler({
            player: game.player,
            playerId: game.playerId,
            map: game.map!,
            renderer: game.renderer!,
            camera: game.camera,
            client,
            onStopPathing(callback) {
                game.player.on('stopPathing', callback);
            },
            setSelectedCellVisible(visible) {
                game.selectedCellVisible = visible;
            },
            isItemAt(itemX, itemY) {
                return game.isItemAt(itemX, itemY);
            },
            getItemAt(itemX, itemY) {
                return game.getItemAt(itemX, itemY);
            },
            removeItem(item) {
                game.removeItem(item);
            },
            showNotification(message) {
                game.showNotification(message);
            },
            tryUnlockingAchievement(achievementId) {
                game.tryUnlockingAchievement(achievementId);
            },
            playSound(sound) {
                game.audioManager.playSound(sound);
            },
            isCake(kind) {
                return kind === Types.Entities.CAKE;
            },
            isFirePotion(kind) {
                return kind === Types.Entities.FIREPOTION;
            },
            isHealingItem(kind) {
                return Types.isHealingItem(kind);
            },
            assignBubbleToPlayer() {
                game.assignBubbleTo(game.player as unknown as AssignBubbleArg);
            },
            resetZone() {
                game.resetZone();
            },
            updatePlateauMode() {
                game.updatePlateauMode();
            },
            checkUndergroundAchievement() {
                game.checkUndergroundAchievement();
            },
            updateMusic() {
                game.audioManager.updateMusic();
            },
            unregisterPlayerPosition() {
                game.unregisterEntityPosition(game.player as unknown as Parameters<Game['unregisterEntityPosition']>[0]);
            },
            registerPlayerPosition() {
                game.registerEntityPosition(game.player as unknown as Parameters<Game['registerEntityPosition']>[0]);
            },
            makeNpcTalk(npc) {
                game.makeNpcTalk(npc);
            },
            scheduleUnlockCoward(delayMs) {
                setTimeout(function (): void {
                    game.tryUnlockingAchievement('COWARD');
                }, delayMs);
            },
        });

        installPlayerRequestPathHandler({
            player: game.player,
            findPath(playerEntity, pathX, pathY, ignored) {
                return game.findPath(playerEntity as unknown as FindPathCharacterArg, pathX, pathY, ignored);
            },
        });

        installPlayerDeathHandler({
            player: game.player,
            getDeathSprite() {
                return game.sprites.death;
            },
            removePlayerEntity(playerEntity) {
                game.removeEntity(playerEntity as unknown as RemoveEntityArg);
            },
            removePlayerFromRenderingGrid(playerEntity, renderX, renderY) {
                game.removeFromRenderingGrid(playerEntity as unknown as RemoveFromRenderingGridArg, renderX, renderY);
            },
            disableClient() {
                client.disable();
            },
            onPlayerRemoved() {
                game.player = null;
            },
            schedulePlayerDeathCallback(delayMs) {
                setTimeout(function (): void {
                    game.emit('playerDeath');
                }, delayMs);
            },
            fadeOutMusic() {
                game.audioManager.fadeOutCurrentMusic();
            },
            playDeathSound() {
                game.audioManager.playSound('death');
            },
            logInfo(message) {
                log.info(message);
            },
        });

        installPlayerCosmeticHandlersFromGame(game);
        installSpawnPrimitiveHandlersFromGame(game);

        installSpawnCharacterHandlerFromGame({
            game,
            addEntity(entity) {
                game.addEntity(entity as unknown as AddEntityArg);
            },
            assignBubbleTo(entity) {
                game.assignBubbleTo(entity as unknown as AssignBubbleArg);
            },
        });

        installConnectSessionHandlersFromGame({
            game,
            removeEntity(entity) {
                game.removeEntity(entity as unknown as RemoveEntityArg);
            },
            assignBubbleTo(entity) {
                game.assignBubbleTo(entity as unknown as AssignBubbleArg);
            },
        });

        handleConnectStartupTail({
            emitGameStart() {
                game.emit('gameStart');
            },
            hasNeverStarted: game.hasNeverStarted,
            startGame() {
                game.start();
            },
            onStarted() {
                startedCallback();
            },
        });
    });
}
