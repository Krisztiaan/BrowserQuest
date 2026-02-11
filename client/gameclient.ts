import EntityFactory from './entityfactory';
import log from './compat/log';
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
import { decodeServerToClientProtocolActionBatch } from '../shared/protocol-registry';
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

type EntityId = string | number;
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
    host: string;
    port: number;
    isTimeout: boolean;
    isListening: boolean;
    handlers: GameClientInboundActionHandlerMap;

    constructor(host: string, port: number) {
        super();
        this.connection = null;
        this.host = host;
        this.port = port;
        this.isTimeout = false;
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
        const scheme = window.location.protocol === 'https:' ? 'wss://' : 'ws://',
            url = scheme + this.host + ':' + this.port + '/',
            self = this;

        log.info('Trying to connect to server : ' + url);

        this.connection = new WebSocket(url);

        if (dispatcherMode) {
            this.connection.onmessage = function (e: MessageEvent) {
                const reply = JSON.parse(e.data);
                const status = reply?.status;

                if (isDispatcherConnectStatus(status) && status === DISPATCHER_CONNECT_STATUS.OK) {
                    self.emit('dispatched', reply.host, reply.port);
                } else if (isDispatcherConnectStatus(status) && status === DISPATCHER_CONNECT_STATUS.FULL) {
                    alert('BrowserQuest is currently at maximum player population. Please retry later.');
                } else {
                    alert('Unknown error while connecting to BrowserQuest.');
                }
            };
        } else {
            this.connection.onopen = function (_e: Event) {
                log.info('Connected to server ' + self.host + ':' + self.port);
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
        let data;
        if (this.connection.readyState === 1) {
            data = JSON.stringify(json);
            this.connection.send(data);
        }
    }

    receiveMessage(message: string): void {
        let actions;

        if (this.isListening) {
            log.debug('data: ' + message);
            actions = decodeServerToClientProtocolActionBatch(message);
            if (actions.length === 1) {
                this.receiveAction(actions[0]);
            } else if (actions.length > 1) {
                this.receiveActionBatch(actions);
            }
        }
    }

    receiveAction(data: ClientInboundProtocolAction): void {
        const action = data[0];
        const handler = this.handlers[action] as (payload: ClientInboundProtocolAction) => void;
        handler(data);
    }

    receiveActionBatch(actions: ClientProtocolBatch): void {
        for (const action of actions) {
            this.receiveAction(action);
        }
    }

    receiveWelcome(data: ClientInboundActionByOpcode<typeof Types.Messages.WELCOME>): void {
        const [, id, name, x, y, hp] = data;
        this.emit('welcome', id, name, x, y, hp);
    }

    receiveMove(data: ClientInboundActionByOpcode<typeof Types.Messages.MOVE>): void {
        const [, id, x, y] = data;
        this.emit('entityMove', id, x, y);
    }

    receiveLootMove(data: ClientInboundActionByOpcode<typeof Types.Messages.LOOTMOVE>): void {
        const [, id, item] = data;
        this.emit('playerMoveToItem', id, item);
    }

    receiveAttack(data: ClientInboundActionByOpcode<typeof Types.Messages.ATTACK>): void {
        const [, attacker, target] = data;
        this.emit('entityAttack', attacker, target);
    }

    receiveSpawn(data: ClientInboundActionByOpcode<typeof Types.Messages.SPAWN>): void {
        const [, id, kind, x, y, ...spawnData] = data;

        if (Types.isItem(kind)) {
            const item = EntityFactory.createEntity(kind, id);
            this.emit('spawnItem', item, x, y);
            return;
        }

        if (Types.isChest(kind)) {
            const item = EntityFactory.createEntity(kind, id);
            this.emit('spawnChest', item, x, y);
            return;
        }

        let name: string | undefined;
        let orientation: number | undefined;
        let target: EntityId | undefined;
        let weapon: EntityKind | undefined;
        let armor: EntityKind | undefined;

        if (Types.isPlayer(kind)) {
            if (typeof spawnData[0] === 'string') {
                name = spawnData[0];
            }
            if (typeof spawnData[1] === 'number') {
                orientation = spawnData[1];
            }
            if (typeof spawnData[2] === 'number') {
                armor = spawnData[2] as EntityKind;
            }
            if (typeof spawnData[3] === 'number') {
                weapon = spawnData[3] as EntityKind;
            }
            if (typeof spawnData[4] === 'number' || typeof spawnData[4] === 'string') {
                target = spawnData[4];
            }
        } else if (Types.isMob(kind)) {
            if (typeof spawnData[0] === 'number') {
                orientation = spawnData[0];
            }
            if (typeof spawnData[1] === 'number' || typeof spawnData[1] === 'string') {
                target = spawnData[1];
            }
        }

        const character = EntityFactory.createEntity(kind, id, name);

        if (Types.isPlayer(kind)) {
            character.weaponName = weapon !== undefined ? Types.getKindAsString(weapon) : undefined;
            character.spriteName = armor !== undefined ? Types.getKindAsString(armor) : undefined;
        }

        this.emit('spawnCharacter', character, x, y, orientation, target);
    }

    receiveDespawn(data: ClientInboundActionByOpcode<typeof Types.Messages.DESPAWN>): void {
        const [, id] = data;
        this.emit('despawnEntity', id);
    }

    receiveHealth(data: ClientInboundActionByOpcode<typeof Types.Messages.HEALTH>): void {
        const [, points, isRegenFlag] = data;
        this.emit('playerChangeHealth', points, isRegenFlag === 1);
    }

    receiveChat(data: ClientInboundActionByOpcode<typeof Types.Messages.CHAT>): void {
        const [, id, text] = data;
        this.emit('chatMessage', id, text);
    }

    receiveEquipItem(data: ClientInboundActionByOpcode<typeof Types.Messages.EQUIP>): void {
        const [, id, itemKind] = data;
        this.emit('playerEquipItem', id, itemKind);
    }

    receiveDrop(data: ClientInboundActionByOpcode<typeof Types.Messages.DROP>): void {
        const [, mobId, id, kind, playersInvolved] = data;
        const item = EntityFactory.createEntity(kind, id);
        item.wasDropped = true;
        item.playersInvolved = playersInvolved;
        this.emit('dropItem', item, mobId);
    }

    receiveTeleport(data: ClientInboundActionByOpcode<typeof Types.Messages.TELEPORT>): void {
        const [, id, x, y] = data;
        this.emit('playerTeleport', id, x, y);
    }

    receiveDamage(data: ClientInboundActionByOpcode<typeof Types.Messages.DAMAGE>): void {
        const [, id, dmg] = data;
        this.emit('playerDamageMob', id, dmg);
    }

    receivePopulation(data: ClientInboundActionByOpcode<typeof Types.Messages.POPULATION>): void {
        const [, worldPlayers, totalPlayers] = data;
        this.emit('populationChange', worldPlayers, totalPlayers);
    }

    receiveKill(data: ClientInboundActionByOpcode<typeof Types.Messages.KILL>): void {
        const [, mobKind] = data;
        this.emit('playerKillMob', mobKind);
    }

    receiveList(data: ClientInboundActionByOpcode<typeof Types.Messages.LIST>): void {
        const [, ...ids] = data;
        this.emit('entityList', ids);
    }

    receiveDestroy(data: ClientInboundActionByOpcode<typeof Types.Messages.DESTROY>): void {
        const [, id] = data;
        this.emit('entityDestroy', id);
    }

    receiveHitPoints(data: ClientInboundActionByOpcode<typeof Types.Messages.HP>): void {
        const [, maxHp] = data;
        this.emit('playerChangeMaxHitPoints', maxHp);
    }

    receiveBlink(data: ClientInboundActionByOpcode<typeof Types.Messages.BLINK>): void {
        const [, id] = data;
        this.emit('itemBlink', id);
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
