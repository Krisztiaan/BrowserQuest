import EntityFactory from './entityfactory';
import log from './platform/log';
import Types from '../shared/gametypes-browser';
import type { EntityKind } from '../shared/entity-kind-domain';
import {
    createGameClientInboundHandlers,
    type GameClientInboundActionHandlerMap,
} from './gameclient-inbound-handlers';
import {
    createAggroAction,
    createAttackAction,
    createChatAction,
    createCheckAction,
    createHelloAction,
    createHitAction,
    createHurtAction,
    createLootAction,
    createLootMoveAction,
    createMoveAction,
    createOpenAction,
    createTeleportAction,
    createWhoAction,
    createZoneAction,
    toProtocolEntityId,
} from './gameclient-outbound-actions';
import type { TypedEventSource } from '../shared/typed-event-emitter';
import { Evented } from '../shared/evented';
import { decodeServerToClientProtocolActionBatch } from '../shared/protocol/registry';
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
} from './client-boundary-types';
import type { EntityId } from '../shared/domain/ids';
import { entityIdFromWire } from '../shared/domain/ids';
import { decodeSpawnAction } from '../shared/replication/spawn-snapshot';
import { adaptKernelEntityForRendering } from './ecs/kernel-entity-adapter';
import { ClientWorldKernel } from './ecs/world-kernel';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeParseJson(payload: string): unknown {
    try {
        return JSON.parse(payload);
    } catch (_) {
        return null;
    }
}

type ClientPlayerLike = {
    name: string;
    getSpriteName(): string;
    getWeaponName(): string;
};
type IdCarrier = { id: EntityId };

export type GameClientEvents = {
    dispatched: [host: string, port: number];
    connected: [];
    disconnected: [reason: string];
    welcome: [id: EntityId, name: string, x: number, y: number, hp: number];
    spawnCharacter: [
        entity: unknown,
        x: number,
        y: number,
        orientation: number | undefined,
        target: EntityId | undefined,
    ];
    spawnItem: [item: unknown, x: number, y: number];
    spawnChest: [chest: unknown, x: number, y: number];
    despawnEntity: [entityId: EntityId];
    entityMove: [entityId: EntityId, x: number, y: number];
    entityAttack: [attackerId: EntityId, targetId: EntityId];
    playerChangeHealth: [points: number, isRegen: boolean];
    playerEquipItem: [entityId: EntityId, itemKind: EntityKind];
    playerMoveToItem: [playerId: EntityId, itemId: EntityId];
    playerTeleport: [entityId: EntityId, x: number, y: number];
    chatMessage: [entityId: EntityId, text: string];
    dropItem: [item: unknown, mobId: EntityId];
    playerDamageMob: [mobId: EntityId, points: number];
    playerKillMob: [kind: EntityKind];
    populationChange: [worldPlayers: number, totalPlayers: number];
    entityList: [list: EntityId[]];
    entityDestroy: [entityId: EntityId];
    playerChangeMaxHitPoints: [maxHp: number];
    itemBlink: [entityId: EntityId];
};

export type GameClientEventSource = TypedEventSource<GameClientEvents>;

class GameClient extends Evented<GameClientEvents> {
    connection: WebSocket | null;
    wsUrl: string;
    isTimeout: boolean;
    isListening: boolean;
    handlers: GameClientInboundActionHandlerMap;
    kernel: ClientWorldKernel;

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

        log.info('Trying to connect to server : ' + url);

        this.connection = new WebSocket(url);

        if (dispatcherMode) {
            this.connection.onmessage = function (e: MessageEvent) {
                if (typeof e.data !== 'string') {
                    alert('Unknown error while connecting to BrowserQuest.');
                    return;
                }

                const reply = safeParseJson(e.data);
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
            this.connection.onopen = function (_e: Event) {
                log.info('Connected to server ' + self.wsUrl);
            };

            this.connection.onmessage = function (e: MessageEvent) {
                if (e.data === HANDSHAKE_CONTROL.GO) {
                    self.emit('connected');
                    return;
                }
                if (e.data === HANDSHAKE_CONTROL.TIMEOUT) {
                    self.isTimeout = true;
                    return;
                }

                if (typeof e.data === 'string') {
                    self.receiveMessage(e.data);
                }
            };

            this.connection.onerror = function (e: Event) {
                log.error(e, true);
            };

            this.connection.onclose = function () {
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

    sendMessage(json: ClientOutboundProtocolAction): void {
        if (this.connection?.readyState !== WebSocket.OPEN) {
            return;
        }
        const data = JSON.stringify(json);
        this.connection.send(data);
    }

    receiveMessage(message: string): void {
        if (!this.isListening) {
            return;
        }

        log.debug('data: ' + message);
        const actions = decodeServerToClientProtocolActionBatch(message);
        if (actions.length === 1) {
            const action = actions[0];
            if (action) {
                this.receiveAction(action);
            }
            return;
        }

        if (actions.length > 1) {
            this.receiveActionBatch(actions);
        }
    }

    receiveAction(data: ClientInboundProtocolAction): void {
        const action = data[0];
        const handler = this.handlers[action];
        handler(data as never);
    }

    receiveActionBatch(actions: ClientProtocolBatch): void {
        for (const action of actions) {
            this.receiveAction(action);
        }
    }

    receiveWelcome(data: ClientInboundActionByOpcode<typeof Types.Messages.WELCOME>): void {
        const [, id, name, x, y, hp] = data;
        this.emit('welcome', entityIdFromWire(id), name, x, y, hp);
    }

    receiveMove(data: ClientInboundActionByOpcode<typeof Types.Messages.MOVE>): void {
        const [, id, x, y] = data;
        const entityId = entityIdFromWire(id);
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

    sendHello(player: ClientPlayerLike): void {
        const armorKind = Types.getKindFromString(player.getSpriteName());
        const weaponKind = Types.getKindFromString(player.getWeaponName());

        if (armorKind === undefined || weaponKind === undefined) {
            log.error('Cannot send HELLO with unresolved equipment kinds');
            return;
        }

        this.sendMessage(createHelloAction(player.name, armorKind, weaponKind));
    }

    sendMove(x: number, y: number): void {
        this.sendMessage(createMoveAction(x, y));
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

    sendHit(mob: IdCarrier): void {
        this.sendMessage(createHitAction(toProtocolEntityId(mob.id)));
    }

    sendHurt(mob: IdCarrier): void {
        this.sendMessage(createHurtAction(toProtocolEntityId(mob.id)));
    }

    sendChat(text: string): void {
        this.sendMessage(createChatAction(text));
    }

    sendLoot(item: IdCarrier): void {
        this.sendMessage(createLootAction(toProtocolEntityId(item.id)));
    }

    sendTeleport(x: number, y: number): void {
        this.sendMessage(createTeleportAction(x, y));
    }

    sendWho(ids: number[]): void {
        this.sendMessage(createWhoAction(ids));
    }

    sendZone(): void {
        this.sendMessage(createZoneAction());
    }

    sendOpen(chest: IdCarrier): void {
        this.sendMessage(createOpenAction(toProtocolEntityId(chest.id)));
    }

    sendCheck(id: number | string): void {
        this.sendMessage(createCheckAction(id));
    }
}

export default GameClient;
