import Types from '../shared/gametypes-browser';
import Utils from './utils';
import type { ClientToServerHelloAction, ClientToServerProtocolAction } from '../shared/protocol/types';
import type { Command, CommandSource } from './ecs/commands';
import type { EntityId } from '../shared/domain/ids';
import { entityIdFromWire } from '../shared/domain/ids';
import type { EntityKind } from '../shared/entity-kind-domain';
import { gridPos } from '../shared/domain/positions';
import type Player from './player';

const NAME_MAX_UTF8_BYTES = 64;
const NAME_MAX_CODEPOINTS = 15;
const CHAT_MAX_UTF8_BYTES = 512;
const CHAT_MAX_CODEPOINTS = 60;
const WHO_MAX_IDS = 1000;

type CloseInvalidPayload = (reason: string) => void;

function makeSource(player: Player): CommandSource {
    return { connectionId: player.connection.id, playerId: player.id };
}

function translateHello(
    player: Player,
    message: ClientToServerHelloAction,
    closeInvalidPayload: CloseInvalidPayload
): Command | null {
    const rawName = message[1];
    if (typeof rawName !== 'string' || !Utils.hasMaxUtf8Bytes(rawName, NAME_MAX_UTF8_BYTES)) {
        closeInvalidPayload('Name is too long.');
        return null;
    }
    let name = Utils.sanitize(rawName);
    name = Utils.limitUtf8Bytes(name, NAME_MAX_UTF8_BYTES);
    name = Utils.limitCodePoints(name, NAME_MAX_CODEPOINTS);

    const armorKind = Number(message[2]) as EntityKind;
    const weaponKind = Number(message[3]) as EntityKind;

    return {
        type: 'HELLO',
        source: makeSource(player),
        name: name === '' ? 'lorem ipsum' : name,
        armorKind,
        weaponKind,
    };
}

export function translateClientActionToCommand(
    player: Player,
    message: ClientToServerProtocolAction,
    closeInvalidPayload: CloseInvalidPayload
): Command | null {
    const source = makeSource(player);

    switch (message[0]) {
        case Types.Messages.HELLO:
            return translateHello(player, message, closeInvalidPayload);
        case Types.Messages.WHO: {
            if (message.length - 1 > WHO_MAX_IDS) {
                closeInvalidPayload('WHO message is too large.');
                return null;
            }
            const [, ...rawEntityIds] = message;
            const entityIds: EntityId[] = [];
            for (const rawId of rawEntityIds) {
                if (typeof rawId !== 'number') {
                    continue;
                }
                try {
                    entityIds.push(entityIdFromWire(rawId));
                } catch (err) {
                    closeInvalidPayload(`Invalid WHO entity id: ${String(err)}`);
                    return null;
                }
            }
            return { type: 'WHO', source, entityIds };
        }
        case Types.Messages.ZONE:
            return { type: 'ZONE', source };
        case Types.Messages.CHAT: {
            const rawChat = message[1];
            if (typeof rawChat !== 'string' || !Utils.hasMaxUtf8Bytes(rawChat, CHAT_MAX_UTF8_BYTES)) {
                closeInvalidPayload('Chat message is too long.');
                return null;
            }
            let chatMessage = Utils.sanitize(rawChat);
            chatMessage = Utils.limitUtf8Bytes(chatMessage, CHAT_MAX_UTF8_BYTES);
            chatMessage = Utils.limitCodePoints(chatMessage, CHAT_MAX_CODEPOINTS);
            if (!chatMessage) {
                return null;
            }
            return { type: 'CHAT', source, message: chatMessage };
        }
        case Types.Messages.MOVE: {
            const x = message[1];
            const y = message[2];
            if (typeof x !== 'number' || typeof y !== 'number' || !Number.isInteger(x) || !Number.isInteger(y)) {
                closeInvalidPayload('Invalid MOVE coordinates.');
                return null;
            }
            return { type: 'MOVE', source, to: gridPos(x, y) };
        }
        case Types.Messages.LOOTMOVE: {
            const x = message[1];
            const y = message[2];
            const itemId = message[3];
            if (
                typeof x !== 'number'
                || typeof y !== 'number'
                || !Number.isInteger(x)
                || !Number.isInteger(y)
                || typeof itemId !== 'number'
            ) {
                closeInvalidPayload('Invalid LOOTMOVE payload.');
                return null;
            }
            try {
                return { type: 'LOOTMOVE', source, to: gridPos(x, y), itemId: entityIdFromWire(itemId) };
            } catch (err) {
                closeInvalidPayload(`Invalid LOOTMOVE item id: ${String(err)}`);
                return null;
            }
        }
        case Types.Messages.AGGRO: {
            const mobId = message[1];
            if (typeof mobId !== 'number') {
                closeInvalidPayload('Invalid AGGRO payload.');
                return null;
            }
            try {
                return { type: 'AGGRO', source, mobId: entityIdFromWire(mobId) };
            } catch (err) {
                closeInvalidPayload(`Invalid AGGRO mob id: ${String(err)}`);
                return null;
            }
        }
        case Types.Messages.ATTACK: {
            const targetId = message[1];
            if (typeof targetId !== 'number') {
                closeInvalidPayload('Invalid ATTACK payload.');
                return null;
            }
            try {
                return { type: 'ATTACK', source, targetId: entityIdFromWire(targetId) };
            } catch (err) {
                closeInvalidPayload(`Invalid ATTACK target id: ${String(err)}`);
                return null;
            }
        }
        case Types.Messages.HIT: {
            const attackedMobId = message[1];
            if (typeof attackedMobId !== 'number') {
                closeInvalidPayload('Invalid HIT payload.');
                return null;
            }
            try {
                return { type: 'HIT', source, attackedMobId: entityIdFromWire(attackedMobId) };
            } catch (err) {
                closeInvalidPayload(`Invalid HIT mob id: ${String(err)}`);
                return null;
            }
        }
        case Types.Messages.HURT: {
            const hurtingMobId = message[1];
            if (typeof hurtingMobId !== 'number') {
                closeInvalidPayload('Invalid HURT payload.');
                return null;
            }
            try {
                return { type: 'HURT', source, hurtingMobId: entityIdFromWire(hurtingMobId) };
            } catch (err) {
                closeInvalidPayload(`Invalid HURT mob id: ${String(err)}`);
                return null;
            }
        }
        case Types.Messages.LOOT: {
            const droppedItemId = message[1];
            if (typeof droppedItemId !== 'number') {
                closeInvalidPayload('Invalid LOOT payload.');
                return null;
            }
            try {
                return { type: 'LOOT', source, droppedItemId: entityIdFromWire(droppedItemId) };
            } catch (err) {
                closeInvalidPayload(`Invalid LOOT item id: ${String(err)}`);
                return null;
            }
        }
        case Types.Messages.TELEPORT: {
            const x = message[1];
            const y = message[2];
            if (typeof x !== 'number' || typeof y !== 'number' || !Number.isInteger(x) || !Number.isInteger(y)) {
                closeInvalidPayload('Invalid TELEPORT coordinates.');
                return null;
            }
            return { type: 'TELEPORT', source, to: gridPos(x, y) };
        }
        case Types.Messages.OPEN: {
            const chestId = message[1];
            if (typeof chestId !== 'number') {
                closeInvalidPayload('Invalid OPEN payload.');
                return null;
            }
            try {
                return { type: 'OPEN', source, chestId: entityIdFromWire(chestId) };
            } catch (err) {
                closeInvalidPayload(`Invalid OPEN chest id: ${String(err)}`);
                return null;
            }
        }
        case Types.Messages.CHECK: {
            const checkpointId = message[1];
            if (typeof checkpointId !== 'number' || !Number.isFinite(checkpointId)) {
                closeInvalidPayload('Invalid CHECK payload.');
                return null;
            }
            return { type: 'CHECK', source, checkpointId: checkpointId };
        }
        default:
            closeInvalidPayload(`Unsupported opcode: ${String(message[0])}`);
            return null;
    }
}
