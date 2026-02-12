import type { EntityId } from '../../../shared/domain/ids';
import type { ClientWorldKernel } from '../world-kernel';
import type { ClientRuntimeEvent } from '../runtime-events';
export type ClientRuntimeEventSystemHost = {
    kernel: ClientWorldKernel;
};

export function runClientRuntimeEventSystem(host: ClientRuntimeEventSystemHost): void {
    const events = host.kernel.drainClientRuntimeEvents();
    if (events.length === 0) {
        return;
    }

    for (const event of events) {
        switch (event.type) {
            case 'welcome': {
                host.kernel.enqueueClientCommand({
                    type: 'applyWelcome',
                    id: event.id,
                    name: event.name,
                    x: event.x,
                    y: event.y,
                    maxHp: event.maxHp,
                });
                host.kernel.enqueueClientCommand({ type: 'invokeConnectionStartedCallback' });
                break;
            }
            case 'populationChange': {
                host.kernel.enqueueClientCommand({
                    type: 'emitNbPlayersChange',
                    worldPlayers: event.worldPlayers,
                    totalPlayers: event.totalPlayers,
                });
                break;
            }
            case 'entityList': {
                host.kernel.enqueueClientCommand({ type: 'applyEntityList', list: event.list });
                break;
            }
            case 'playerTeleport': {
                host.kernel.enqueueClientCommand({
                    type: 'teleportEntity',
                    entityId: event.entityId,
                    x: event.x,
                    y: event.y,
                });
                break;
            }
            case 'playerMoveToItem': {
                host.kernel.enqueueClientCommand({
                    type: 'playerMoveToItem',
                    playerId: event.playerId,
                    itemId: event.itemId,
                });
                break;
            }
            case 'playerChangeHealth': {
                host.kernel.enqueueClientCommand({
                    type: 'setPlayerHealth',
                    points: event.points,
                    isRegen: event.isRegen,
                });
                break;
            }
            case 'playerChangeMaxHitPoints': {
                host.kernel.enqueueClientCommand({ type: 'setPlayerMaxHitPoints', maxHp: event.maxHp });
                break;
            }
            case 'chatMessage': {
                host.kernel.enqueueClientCommand({
                    type: 'chatMessage',
                    entityId: event.entityId,
                    text: event.text,
                });
                break;
            }
            case 'playerEquipItem': {
                host.kernel.enqueueClientCommand({
                    type: 'equipItem',
                    entityId: event.entityId,
                    itemKind: event.itemKind,
                });
                break;
            }
            case 'dropItem': {
                host.kernel.enqueueClientCommand({ type: 'dropItem', item: event.item, mobId: event.mobId });
                break;
            }
            case 'itemBlink': {
                host.kernel.enqueueClientCommand({ type: 'itemBlink', entityId: event.entityId });
                break;
            }
        }
    }
}
