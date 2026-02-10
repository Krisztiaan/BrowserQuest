import Chest from './chest';
import Item from './item';
import Npc from './npc';
import Exceptions from './exceptions';
import type { EntityKind } from './compat/gametypes';

type EntityId = string | number;

type DoorDestination = {
    x: number;
    y: number;
    orientation: number;
    cameraX?: number;
    cameraY?: number;
    portal?: boolean;
};

type StopPathingItem = Item & {
    kind: EntityKind;
    wasDropped?: boolean;
    playersInvolved?: unknown;
};

type StopPathingAttacker = {
    target: unknown;
    isAdjacentNonDiagonal(player: StopPathingPlayer): boolean;
    follow(player: StopPathingPlayer): void;
    disengage(): void;
    idle(): void;
};

type StopPathingPlayer = {
    id: EntityId;
    x: number;
    y: number;
    gridX: number;
    gridY: number;
    nextGridX?: number;
    nextGridY?: number;
    target: unknown;
    attackers: Record<string, unknown>;
    isDead: boolean;
    hasTarget(): boolean;
    lookAtTarget(): void;
    loot(item: StopPathingItem): void;
    setGridPosition(x: number, y: number): void;
    turnTo(orientation: number): void;
    forEachAttacker(callback: (attacker: StopPathingAttacker) => void): void;
};

type StopPathingHost = {
    player: StopPathingPlayer;
    playerId: EntityId | null;
    map: {
        isDoor(x: number, y: number): boolean;
        getDoorDestination(x: number, y: number): DoorDestination;
    };
    renderer: {
        mobile: boolean;
        tablet: boolean;
        clearScreen(context: unknown): void;
        context: unknown;
    };
    camera: {
        setGridPosition(x: number, y: number): void;
        focusEntity(player: StopPathingPlayer): void;
    };
    client: {
        sendLoot(item: StopPathingItem): void;
        sendTeleport(x: number, y: number): void;
        sendOpen(chest: Chest): void;
    };
    onStopPathing(callback: (x: number, y: number) => void): void;
    setSelectedCellVisible(visible: boolean): void;
    isItemAt(x: number, y: number): boolean;
    getItemAt(x: number, y: number): StopPathingItem | null;
    removeItem(item: StopPathingItem): void;
    showNotification(message: string): void;
    tryUnlockingAchievement(id: 'FAT_LOOT' | 'A_TRUE_WARRIOR' | 'FOR_SCIENCE' | 'FOXY' | 'NINJA_LOOT' | 'COWARD'): void;
    playSound(sound: 'firefox' | 'heal' | 'loot' | 'noloot' | 'teleport' | 'chest'): void;
    isCake(kind: EntityKind): boolean;
    isFirePotion(kind: EntityKind): boolean;
    isHealingItem(kind: EntityKind): boolean;
    assignBubbleToPlayer(): void;
    resetZone(): void;
    updatePlateauMode(): void;
    checkUndergroundAchievement(): void;
    updateMusic(): void;
    unregisterPlayerPosition(): void;
    registerPlayerPosition(): void;
    makeNpcTalk(npc: Npc): void;
    scheduleUnlockCoward(delayMs: number): void;
};

export function installPlayerStopPathingHandler(host: StopPathingHost): void {
    host.onStopPathing(function (x, y) {
        if (host.player.hasTarget()) {
            host.player.lookAtTarget();
        }

        host.setSelectedCellVisible(false);

        if (host.isItemAt(x, y)) {
            const item = host.getItemAt(x, y);

            if (item) {
                try {
                    host.player.loot(item);
                    host.client.sendLoot(item);
                    host.removeItem(item);
                    host.showNotification(item.getLootMessage());

                    if (item.type === 'armor') {
                        host.tryUnlockingAchievement('FAT_LOOT');
                    }

                    if (item.type === 'weapon') {
                        host.tryUnlockingAchievement('A_TRUE_WARRIOR');
                    }

                    if (host.isCake(item.kind)) {
                        host.tryUnlockingAchievement('FOR_SCIENCE');
                    }

                    if (host.isFirePotion(item.kind)) {
                        host.tryUnlockingAchievement('FOXY');
                        host.playSound('firefox');
                    }

                    if (host.isHealingItem(item.kind)) {
                        host.playSound('heal');
                    } else {
                        host.playSound('loot');
                    }

                    const involvedPlayers = (
                        'playersInvolved' in item && Array.isArray(item.playersInvolved)
                            ? item.playersInvolved.filter((id): id is EntityId => typeof id === 'string' || typeof id === 'number')
                            : []
                    );
                    if (item.wasDropped && host.playerId !== null && !involvedPlayers.includes(host.playerId)) {
                        host.tryUnlockingAchievement('NINJA_LOOT');
                    }
                } catch (error) {
                    if (error instanceof Exceptions.LootException) {
                        host.showNotification(error.message);
                        host.playSound('noloot');
                    } else {
                        throw error;
                    }
                }
            }
        }

        if (!host.player.hasTarget() && host.map.isDoor(x, y)) {
            const destination = host.map.getDoorDestination(x, y);

            host.player.setGridPosition(destination.x, destination.y);
            host.player.nextGridX = destination.x;
            host.player.nextGridY = destination.y;
            host.player.turnTo(destination.orientation);
            host.client.sendTeleport(destination.x, destination.y);

            if (host.renderer.mobile && destination.cameraX && destination.cameraY) {
                host.camera.setGridPosition(destination.cameraX, destination.cameraY);
                host.resetZone();
            } else if (destination.portal) {
                host.assignBubbleToPlayer();
            } else {
                host.camera.focusEntity(host.player);
                host.resetZone();
            }

            if (Object.keys(host.player.attackers).length > 0) {
                host.scheduleUnlockCoward(500);
            }

            host.player.forEachAttacker(function (attacker) {
                attacker.disengage();
                attacker.idle();
            });

            host.updatePlateauMode();
            host.checkUndergroundAchievement();

            if (host.renderer.mobile || host.renderer.tablet) {
                host.renderer.clearScreen(host.renderer.context);
            }

            if (destination.portal) {
                host.playSound('teleport');
            }

            if (!host.player.isDead) {
                host.updateMusic();
            }
        }

        if (host.player.target instanceof Npc) {
            host.makeNpcTalk(host.player.target);
        } else if (host.player.target instanceof Chest) {
            host.client.sendOpen(host.player.target);
            host.playSound('chest');
        }

        host.player.forEachAttacker(function (attacker) {
            if (!attacker.isAdjacentNonDiagonal(host.player)) {
                attacker.follow(host.player);
            }
        });

        host.unregisterPlayerPosition();
        host.registerPlayerPosition();
    });
}
