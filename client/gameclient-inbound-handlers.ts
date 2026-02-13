import type { ClientInboundActionByOpcode, ClientInboundProtocolAction } from './client-boundary-types';
import Types from '../shared/gametypes-browser';

export type GameClientInboundActionHandlerMap = {
    [Opcode in ClientInboundProtocolAction[0]]: (data: ClientInboundActionByOpcode<Opcode>) => void;
};

type GameClientInboundReceiver = {
    receiveWelcome(data: ClientInboundActionByOpcode<typeof Types.Messages.WELCOME>): void;
    receiveMove(data: ClientInboundActionByOpcode<typeof Types.Messages.MOVE>): void;
    receiveLootMove(data: ClientInboundActionByOpcode<typeof Types.Messages.LOOTMOVE>): void;
    receiveAttack(data: ClientInboundActionByOpcode<typeof Types.Messages.ATTACK>): void;
    receiveSpawn(data: ClientInboundActionByOpcode<typeof Types.Messages.SPAWN>): void;
    receiveDespawn(data: ClientInboundActionByOpcode<typeof Types.Messages.DESPAWN>): void;
    receiveHealth(data: ClientInboundActionByOpcode<typeof Types.Messages.HEALTH>): void;
    receiveChat(data: ClientInboundActionByOpcode<typeof Types.Messages.CHAT>): void;
    receiveEquipItem(data: ClientInboundActionByOpcode<typeof Types.Messages.EQUIP>): void;
    receiveDrop(data: ClientInboundActionByOpcode<typeof Types.Messages.DROP>): void;
    receiveTeleport(data: ClientInboundActionByOpcode<typeof Types.Messages.TELEPORT>): void;
    receiveDamage(data: ClientInboundActionByOpcode<typeof Types.Messages.DAMAGE>): void;
    receivePopulation(data: ClientInboundActionByOpcode<typeof Types.Messages.POPULATION>): void;
    receiveList(data: ClientInboundActionByOpcode<typeof Types.Messages.LIST>): void;
    receiveDestroy(data: ClientInboundActionByOpcode<typeof Types.Messages.DESTROY>): void;
    receiveKill(data: ClientInboundActionByOpcode<typeof Types.Messages.KILL>): void;
    receiveHitPoints(data: ClientInboundActionByOpcode<typeof Types.Messages.HP>): void;
    receiveBlink(data: ClientInboundActionByOpcode<typeof Types.Messages.BLINK>): void;
    receiveAchievements(data: ClientInboundActionByOpcode<typeof Types.Messages.ACHIEVEMENTS>): void;
};

export function createGameClientInboundHandlers(
    receiver: GameClientInboundReceiver
): GameClientInboundActionHandlerMap {
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
        [Types.Messages.ACHIEVEMENTS]: (data) => receiver.receiveAchievements(data),
    };
}
