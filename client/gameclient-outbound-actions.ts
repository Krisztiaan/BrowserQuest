import Types from '../shared/gametypes-browser';
import type { ClientOutboundProtocolAction } from './client-boundary-types';
import type { EntityId } from '../shared/domain/ids';
import { entityIdToWire } from '../shared/domain/ids';
import { encodeProtocolCapabilitiesJson, PROTOCOL_REVISION } from '../shared/protocol/capabilities';
import type { ProtocolActionValue } from '../shared/protocol/types';

type OutboundAction<Opcode extends ClientOutboundProtocolAction[0]> = Extract<
    ClientOutboundProtocolAction,
    [Opcode, ...ProtocolActionValue[]]
>;

export function toProtocolEntityId(id: EntityId): number {
    return entityIdToWire(id);
}

export function createHelloAction(name: string, armorKind: number, weaponKind: number): OutboundAction<typeof Types.Messages.HELLO> {
    const capabilitiesJson = encodeProtocolCapabilitiesJson({
        moduleIds: [
            'core.teleport',
            'core.move',
            'core.doors',
            'core.tiles',
            'core.claims',
            'core.inventory',
            'core.farming',
            'core.resources',
            'core.npc_shop',
        ],
    });
    return [Types.Messages.HELLO, name, armorKind, weaponKind, PROTOCOL_REVISION, capabilitiesJson];
}

export function createIntentAction(
    seq: number,
    intentTypeId: string,
    payloadBytes: number[]
): OutboundAction<typeof Types.Messages.INTENT> {
    return [Types.Messages.INTENT, seq, intentTypeId, payloadBytes];
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

export function createChatAction(text: string): OutboundAction<typeof Types.Messages.CHAT> {
    return [Types.Messages.CHAT, text];
}

export function createLootAction(itemId: number): OutboundAction<typeof Types.Messages.LOOT> {
    return [Types.Messages.LOOT, itemId];
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

export function createAchievementAction(id: number): OutboundAction<typeof Types.Messages.ACHIEVEMENT> {
    return [Types.Messages.ACHIEVEMENT, id];
}

export function createChunkSubscribeAction(
    chunkX: number,
    chunkY: number,
    radius: number
): OutboundAction<typeof Types.Messages.CHUNK_SUBSCRIBE> {
    return [Types.Messages.CHUNK_SUBSCRIBE, chunkX, chunkY, radius];
}

export function createChunkUnsubscribeAction(): OutboundAction<typeof Types.Messages.CHUNK_UNSUBSCRIBE> {
    return [Types.Messages.CHUNK_UNSUBSCRIBE];
}
