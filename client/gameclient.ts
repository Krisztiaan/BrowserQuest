import EntityFactory from './entityfactory';
import log from './platform/log';
import Types from '../shared/gametypes-browser';
import type { EntityKind } from '../shared/entity-kind-domain';
import {
    createGameClientInboundHandlers,
    type GameClientInboundActionHandlerMap,
} from './gameclient-inbound-handlers';
import {
    createAchievementAction,
    createAggroAction,
    createAttackAction,
    createChatAction,
    createCheckAction,
    createChunkSubscribeAction,
    createChunkUnsubscribeAction,
    createHelloAction,
    createIntentAction,
    createLootAction,
    createLootMoveAction,
    createOpenAction,
    createWhoAction,
    createZoneAction,
    toProtocolEntityId,
} from './gameclient-outbound-actions';
import type { TypedEventSource } from '../shared/typed-event-emitter';
import { Evented } from '../shared/evented';
import {
    encodeClientToServerProtocolActionBinary,
} from '../shared/protocol/registry';
import { dispatchBinaryActionBatchPayload } from '../shared/protocol/binary-action-codec';
import {
    DISPATCHER_CONNECT_STATUS,
    HANDSHAKE_CONTROL,
    isDispatcherConnectStatus,
} from '../shared/connection-status';
import type {
    ClientInboundActionByOpcode,
    ClientInboundProtocolAction,
    ClientOutboundProtocolAction,
    ClientProtocolBatch,
    RuntimeEntity,
} from './client-boundary-types';
import type { EntityId } from '../shared/domain/ids';
import { entityIdFromWire } from '../shared/domain/ids';
import { gridPos } from '../shared/domain/positions';
import { decodeSpawnAction } from '../shared/replication/spawn-snapshot';
import { adaptKernelEntityForRendering } from './ecs/kernel-entity-adapter';
import { ClientWorldKernel } from './ecs/world-kernel';
import { decodeProtocolCapabilitiesJson, type ProtocolCapabilities } from '../shared/protocol/capabilities';
import { decodeChunkSnapshotPayloadBinary } from '../shared/protocol/chunks/chunk-snapshot-codec';
import { decodeChunkDeltaPayloadBinary } from '../shared/protocol/chunks/chunk-delta-codec';
import { safeParseJsonValue, type JsonValue } from '../shared/json/safe-json';
import {
    encodeClaimCreateIntentPayload,
    encodeClaimDeleteIntentPayload,
    encodeClaimUpdateIntentPayload,
    encodeDoorTeleportIntentPayload,
    encodeMoveInputIntentPayload,
    encodeMoveToIntentPayload,
    encodeMoveStepIntentPayload,
    encodeTileEditIntentPayload,
    INTENT_CLAIM_CREATE,
    INTENT_CLAIM_DELETE,
    INTENT_CLAIM_UPDATE,
    INTENT_DOOR_TELEPORT,
    INTENT_MOVE_INPUT,
    INTENT_MOVE_TO,
    INTENT_MOVE_STEP,
    INTENT_TILE_EDIT,
} from '../shared/protocol/intents';
import { nextIntentSeq } from '../shared/protocol/intent-seq';
import { debugMoves } from './debug-flags';

function isRecord(value: JsonValue | object | null | undefined): value is Record<string, JsonValue> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeBinaryFrameData(data: ArrayBuffer | Uint8Array | ArrayBufferView): ArrayBuffer | Uint8Array {
    if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
        return data;
    }
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

function formatProtocolValueForLog(value: unknown): string {
    if (Array.isArray(value)) {
        return `[${value.map((entry) => formatProtocolValueForLog(entry)).join(',')}]`;
    }
    if (typeof value === 'string') {
        return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
    }
    if (value === null) {
        return 'null';
    }
    return String(value);
}

type ClientPlayerLike = {
    name: string;
    getSpriteName(): string;
    getWeaponName(): string | null;
};
type IdCarrier = { id: EntityId };
type CorrectionPayload = Readonly<{ a: number | string; b: number | string }>;

export type GameClientEvents = {
    dispatched: [host: string, port: number];
    connected: [];
    disconnected: [reason: string];
    welcome: [id: EntityId, name: string, x: number, y: number, hp: number];
    spawnCharacter: [
        entity: RuntimeEntity,
        x: number,
        y: number,
        orientation: number | undefined,
        target: EntityId | undefined,
    ];
    spawnItem: [item: RuntimeEntity, x: number, y: number];
    spawnChest: [chest: RuntimeEntity, x: number, y: number];
    despawnEntity: [entityId: EntityId];
    entityMove: [entityId: EntityId, x: number, y: number];
    entityAttack: [attackerId: EntityId, targetId: EntityId];
    playerChangeHealth: [points: number, isRegen: boolean];
    playerEquipItem: [entityId: EntityId, itemKind: EntityKind];
    playerMoveToItem: [playerId: EntityId, itemId: EntityId];
    playerTeleport: [entityId: EntityId, x: number, y: number];
    chatMessage: [entityId: EntityId, text: string];
    dropItem: [item: RuntimeEntity, mobId: EntityId];
    playerDamageMob: [mobId: EntityId, points: number];
    playerKillMob: [kind: EntityKind];
    achievementProgress: [
        unlockedIds: number[],
        ratCount: number,
        skeletonCount: number,
        totalKills: number,
        totalDmg: number,
        totalRevives: number,
    ];
    populationChange: [worldPlayers: number, totalPlayers: number];
    entityList: [list: EntityId[]];
    entityDestroy: [entityId: EntityId];
    playerChangeMaxHitPoints: [maxHp: number];
    itemBlink: [entityId: EntityId];
    protocolCapabilities: [protocolRevision: number, capabilities: ProtocolCapabilities | null];
    intentRejected: [seq: number, intentTypeId: string, reason: string];
    intentAcked: [seq: number];
    correction: [seq: number, payload: CorrectionPayload];
};

export type GameClientEventSource = TypedEventSource<GameClientEvents>;

class GameClient extends Evented<GameClientEvents> {
    connection: WebSocket | null;
    wsUrl: string;
    isTimeout: boolean;
    isListening = false;
    lastDispatcherMode = false;
    suppressedCloseSockets = new WeakSet<WebSocket>();
    handlers: GameClientInboundActionHandlerMap;
    kernel: ClientWorldKernel;
    serverProtocolRevision: number | null = null;
    serverCapabilities: ProtocolCapabilities | null = null;
    unknownOutcomeTypeIdsLogged = new Set<string>();
    localPlayerId: EntityId | null = null;
    nextIntentSeq = 1;

    constructor(wsUrl: string, kernel?: ClientWorldKernel) {
        super();
        this.connection = null;
        this.wsUrl = wsUrl;
        this.isTimeout = false;
        this.kernel = kernel ?? new ClientWorldKernel();
        this.handlers = createGameClientInboundHandlers(this);

        this.enable();
    }

    enable(): void {
        this.isListening = true;
    }

    disable(): void {
        this.isListening = false;
    }

    connect(dispatcherMode = false): void {
        const url = this.wsUrl;
        const self = this;
        this.lastDispatcherMode = dispatcherMode;

        log.info('Trying to connect to server : ' + url);

        const socket = new WebSocket(url);
        socket.binaryType = 'arraybuffer';
        this.connection = socket;

        if (dispatcherMode) {
            socket.onmessage = function (e: MessageEvent) {
                if (typeof e.data !== 'string') {
                    alert('Unknown error while connecting to BrowserQuest.');
                    return;
                }

                const reply = safeParseJsonValue(e.data);
                if (!isRecord(reply)) {
                    alert('Unknown error while connecting to BrowserQuest.');
                    return;
                }

                const status = reply.status;

                if (isDispatcherConnectStatus(status) && status === DISPATCHER_CONNECT_STATUS.OK) {
                    const host = reply.host;
                    const port = reply.port;
                    if (typeof host !== 'string' || typeof port !== 'number' || !Number.isFinite(port)) {
                        alert('Unknown error while connecting to BrowserQuest.');
                        return;
                    }
                    self.emit('dispatched', host, port);
                } else if (isDispatcherConnectStatus(status) && status === DISPATCHER_CONNECT_STATUS.FULL) {
                    alert('BrowserQuest is currently at maximum player population. Please retry later.');
                } else {
                    alert('Unknown error while connecting to BrowserQuest.');
                }
            };
        } else {
            socket.onopen = function (_e: Event) {
                log.info('Connected to server ' + self.wsUrl);
            };

            socket.onmessage = function (e: MessageEvent) {
                if (e.data === HANDSHAKE_CONTROL.GO) {
                    self.emit('connected');
                    return;
                }
                if (e.data === HANDSHAKE_CONTROL.TIMEOUT) {
                    self.isTimeout = true;
                    return;
                }
                if (e.data instanceof ArrayBuffer) {
                    self.receiveMessage(normalizeBinaryFrameData(e.data));
                    return;
                }
                if (e.data instanceof Blob) {
                    void e.data
                        .arrayBuffer()
                        .then((buffer) => {
                            self.receiveMessage(normalizeBinaryFrameData(buffer));
                        })
                        .catch((error: unknown) => {
                            log.error('Failed to read binary websocket frame: ' + String(error));
                        });
                    return;
                }
                if (ArrayBuffer.isView(e.data)) {
                    self.receiveMessage(normalizeBinaryFrameData(e.data));
                    return;
                }
                if (typeof e.data === 'string') {
                    log.error('Unsupported text gameplay frame received.');
                }
            };

            socket.onerror = function (e: Event) {
                log.error(e, true);
            };

            socket.onclose = function () {
                if (self.suppressedCloseSockets.has(socket)) {
                    self.suppressedCloseSockets.delete(socket);
                    return;
                }
                log.debug('Connection closed');
                const container = document.getElementById('container');
                if (container) {
                    container.classList.add('error');
                }

                if (self.isTimeout) {
                    self.emit('disconnected', 'You have been disconnected for being inactive for too long');
                } else {
                    self.emit('disconnected', 'The connection to BrowserQuest has been lost');
                }
            };
        }
    }

    reconnectSilently(): void {
        const existing = this.connection;
        if (existing) {
            this.sendChunkUnsubscribe();
            try {
                existing.onmessage = null;
                existing.onerror = null;
                existing.onopen = null;
            } catch (_) {
                // ignore
            }
            if (existing.readyState !== WebSocket.CLOSED) {
                this.suppressedCloseSockets.add(existing);
            }
            try {
                existing.close();
            } catch (_) {
                // ignore
                this.suppressedCloseSockets.delete(existing);
            }
        }

        this.connection = null;
        this.isTimeout = false;
        this.serverProtocolRevision = null;
        this.serverCapabilities = null;
        this.nextIntentSeq = 1;
        this.kernel.clearClientPendingMoveSeqAcks();
        this.connect(this.lastDispatcherMode);
    }

    sendMessage(json: ClientOutboundProtocolAction): void {
        if (this.connection?.readyState !== WebSocket.OPEN) {
            return;
        }
        const data = encodeClientToServerProtocolActionBinary(json);
        this.connection.send(data);
    }

    receiveMessage(message: ArrayBuffer | Uint8Array): void {
        if (!this.isListening) {
            return;
        }

        const queued: ClientProtocolBatch = [];
        let sawEntityState = false;
        try {
            dispatchBinaryActionBatchPayload(message, {
                onServerAction: (action) => queued.push(action as ClientInboundProtocolAction),
                onEntityStateBatchEntry: (wireId, x, y) => {
                    sawEntityState = true;
                    const local = this.localPlayerId;
                    const entityId = entityIdFromWire(wireId);
                    if (local !== null && entityId === local) {
                        return;
                    }
                    this.kernel.setPosition(entityId, x, y);
                },
            });
        } catch {
            return;
        }

        if (queued.length > 0) {
            if (queued.length === 1) {
                log.debug('data: ' + formatProtocolValueForLog(queued[0]));
            } else {
                log.debug('data: ' + formatProtocolValueForLog(queued));
            }
        } else if (sawEntityState) {
            log.debug('data: [ENTITY_STATE_BATCH]');
        }

        if (queued.length === 1) {
            const action = queued[0];
            if (action) {
                this.receiveAction(action);
            }
        } else if (queued.length > 1) {
            this.receiveActionBatch(queued);
        }
    }

    receiveAction(data: ClientInboundProtocolAction): void {
        this.dispatchInboundAction(data[0], data);
    }

    private dispatchInboundAction<Opcode extends ClientInboundProtocolAction[0]>(
        opcode: Opcode,
        data: ClientInboundActionByOpcode<Opcode>
    ): void {
        const handler = this.handlers[opcode];
        handler(data);
    }

    receiveActionBatch(actions: ClientProtocolBatch): void {
        for (const action of actions) {
            this.receiveAction(action);
        }
    }

    receiveWelcome(data: ClientInboundActionByOpcode<typeof Types.Messages.WELCOME>): void {
        const [, id, name, x, y, hp, protocolRevision, capabilitiesJson] = data;
        const playerId = entityIdFromWire(id);
        this.localPlayerId = playerId;
        this.emit('welcome', playerId, name, x, y, hp);

        if (typeof protocolRevision === 'number' && typeof capabilitiesJson === 'string') {
            this.serverProtocolRevision = protocolRevision;
            this.serverCapabilities = decodeProtocolCapabilitiesJson(capabilitiesJson);
            this.emit('protocolCapabilities', protocolRevision, this.serverCapabilities);
        }
    }

    receiveMove(data: ClientInboundActionByOpcode<typeof Types.Messages.MOVE>): void {
        const [, id, x, y] = data;
        const entityId = entityIdFromWire(id);
        if (this.localPlayerId !== null && entityId === this.localPlayerId) {
            this.kernel.consumeClientPendingMoveAck(x, y);
            debugMoves('in:MOVE', { entityId, x, y });
        }
        this.kernel.setPosition(entityId, x, y);
        this.emit('entityMove', entityId, x, y);
    }

    receiveLootMove(data: ClientInboundActionByOpcode<typeof Types.Messages.LOOTMOVE>): void {
        const [, id, item] = data;
        this.emit('playerMoveToItem', entityIdFromWire(id), entityIdFromWire(item));
    }

    receiveAttack(data: ClientInboundActionByOpcode<typeof Types.Messages.ATTACK>): void {
        const [, attacker, target] = data;
        const attackerId = entityIdFromWire(attacker);
        const targetId = entityIdFromWire(target);
        this.kernel.setTarget(attackerId, targetId);
        this.emit('entityAttack', attackerId, targetId);
    }

    receiveSpawn(data: ClientInboundActionByOpcode<typeof Types.Messages.SPAWN>): void {
        const snapshot = decodeSpawnAction(data);
        const view = this.kernel.upsertFromSpawnSnapshot(snapshot);
        const adapted = adaptKernelEntityForRendering(this.kernel, view.id);

        if (adapted.type === 'item') {
            this.emit('spawnItem', adapted.entity, view.position.x, view.position.y);
            return;
        }

        if (adapted.type === 'chest') {
            this.emit('spawnChest', adapted.entity, view.position.x, view.position.y);
            return;
        }

        this.emit(
            'spawnCharacter',
            adapted.entity,
            view.position.x,
            view.position.y,
            adapted.orientation,
            adapted.targetId
        );
    }

    receiveDespawn(data: ClientInboundActionByOpcode<typeof Types.Messages.DESPAWN>): void {
        const [, id] = data;
        const entityId = entityIdFromWire(id);
        this.kernel.removeEntity(entityId);
        this.emit('despawnEntity', entityId);
    }

    receiveHealth(data: ClientInboundActionByOpcode<typeof Types.Messages.HEALTH>): void {
        const [, points, isRegenFlag] = data;
        this.emit('playerChangeHealth', points, isRegenFlag === 1);
    }

    receiveChat(data: ClientInboundActionByOpcode<typeof Types.Messages.CHAT>): void {
        const [, id, text] = data;
        this.emit('chatMessage', entityIdFromWire(id), text);
    }

    receiveEquipItem(data: ClientInboundActionByOpcode<typeof Types.Messages.EQUIP>): void {
        const [, id, itemKind] = data;
        this.emit('playerEquipItem', entityIdFromWire(id), itemKind);
    }

    receiveDrop(data: ClientInboundActionByOpcode<typeof Types.Messages.DROP>): void {
        const [, mobId, id, kind, playersInvolved] = data;
        const mobEntityId = entityIdFromWire(mobId);
        const itemEntityId = entityIdFromWire(id);
        const mobPos = this.kernel.position.get(mobEntityId);
        if (mobPos) {
            this.kernel.upsertSimpleEntity(itemEntityId, kind, mobPos.x, mobPos.y);
        }

        const item = EntityFactory.createEntity(kind, itemEntityId);
        item.wasDropped = true;
        item.playersInvolved = playersInvolved.map(entityIdFromWire);
        this.emit('dropItem', item, mobEntityId);
    }

    receiveTeleport(data: ClientInboundActionByOpcode<typeof Types.Messages.TELEPORT>): void {
        const [, id, x, y] = data;
        const entityId = entityIdFromWire(id);
        this.kernel.setPosition(entityId, x, y);
        if (this.localPlayerId !== null && entityId === this.localPlayerId) {
            this.kernel.clientMovementSuppressed = true;
            this.kernel.clearClientPendingMoveSeqAcks();
            debugMoves('in:TELEPORT', { entityId, x, y });
        }
        this.emit('playerTeleport', entityId, x, y);
    }

    receiveDamage(data: ClientInboundActionByOpcode<typeof Types.Messages.DAMAGE>): void {
        const [, id, dmg] = data;
        this.emit('playerDamageMob', entityIdFromWire(id), dmg);
    }

    receivePopulation(data: ClientInboundActionByOpcode<typeof Types.Messages.POPULATION>): void {
        const [, worldPlayers, totalPlayers] = data;
        this.kernel.setPopulation(worldPlayers, totalPlayers);
        this.emit('populationChange', worldPlayers, totalPlayers);
    }

    receiveKill(data: ClientInboundActionByOpcode<typeof Types.Messages.KILL>): void {
        const [, mobKind] = data;
        this.emit('playerKillMob', mobKind);
    }

    receiveList(data: ClientInboundActionByOpcode<typeof Types.Messages.LIST>): void {
        const [, ...ids] = data;
        this.emit('entityList', ids.map(entityIdFromWire));
    }

    receiveDestroy(data: ClientInboundActionByOpcode<typeof Types.Messages.DESTROY>): void {
        const [, id] = data;
        const entityId = entityIdFromWire(id);
        this.kernel.removeEntity(entityId);
        this.emit('entityDestroy', entityId);
    }

    receiveHitPoints(data: ClientInboundActionByOpcode<typeof Types.Messages.HP>): void {
        const [, maxHp] = data;
        this.emit('playerChangeMaxHitPoints', maxHp);
    }

    receiveBlink(data: ClientInboundActionByOpcode<typeof Types.Messages.BLINK>): void {
        const [, id] = data;
        this.emit('itemBlink', entityIdFromWire(id));
    }

    receiveAchievements(data: ClientInboundActionByOpcode<typeof Types.Messages.ACHIEVEMENTS>): void {
        const [, unlockedIds, ratCount, skeletonCount, totalKills, totalDmg, totalRevives] = data;
        this.emit('achievementProgress', unlockedIds, ratCount, skeletonCount, totalKills, totalDmg, totalRevives);
    }

    receiveOutcome(data: ClientInboundActionByOpcode<typeof Types.Messages.OUTCOME>): void {
        const [, _seq, outcomeTypeId] = data;
        if (typeof outcomeTypeId !== 'string') {
            return;
        }

        if (!this.unknownOutcomeTypeIdsLogged.has(outcomeTypeId)) {
            this.unknownOutcomeTypeIdsLogged.add(outcomeTypeId);
            log.info(`Ignoring unknown outcomeTypeId: ${outcomeTypeId}`);
        }
    }

    receiveReject(data: ClientInboundActionByOpcode<typeof Types.Messages.REJECT>): void {
        const [, seq, intentTypeId, reason] = data;
        this.emit('intentRejected', seq, intentTypeId, reason);
        log.info(`Intent rejected (seq=${seq}, type=${intentTypeId}): ${reason}`);
        debugMoves('in:REJECT', { seq, intentTypeId, reason });
        if (intentTypeId === INTENT_MOVE_TO) {
            // `move.to` rejection should stop prediction and allow immediate re-try.
            this.kernel.enqueueClientCommand({ type: 'playerStop' });
            this.kernel.clearClientPendingMoveSeqAcks();
            this.kernel.clientMovementSuppressed = false;
        }
        if (intentTypeId === INTENT_MOVE_INPUT) {
            // `move.input` rejection should stop held-key prediction and prevent "stuck key" state.
            this.kernel.enqueueClientCommand({ type: 'playerStop' });
            this.kernel.clearClientMoveInput();
            this.kernel.clientMovementSuppressed = false;
        }
        if (intentTypeId === INTENT_MOVE_STEP) {
            this.kernel.clientMovementSuppressed = true;
            this.kernel.clearClientPendingMoveSeqAcks();
        }
    }

    receiveAck(data: ClientInboundActionByOpcode<typeof Types.Messages.ACK>): void {
        const [, seq] = data;
        this.emit('intentAcked', seq);
        debugMoves('in:ACK', { seq });
        this.kernel.consumeClientPendingMoveSeqAck(seq);
    }

    receiveCorrection(data: ClientInboundActionByOpcode<typeof Types.Messages.CORRECTION>): void {
        const seq = data[1];
        const a = data[2];
        const b = data[3];
        if (typeof seq !== 'number') {
            return;
        }

        if (typeof a === 'number' && typeof b === 'number') {
            const playerId = this.localPlayerId;
            if (playerId !== null) {
                this.kernel.clientMovementSuppressed = true;
                this.kernel.clearClientPendingMoveSeqAcks();
                debugMoves('in:CORRECTION', { seq, x: a, y: b });
                this.kernel.enqueueClientCommand({ type: 'teleportEntity', entityId: playerId, x: a, y: b });
            }
        }

        this.emit('correction', seq, { a, b });
    }

    receiveMoveSync(data: ClientInboundActionByOpcode<typeof Types.Messages.MOVE_SYNC>): void {
        const [, ackSeq, x, y, tick, flags] = data;
        if (
            typeof ackSeq !== 'number'
            || typeof x !== 'number'
            || typeof y !== 'number'
            || typeof tick !== 'number'
            || typeof flags !== 'number'
        ) {
            return;
        }

        const playerId = this.localPlayerId;
        if (playerId === null) {
            return;
        }

        this.kernel.pruneClientPendingMoveSeqAcksUpTo(ackSeq);
        this.kernel.setPosition(playerId, x, y);

        const suppressed = (flags & 1) !== 0;
        this.kernel.clientMovementSuppressed = suppressed;
        if (suppressed) {
            // Stop local prediction immediately; authoritative state will be applied via kernel replication sync.
            this.kernel.enqueueClientCommand({ type: 'playerStop' });
        }
        debugMoves('in:MOVE_SYNC', { ackSeq, x, y, tick, flags });
    }

    receiveEntityStateBatch(data: ClientInboundActionByOpcode<typeof Types.Messages.ENTITY_STATE_BATCH>): void {
        const opcode = data[0];
        if (opcode !== Types.Messages.ENTITY_STATE_BATCH) {
            return;
        }

        const tick = data[1];
        const count = data[2];
        if (typeof tick !== 'number' || typeof count !== 'number' || !Number.isFinite(count) || count < 0) {
            return;
        }

        const localPlayerId = this.localPlayerId;
        const expectedLen = 3 + count * 4;
        if (data.length !== expectedLen) {
            return;
        }

        for (let i = 0; i < count; i += 1) {
            const base = 3 + i * 4;
            const wireId = data[base];
            const x = data[base + 1];
            const y = data[base + 2];
            if (typeof wireId !== 'number' || typeof x !== 'number' || typeof y !== 'number') {
                continue;
            }
            const entityId = entityIdFromWire(wireId);
            if (localPlayerId !== null && entityId === localPlayerId) {
                continue;
            }
            this.kernel.setPosition(entityId, x, y);
        }

        debugMoves('in:ENTITY_STATE_BATCH', { tick, count });
    }

    receiveChunkSnapshot(data: ClientInboundActionByOpcode<typeof Types.Messages.CHUNK_SNAPSHOT>): void {
        const [, chunkX, chunkY, version, payloadBytes] = data;
        if (
            typeof chunkX !== 'number'
            || typeof chunkY !== 'number'
            || typeof version !== 'number'
            || (!Array.isArray(payloadBytes) && !((payloadBytes as unknown) instanceof Uint8Array))
        ) {
            return;
        }
        const decoded = decodeChunkSnapshotPayloadBinary(payloadBytes);
        if (!decoded) {
            return;
        }
        this.kernel.clientChunkOverlayCache.applySnapshot({
            chunkX,
            chunkY,
            version,
            chunkSize: decoded.chunkSize,
            overrides: decoded.overrides,
        });
    }

    receiveChunkSnapshotPart(data: ClientInboundActionByOpcode<typeof Types.Messages.CHUNK_SNAPSHOT_PART>): void {
        const [, chunkX, chunkY, version, partIndex, partCount, payloadBytes] = data;
        if (
            typeof chunkX !== 'number'
            || typeof chunkY !== 'number'
            || typeof version !== 'number'
            || typeof partIndex !== 'number'
            || typeof partCount !== 'number'
            || (!Array.isArray(payloadBytes) && !((payloadBytes as unknown) instanceof Uint8Array))
        ) {
            return;
        }
        const decoded = decodeChunkSnapshotPayloadBinary(payloadBytes);
        if (!decoded) {
            return;
        }
        this.kernel.clientChunkOverlayCache.applySnapshotPart({
            chunkX,
            chunkY,
            version,
            partIndex,
            partCount,
            chunkSize: decoded.chunkSize,
            overrides: decoded.overrides,
        });
    }

    receiveChunkDelta(data: ClientInboundActionByOpcode<typeof Types.Messages.CHUNK_DELTA>): void {
        const [, chunkX, chunkY, fromVersion, toVersion, payloadBytes] = data;
        if (
            typeof chunkX !== 'number'
            || typeof chunkY !== 'number'
            || typeof fromVersion !== 'number'
            || typeof toVersion !== 'number'
            || (!Array.isArray(payloadBytes) && !((payloadBytes as unknown) instanceof Uint8Array))
        ) {
            return;
        }
        const decoded = decodeChunkDeltaPayloadBinary(payloadBytes);
        if (!decoded) {
            return;
        }
        this.kernel.clientChunkOverlayCache.applyDelta({
            chunkX,
            chunkY,
            fromVersion,
            toVersion,
            changes: decoded.changes,
        });
    }

    supportsIntent(intentTypeId: string): boolean {
        return (
            this.serverProtocolRevision !== null &&
            (this.serverCapabilities?.intentTypeIds?.includes(intentTypeId) ?? false)
        );
    }

    sendIntent(intentTypeId: string, payloadBytes: number[], options?: { trackMoveAck?: boolean }): number | null {
        if (!this.supportsIntent(intentTypeId)) {
            return null;
        }
        const seq = this.nextIntentSeq;
        this.nextIntentSeq = nextIntentSeq(this.nextIntentSeq);
        if (options?.trackMoveAck) {
            this.kernel.enqueueClientPendingMoveSeqAck(seq);
        }
        this.sendMessage(createIntentAction(seq, intentTypeId, payloadBytes));
        return seq;
    }

    sendHello(player: ClientPlayerLike): void {
        const armorKind = Types.getKindFromString(player.getSpriteName());
        const weaponName = player.getWeaponName();
        if (!weaponName) {
            log.error('Cannot send HELLO with missing weapon name');
            return;
        }
        const weaponKind = Types.getKindFromString(weaponName);

        if (armorKind === undefined || weaponKind === undefined) {
            log.error('Cannot send HELLO with unresolved equipment kinds');
            return;
        }

        this.sendMessage(createHelloAction(player.name, armorKind, weaponKind));
    }

    sendMove(x: number, y: number): void {
        if (!this.supportsIntent(INTENT_MOVE_STEP)) {
            debugMoves('out:INTENT(move.step):unavailable', { x, y });
            return;
        }

        const payloadBytes = encodeMoveStepIntentPayload(gridPos(x, y));
        if (payloadBytes === null) {
            return;
        }

        const seq = this.sendIntent(INTENT_MOVE_STEP, payloadBytes, { trackMoveAck: true });
        if (seq === null) {
            return;
        }
        debugMoves('out:INTENT(move.step)', { seq, x, y });
    }

    sendMoveTo(x: number, y: number, stopAdjacentToTarget: boolean): void {
        if (!this.supportsIntent(INTENT_MOVE_TO)) {
            debugMoves('out:INTENT(move.to):unavailable', { x, y, stopAdjacentToTarget });
            return;
        }

        const payloadBytes = encodeMoveToIntentPayload({ x, y, stopAdjacentToTarget });
        if (payloadBytes === null) {
            return;
        }

        const seq = this.sendIntent(INTENT_MOVE_TO, payloadBytes, { trackMoveAck: true });
        if (seq === null) {
            return;
        }
        debugMoves('out:INTENT(move.to)', { seq, x, y, stopAdjacentToTarget });
    }

    sendMoveInput(keysMask: number): void {
        if (!this.supportsIntent(INTENT_MOVE_INPUT)) {
            debugMoves('out:INTENT(move.input):unavailable', { keysMask });
            return;
        }

        const payloadBytes = encodeMoveInputIntentPayload({ keysMask });
        if (payloadBytes === null) {
            return;
        }

        const seq = this.sendIntent(INTENT_MOVE_INPUT, payloadBytes);
        if (seq === null) {
            return;
        }
        debugMoves('out:INTENT(move.input)', { seq, keysMask });
    }

    sendTileEdit(x: number, y: number, value: number | null): number | null {
        const payloadBytes = encodeTileEditIntentPayload({ x, y, value });
        if (payloadBytes === null) {
            return null;
        }
        return this.sendIntent(INTENT_TILE_EDIT, payloadBytes);
    }

    sendClaimCreate({
        x1,
        y1,
        x2,
        y2,
        editors = [],
    }: {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        editors?: ReadonlyArray<string>;
    }): number | null {
        const payloadBytes = encodeClaimCreateIntentPayload({ x1, y1, x2, y2, editors: [...editors] });
        if (payloadBytes === null) {
            return null;
        }
        return this.sendIntent(INTENT_CLAIM_CREATE, payloadBytes);
    }

    sendClaimUpdate({
        id,
        x1,
        y1,
        x2,
        y2,
        editors,
    }: {
        id: number;
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        editors?: ReadonlyArray<string>;
    }): number | null {
        const payloadBytes = encodeClaimUpdateIntentPayload({
            id,
            x1,
            y1,
            x2,
            y2,
            ...(editors !== undefined ? { editors: [...editors] } : {}),
        });
        if (payloadBytes === null) {
            return null;
        }
        return this.sendIntent(INTENT_CLAIM_UPDATE, payloadBytes);
    }

    sendClaimDelete(id: number): number | null {
        const payloadBytes = encodeClaimDeleteIntentPayload({ id });
        if (payloadBytes === null) {
            return null;
        }
        return this.sendIntent(INTENT_CLAIM_DELETE, payloadBytes);
    }

    sendLootMove(item: IdCarrier, x: number, y: number): void {
        this.sendMessage(createLootMoveAction(x, y, toProtocolEntityId(item.id)));
    }

    sendAggro(mob: IdCarrier): void {
        this.sendMessage(createAggroAction(toProtocolEntityId(mob.id)));
    }

    sendAttack(mob: IdCarrier): void {
        this.sendMessage(createAttackAction(toProtocolEntityId(mob.id)));
    }

    sendChat(text: string): void {
        this.sendMessage(createChatAction(text));
    }

    sendLoot(item: IdCarrier): void {
        this.sendMessage(createLootAction(toProtocolEntityId(item.id)));
    }

    sendTeleport(x: number, y: number): void {
        const payloadBytes = encodeDoorTeleportIntentPayload(gridPos(x, y));
        if (payloadBytes === null) {
            return;
        }
        this.sendIntent(INTENT_DOOR_TELEPORT, payloadBytes);
    }

    sendWho(ids: number[]): void {
        this.sendMessage(createWhoAction(ids));
    }

    sendZone(): void {
        this.sendMessage(createZoneAction());
    }

    sendChunkSubscribe(chunkX: number, chunkY: number, radius: number): void {
        const safeChunkX = Number.isSafeInteger(chunkX) ? chunkX : 0;
        const safeChunkY = Number.isSafeInteger(chunkY) ? chunkY : 0;
        const safeRadius = Number.isSafeInteger(radius) ? Math.max(0, Math.min(8, radius)) : 0;
        this.sendMessage(createChunkSubscribeAction(safeChunkX, safeChunkY, safeRadius));
    }

    sendChunkUnsubscribe(): void {
        this.sendMessage(createChunkUnsubscribeAction());
    }

    sendOpen(chest: IdCarrier): void {
        this.sendMessage(createOpenAction(toProtocolEntityId(chest.id)));
    }

    sendCheck(id: number | string): void {
        this.sendMessage(createCheckAction(id));
    }

    sendAchievement(id: number): void {
        this.sendMessage(createAchievementAction(id));
    }
}

export default GameClient;
