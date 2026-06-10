import Types from '../shared/gametypes-browser';
import Utils from './utils';
import type { ClientToServerHelloAction, ClientToServerProtocolAction } from '../shared/protocol/types';
import { isValidIntentSeq } from '../shared/protocol/intent-seq';
import type { Command, CommandSource } from './ecs/commands';
import type { EntityId } from '../shared/domain/ids';
import { entityIdFromWire } from '../shared/domain/ids';
import type { EntityKind } from '../shared/entity-kind-domain';
import { gridPos } from '../shared/domain/positions';

const NAME_MAX_UTF8_BYTES = 64;
const NAME_MAX_CODEPOINTS = 15;
const CHAT_MAX_UTF8_BYTES = 512;
const CHAT_MAX_CODEPOINTS = 60;
const WHO_MAX_IDS = 1000;
const CAPABILITIES_JSON_MAX_UTF8_BYTES = 4096;
const INTENT_TYPE_ID_MAX_UTF8_BYTES = 96;
const INTENT_PAYLOAD_MAX_BYTES = 4096;
const CHUNK_COORD_ABS_MAX = 1_000_000;
const CHUNK_RADIUS_MAX = 8;

type CloseInvalidPayload = (reason: string) => void;

function translateHello(
    source: CommandSource,
    message: ClientToServerHelloAction,
    closeInvalidPayload: CloseInvalidPayload
): Command | null {
    const rawName = message[1];
    if (typeof rawName !== 'string' || !Utils.hasMaxUtf8Bytes(rawName, NAME_MAX_UTF8_BYTES)) {
        closeInvalidPayload('Name is too long.');
        return null;
    }
    let name = Utils.stripControlChars(rawName);
    name = Utils.limitUtf8Bytes(name, NAME_MAX_UTF8_BYTES);
    name = Utils.limitCodePoints(name, NAME_MAX_CODEPOINTS);

    const armorKind = Number(message[2]) as EntityKind;
    const weaponKind = Number(message[3]) as EntityKind;

    let protocolRevision: number | undefined;
    let capabilitiesJson: string | undefined;
    if (message.length >= 6) {
        const candidateRevision = message[4];
        const candidateCaps = message[5];
        if (typeof candidateRevision === 'number' && Number.isFinite(candidateRevision) && Number.isSafeInteger(candidateRevision)) {
            protocolRevision = candidateRevision;
        }
        if (typeof candidateCaps === 'string') {
            if (!Utils.hasMaxUtf8Bytes(candidateCaps, CAPABILITIES_JSON_MAX_UTF8_BYTES)) {
                closeInvalidPayload('Capabilities payload is too large.');
                return null;
            }
            capabilitiesJson = candidateCaps;
        }
    }

    return {
        type: 'HELLO',
        source,
        name: name === '' ? 'lorem ipsum' : name,
        armorKind,
        weaponKind,
        ...(typeof protocolRevision === 'number' ? { protocolRevision } : {}),
        ...(typeof capabilitiesJson === 'string' ? { capabilitiesJson } : {}),
    };
}

export function translateClientActionToCommand(
    source: CommandSource,
    message: ClientToServerProtocolAction,
    closeInvalidPayload: CloseInvalidPayload
): Command | null {
    switch (message[0]) {
        case Types.Messages.HELLO:
            return translateHello(source, message, closeInvalidPayload);
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
            let chatMessage = Utils.stripControlChars(rawChat);
            chatMessage = Utils.limitUtf8Bytes(chatMessage, CHAT_MAX_UTF8_BYTES);
            chatMessage = Utils.limitCodePoints(chatMessage, CHAT_MAX_CODEPOINTS);
            if (!chatMessage) {
                return null;
            }
            return { type: 'CHAT', source, message: chatMessage };
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
        case Types.Messages.ACHIEVEMENT: {
            const achievementId = message[1];
            if (
                typeof achievementId !== 'number'
                || !Number.isFinite(achievementId)
                || !Number.isSafeInteger(achievementId)
                || achievementId <= 0
            ) {
                closeInvalidPayload('Invalid ACHIEVEMENT payload.');
                return null;
            }
            return { type: 'ACHIEVEMENT', source, achievementId };
        }
        case Types.Messages.INTENT: {
            const seq = message[1];
            const intentTypeId = message[2];
            const payloadBytes = message[3];

            if (
                typeof seq !== 'number'
                || !isValidIntentSeq(seq)
                || typeof intentTypeId !== 'string'
                || !Utils.hasMaxUtf8Bytes(intentTypeId, INTENT_TYPE_ID_MAX_UTF8_BYTES)
                || (!Array.isArray(payloadBytes) && !((payloadBytes as unknown) instanceof Uint8Array))
                || payloadBytes.length > INTENT_PAYLOAD_MAX_BYTES
                || (Array.isArray(payloadBytes)
                    && payloadBytes.some((value) => typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 255))
            ) {
                closeInvalidPayload('Invalid INTENT payload.');
                return null;
            }

            return {
                type: 'INTENT',
                source,
                seq,
                intentTypeId,
                payloadBytes,
            };
        }
        case Types.Messages.CHUNK_SUBSCRIBE: {
            const chunkX = message[1];
            const chunkY = message[2];
            const radius = message[3];

            if (
                typeof chunkX !== 'number'
                || typeof chunkY !== 'number'
                || typeof radius !== 'number'
                || !Number.isSafeInteger(chunkX)
                || !Number.isSafeInteger(chunkY)
                || !Number.isSafeInteger(radius)
                || Math.abs(chunkX) > CHUNK_COORD_ABS_MAX
                || Math.abs(chunkY) > CHUNK_COORD_ABS_MAX
                || radius < 0
                || radius > CHUNK_RADIUS_MAX
            ) {
                closeInvalidPayload('Invalid CHUNK_SUBSCRIBE payload.');
                return null;
            }

            return { type: 'CHUNK_SUBSCRIBE', source, chunkX, chunkY, radius };
        }
        case Types.Messages.CHUNK_UNSUBSCRIBE: {
            return { type: 'CHUNK_UNSUBSCRIBE', source };
        }
        default:
            closeInvalidPayload(`Unsupported opcode: ${String(message[0])}`);
            return null;
    }
}
