import Types from '../../shared/js/gametypes-browser';
import type { ClientOutboundProtocolAction } from './client-boundary-types';

type OutboundAction<Opcode extends ClientOutboundProtocolAction[0]> = Extract<
    ClientOutboundProtocolAction,
    [Opcode, ...unknown[]]
>;

export function toProtocolEntityId(id: string | number): number {
    return Number(id);
}

export function createHelloAction(name: string, armorKind: number, weaponKind: number): OutboundAction<typeof Types.Messages.HELLO> {
    return [Types.Messages.HELLO, name, armorKind, weaponKind];
}

export function createMoveAction(x: number, y: number): OutboundAction<typeof Types.Messages.MOVE> {
    return [Types.Messages.MOVE, x, y];
}

export function createLootMoveAction(
    x: number,
    y: number,
    itemId: number
): OutboundAction<typeof Types.Messages.LOOTMOVE> {
    return [Types.Messages.LOOTMOVE, x, y, itemId];
}

export function createAggroAction(mobId: number): OutboundAction<typeof Types.Messages.AGGRO> {
    return [Types.Messages.AGGRO, mobId];
}

export function createAttackAction(mobId: number): OutboundAction<typeof Types.Messages.ATTACK> {
    return [Types.Messages.ATTACK, mobId];
}

export function createHitAction(mobId: number): OutboundAction<typeof Types.Messages.HIT> {
    return [Types.Messages.HIT, mobId];
}

export function createHurtAction(mobId: number): OutboundAction<typeof Types.Messages.HURT> {
    return [Types.Messages.HURT, mobId];
}

export function createChatAction(text: string): OutboundAction<typeof Types.Messages.CHAT> {
    return [Types.Messages.CHAT, text];
}

export function createLootAction(itemId: number): OutboundAction<typeof Types.Messages.LOOT> {
    return [Types.Messages.LOOT, itemId];
}

export function createTeleportAction(x: number, y: number): OutboundAction<typeof Types.Messages.TELEPORT> {
    return [Types.Messages.TELEPORT, x, y];
}

export function createWhoAction(ids: number[]): OutboundAction<typeof Types.Messages.WHO> {
    return [Types.Messages.WHO, ...ids];
}

export function createZoneAction(): OutboundAction<typeof Types.Messages.ZONE> {
    return [Types.Messages.ZONE];
}

export function createOpenAction(chestId: number): OutboundAction<typeof Types.Messages.OPEN> {
    return [Types.Messages.OPEN, chestId];
}

export function createCheckAction(id: number | string): OutboundAction<typeof Types.Messages.CHECK> {
    return [Types.Messages.CHECK, Number(id)];
}
