import Types from './compat/gametypes';
import type { ClientInboundProtocolAction } from './client-boundary-types';
import { GAMECLIENT_INBOUND_HANDLER_OPCODES } from '../../shared/js/protocol-handler-opcodes';

type GameClientActionHandler = (data: ClientInboundProtocolAction) => void;

type GameClientInboundReceiver = {
    receiveWelcome(data: ClientInboundProtocolAction): void;
    receiveMove(data: ClientInboundProtocolAction): void;
    receiveLootMove(data: ClientInboundProtocolAction): void;
    receiveAttack(data: ClientInboundProtocolAction): void;
    receiveSpawn(data: ClientInboundProtocolAction): void;
    receiveDespawn(data: ClientInboundProtocolAction): void;
    receiveHealth(data: ClientInboundProtocolAction): void;
    receiveChat(data: ClientInboundProtocolAction): void;
    receiveEquipItem(data: ClientInboundProtocolAction): void;
    receiveDrop(data: ClientInboundProtocolAction): void;
    receiveTeleport(data: ClientInboundProtocolAction): void;
    receiveDamage(data: ClientInboundProtocolAction): void;
    receivePopulation(data: ClientInboundProtocolAction): void;
    receiveList(data: ClientInboundProtocolAction): void;
    receiveDestroy(data: ClientInboundProtocolAction): void;
    receiveKill(data: ClientInboundProtocolAction): void;
    receiveHitPoints(data: ClientInboundProtocolAction): void;
    receiveBlink(data: ClientInboundProtocolAction): void;
};

export function createGameClientInboundHandlers(
    receiver: GameClientInboundReceiver
): Record<ClientInboundProtocolAction[0], GameClientActionHandler> {
    return {
        [Types.Messages.WELCOME]: (data) => receiver.receiveWelcome(data),
        [Types.Messages.MOVE]: (data) => receiver.receiveMove(data),
        [Types.Messages.LOOTMOVE]: (data) => receiver.receiveLootMove(data),
        [Types.Messages.ATTACK]: (data) => receiver.receiveAttack(data),
        [Types.Messages.SPAWN]: (data) => receiver.receiveSpawn(data),
        [Types.Messages.DESPAWN]: (data) => receiver.receiveDespawn(data),
        [Types.Messages.HEALTH]: (data) => receiver.receiveHealth(data),
        [Types.Messages.CHAT]: (data) => receiver.receiveChat(data),
        [Types.Messages.EQUIP]: (data) => receiver.receiveEquipItem(data),
        [Types.Messages.DROP]: (data) => receiver.receiveDrop(data),
        [Types.Messages.TELEPORT]: (data) => receiver.receiveTeleport(data),
        [Types.Messages.DAMAGE]: (data) => receiver.receiveDamage(data),
        [Types.Messages.POPULATION]: (data) => receiver.receivePopulation(data),
        [Types.Messages.LIST]: (data) => receiver.receiveList(data),
        [Types.Messages.DESTROY]: (data) => receiver.receiveDestroy(data),
        [Types.Messages.KILL]: (data) => receiver.receiveKill(data),
        [Types.Messages.HP]: (data) => receiver.receiveHitPoints(data),
        [Types.Messages.BLINK]: (data) => receiver.receiveBlink(data),
    };
}
