import Types from '../../shared/gametypes-browser';
import type { EntityKind } from '../../shared/entity-kind-domain';
import type { EntityId } from '../../shared/domain/ids';
import { entityIdToWire } from '../../shared/domain/ids';
import type {
    ServerToClientAttackAction,
    ServerToClientAchievementsAction,
    ServerToClientBlinkAction,
    ServerToClientChatAction,
    ServerToClientDamageAction,
    ServerToClientDespawnAction,
    ServerToClientDestroyAction,
    ServerToClientDropAction,
    ServerToClientEquipAction,
    ServerToClientHealthAction,
    ServerToClientHitPointsAction,
    ServerToClientKillAction,
    ServerToClientListAction,
    ServerToClientLootMoveAction,
    ServerToClientMoveAction,
    ServerToClientPopulationAction,
    ServerToClientProtocolAction,
    ServerToClientAckAction,
    ServerToClientCorrectionAction,
    ServerToClientRejectAction,
    ServerToClientTeleportAction,
    ServerToClientWelcomeAction,
    ServerToClientChunkSnapshotAction,
    ServerToClientChunkSnapshotPartAction,
    ServerToClientChunkDeltaAction,
} from '../../shared/protocol/types';

export function buildWelcomeAction({
    id,
    name,
    x,
    y,
    hp,
    protocolRevision,
    capabilitiesJson,
}: {
    id: EntityId;
    name: string;
    x: number;
    y: number;
    hp: number;
    protocolRevision?: number;
    capabilitiesJson?: string;
}): ServerToClientWelcomeAction {
    if (typeof protocolRevision === 'number' && typeof capabilitiesJson === 'string') {
        return [Types.Messages.WELCOME, entityIdToWire(id), name, x, y, hp, protocolRevision, capabilitiesJson];
    }
    return [Types.Messages.WELCOME, entityIdToWire(id), name, x, y, hp];
}

export function buildRejectAction(seq: number, intentTypeId: string, reason: string): ServerToClientRejectAction {
    return [Types.Messages.REJECT, seq, intentTypeId, reason];
}

export function buildAckAction(seq: number): ServerToClientAckAction {
    return [Types.Messages.ACK, seq];
}

export function buildCorrectionMoveAction(seq: number, x: number, y: number): ServerToClientCorrectionAction {
    return [Types.Messages.CORRECTION, seq, x, y];
}

export function buildChunkSnapshotAction(
    chunkX: number,
    chunkY: number,
    version: number,
    payloadJson: string
): ServerToClientChunkSnapshotAction {
    return [Types.Messages.CHUNK_SNAPSHOT, chunkX, chunkY, version, payloadJson];
}

export function buildChunkSnapshotPartAction(
    chunkX: number,
    chunkY: number,
    version: number,
    partIndex: number,
    partCount: number,
    payloadJson: string
): ServerToClientChunkSnapshotPartAction {
    return [Types.Messages.CHUNK_SNAPSHOT_PART, chunkX, chunkY, version, partIndex, partCount, payloadJson];
}

export function buildChunkDeltaAction(
    chunkX: number,
    chunkY: number,
    fromVersion: number,
    toVersion: number,
    payloadJson: string
): ServerToClientChunkDeltaAction {
    return [Types.Messages.CHUNK_DELTA, chunkX, chunkY, fromVersion, toVersion, payloadJson];
}

export function buildDespawnAction(id: EntityId): ServerToClientDespawnAction {
    return [Types.Messages.DESPAWN, entityIdToWire(id)];
}

export function buildMoveAction(id: EntityId, x: number, y: number): ServerToClientMoveAction {
    return [Types.Messages.MOVE, entityIdToWire(id), x, y];
}

export function buildLootMoveAction(playerId: EntityId, itemId: EntityId): ServerToClientLootMoveAction {
    return [Types.Messages.LOOTMOVE, entityIdToWire(playerId), entityIdToWire(itemId)];
}

export function buildAttackAction(attackerId: EntityId, targetId: EntityId): ServerToClientAttackAction {
    return [Types.Messages.ATTACK, entityIdToWire(attackerId), entityIdToWire(targetId)];
}

export function buildHealthAction(points: number, isRegen: boolean): ServerToClientHealthAction {
    return isRegen ? [Types.Messages.HEALTH, points, 1] : [Types.Messages.HEALTH, points];
}

export function buildChatAction(playerId: EntityId, message: string): ServerToClientChatAction {
    return [Types.Messages.CHAT, entityIdToWire(playerId), message];
}

export function buildEquipAction(playerId: EntityId, itemKind: EntityKind): ServerToClientEquipAction {
    return [Types.Messages.EQUIP, entityIdToWire(playerId), itemKind];
}

export function buildDropAction(
    mobId: EntityId,
    itemId: EntityId,
    itemKind: EntityKind,
    haters: number[]
): ServerToClientDropAction {
    return [Types.Messages.DROP, entityIdToWire(mobId), entityIdToWire(itemId), itemKind, haters];
}

export function buildTeleportAction(id: EntityId, x: number, y: number): ServerToClientTeleportAction {
    return [Types.Messages.TELEPORT, entityIdToWire(id), x, y];
}

export function buildDamageAction(id: EntityId, points: number): ServerToClientDamageAction {
    return [Types.Messages.DAMAGE, entityIdToWire(id), points];
}

export function buildPopulationAction(world: number, total?: number): ServerToClientPopulationAction {
    const resolved = typeof total === 'number' ? total : world;
    return [Types.Messages.POPULATION, world, resolved];
}

export function buildKillAction(kind: EntityKind): ServerToClientKillAction {
    return [Types.Messages.KILL, kind];
}

export function buildListAction(entityIds: number[]): ServerToClientListAction {
    return [Types.Messages.LIST, ...entityIds];
}

export function buildDestroyAction(id: EntityId): ServerToClientDestroyAction {
    return [Types.Messages.DESTROY, entityIdToWire(id)];
}

export function buildHpAction(maxHitPoints: number): ServerToClientHitPointsAction {
    return [Types.Messages.HP, maxHitPoints];
}

export function buildBlinkAction(id: EntityId): ServerToClientBlinkAction {
    return [Types.Messages.BLINK, entityIdToWire(id)];
}

export function buildAchievementsAction({
    unlockedIds,
    ratCount,
    skeletonCount,
    totalKills,
    totalDmg,
    totalRevives,
}: {
    unlockedIds: number[];
    ratCount: number;
    skeletonCount: number;
    totalKills: number;
    totalDmg: number;
    totalRevives: number;
}): ServerToClientAchievementsAction {
    return [
        Types.Messages.ACHIEVEMENTS,
        unlockedIds,
        ratCount,
        skeletonCount,
        totalKills,
        totalDmg,
        totalRevives,
    ];
}

export function asServerToClientProtocolAction(action: ServerToClientProtocolAction): ServerToClientProtocolAction {
    return action;
}
