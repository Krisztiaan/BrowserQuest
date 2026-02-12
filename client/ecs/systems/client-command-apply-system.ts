import Item from '../../item';
import Mob from '../../mob';
import Npc from '../../npc';
import Chest from '../../chest';
import type Player from '../../player';
import type { EntityId } from '../../../shared/domain/ids';
import type { ClientCommand } from '../client-commands';
import type { ClientWorldKernel } from '../world-kernel';
import Exceptions from '../../exceptions';

export type ClientCommandApplySystemHost = Readonly<{
    kernel: ClientWorldKernel;
    started: boolean;
    client: { sendLoot(item: { id: EntityId }): void; sendOpen(chest: { id: EntityId }): void } | null;
    playerId: EntityId | null;
    player: Player;
    emit(eventName: 'notification', message: string): void;

    stopPlayerCombat(): void;
    makePlayerGoTo(x: number, y: number): void;
    makePlayerGoToItem(item: Item | null): void;
    getEntityById(id: EntityId): unknown;

    makePlayerAttack(mob: Mob): void;
    makePlayerTalkTo(npc: Npc): void;
    makePlayerOpenChest(chest: Chest): void;
    makeNpcTalk(npc: Npc): void;
}>;

export function runClientCommandApplySystem(host: ClientCommandApplySystemHost): void {
    const commands: ClientCommand[] = host.kernel.drainClientCommands();
    if (commands.length === 0) {
        return;
    }

    for (const command of commands) {
        switch (command.type) {
            case 'stopPlayerCombat': {
                host.stopPlayerCombat();
                break;
            }
            case 'playerGoTo': {
                host.makePlayerGoTo(command.x, command.y);
                break;
            }
            case 'playerGoToItem': {
                const entity = host.getEntityById(command.itemId);
                host.makePlayerGoToItem(entity instanceof Item ? entity : null);
                break;
            }
            case 'playerAttack': {
                const entity = host.getEntityById(command.targetId);
                if (entity instanceof Mob) {
                    host.makePlayerAttack(entity);
                }
                break;
            }
            case 'playerFollow': {
                const entity = host.getEntityById(command.targetId);
                if (entity && typeof (entity as { gridX?: unknown; gridY?: unknown }).gridX === 'number') {
                    host.player.follow(entity as never);
                }
                break;
            }
            case 'playerTalkTo': {
                const entity = host.getEntityById(command.npcId);
                if (entity instanceof Npc) {
                    host.makePlayerTalkTo(entity);
                }
                break;
            }
            case 'npcTalk': {
                const entity = host.getEntityById(command.npcId);
                if (entity instanceof Npc) {
                    host.makeNpcTalk(entity);
                }
                break;
            }
            case 'playerOpenChest': {
                const entity = host.getEntityById(command.chestId);
                if (entity instanceof Chest) {
                    host.makePlayerOpenChest(entity);
                }
                break;
            }
            case 'clientSendOpen': {
                const entity = host.getEntityById(command.chestId);
                if (host.started && host.client && entity instanceof Chest) {
                    host.client.sendOpen(entity);
                }
                break;
            }
            case 'tryLoot': {
                if (!host.started || !host.client || !host.playerId) {
                    break;
                }
                const intent = host.kernel.clientInteractionIntent;
                if (!intent || intent.kind !== 'loot' || intent.targetId !== command.itemId) {
                    break;
                }

                const entity = host.getEntityById(command.itemId);
                if (!(entity instanceof Item)) {
                    host.kernel.clearClientLootAttempt();
                    host.kernel.clearClientInteractionIntent();
                    break;
                }

                try {
                    host.player.loot({
                        id: entity.id,
                        kind: entity.kind,
                        type: entity.type,
                        onLoot: () => {},
                    });
                } catch (err) {
                    if (err instanceof Exceptions.LootException) {
                        host.emit('notification', err.message);
                        host.kernel.clearClientLootAttempt();
                        if (
                            host.kernel.clientInteractionIntent?.kind === 'loot' &&
                            host.kernel.clientInteractionIntent.targetId === entity.id
                        ) {
                            host.kernel.clearClientInteractionIntent();
                        }
                        break;
                    }
                    throw err;
                }

                host.client.sendLoot(entity);
                host.kernel.clearClientLootAttempt();
                if (
                    host.kernel.clientInteractionIntent?.kind === 'loot' &&
                    host.kernel.clientInteractionIntent.targetId === entity.id
                ) {
                    host.kernel.clearClientInteractionIntent();
                }
                break;
            }
            case 'playerStop': {
                host.player.stop();
                break;
            }
            case 'playerDisengage': {
                host.player.disengage();
                break;
            }
            case 'playerIdle': {
                host.player.idle();
                break;
            }
            case 'emitNotification': {
                host.emit('notification', command.message);
                break;
            }
        }
    }
}
