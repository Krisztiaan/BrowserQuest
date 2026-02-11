import EntityFactory from './entityfactory';
import log from './compat/log';
import Types from './compat/gametypes';
import type { EntityKind } from './compat/gametypes';
import { createGameClientInboundHandlers } from './gameclient-inbound-handlers';
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
import type { TypedEventSource } from '../../shared/js/typed-event-emitter';
import { Evented } from '../../shared/js/evented';
import { decodeServerToClientProtocolActionBatch } from '../../shared/js/protocol-registry';
import {
    DISPATCHER_CONNECT_STATUS,
    HANDSHAKE_CONTROL,
    isDispatcherConnectStatus,
} from '../../shared/js/connection-status';
import type {
    ClientInboundProtocolAction,
    ClientOutboundProtocolAction,
    ClientProtocolBatch,
} from './client-boundary-types';

type EntityId = string | number;
type InboundAction<Opcode extends ClientInboundProtocolAction[0]> = Extract<
    ClientInboundProtocolAction,
    [Opcode, ...unknown[]]
>;
type GameClientActionHandler = (data: ClientInboundProtocolAction) => void;
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
    handlers: Record<ClientInboundProtocolAction[0], GameClientActionHandler>;

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
        var scheme = window.location.protocol === 'https:' ? 'wss://' : 'ws://',
            url = scheme + this.host + ':' + this.port + '/',
            self = this;

        log.info('Trying to connect to server : ' + url);

        this.connection = new WebSocket(url);

        if (dispatcherMode) {
            this.connection.onmessage = function (e: MessageEvent) {
                var reply = JSON.parse(e.data);
                var status = reply?.status;

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
                var container = document.getElementById('container');
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
        var data;
        if (this.connection.readyState === 1) {
            data = JSON.stringify(json);
            this.connection.send(data);
        }
    }

    receiveMessage(message: string): void {
        var actions;

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
        this.handlers[action](data);
    }

    receiveActionBatch(actions: ClientProtocolBatch): void {
        var self = this;

        actions.forEach(function (action: ClientInboundProtocolAction) {
            self.receiveAction(action);
        });
    }

    receiveWelcome(data: ClientInboundProtocolAction): void {
        const [, id, name, x, y, hp] = data as InboundAction<typeof Types.Messages.WELCOME>;
        this.emit('welcome', id, name, x, y, hp);
    }

    receiveMove(data: ClientInboundProtocolAction): void {
        const [, id, x, y] = data as InboundAction<typeof Types.Messages.MOVE>;
        this.emit('entityMove', id, x, y);
    }

    receiveLootMove(data: ClientInboundProtocolAction): void {
        const [, id, item] = data as InboundAction<typeof Types.Messages.LOOTMOVE>;
        this.emit('playerMoveToItem', id, item);
    }

    receiveAttack(data: ClientInboundProtocolAction): void {
        const [, attacker, target] = data as InboundAction<typeof Types.Messages.ATTACK>;
        this.emit('entityAttack', attacker, target);
    }

    receiveSpawn(data: ClientInboundProtocolAction): void {
        const [, id, kind, x, y, ...spawnData] = data as InboundAction<typeof Types.Messages.SPAWN>;

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

        if (Types.isPlayer(kind) && character) {
            character.weaponName = weapon !== undefined ? Types.getKindAsString(weapon) : undefined;
            character.spriteName = armor !== undefined ? Types.getKindAsString(armor) : undefined;
        }

        this.emit('spawnCharacter', character, x, y, orientation, target);
    }

    receiveDespawn(data: ClientInboundProtocolAction): void {
        const [, id] = data as InboundAction<typeof Types.Messages.DESPAWN>;
        this.emit('despawnEntity', id);
    }

    receiveHealth(data: ClientInboundProtocolAction): void {
        const [, points, isRegenFlag] = data as InboundAction<typeof Types.Messages.HEALTH>;
        this.emit('playerChangeHealth', points, isRegenFlag === 1);
    }

    receiveChat(data: ClientInboundProtocolAction): void {
        const [, id, text] = data as InboundAction<typeof Types.Messages.CHAT>;
        this.emit('chatMessage', id, text);
    }

    receiveEquipItem(data: ClientInboundProtocolAction): void {
        const [, id, itemKind] = data as InboundAction<typeof Types.Messages.EQUIP>;
        this.emit('playerEquipItem', id, itemKind);
    }

    receiveDrop(data: ClientInboundProtocolAction): void {
        const [, mobId, id, kind, playersInvolved] = data as InboundAction<typeof Types.Messages.DROP>;
        const item = EntityFactory.createEntity(kind, id);
        item.wasDropped = true;
        item.playersInvolved = playersInvolved;
        this.emit('dropItem', item, mobId);
    }

    receiveTeleport(data: ClientInboundProtocolAction): void {
        const [, id, x, y] = data as InboundAction<typeof Types.Messages.TELEPORT>;
        this.emit('playerTeleport', id, x, y);
    }

    receiveDamage(data: ClientInboundProtocolAction): void {
        const [, id, dmg] = data as InboundAction<typeof Types.Messages.DAMAGE>;
        this.emit('playerDamageMob', id, dmg);
    }

    receivePopulation(data: ClientInboundProtocolAction): void {
        const [, worldPlayers, totalPlayers] = data as InboundAction<typeof Types.Messages.POPULATION>;
        this.emit('populationChange', worldPlayers, totalPlayers);
    }

    receiveKill(data: ClientInboundProtocolAction): void {
        const [, mobKind] = data as InboundAction<typeof Types.Messages.KILL>;
        this.emit('playerKillMob', mobKind);
    }

    receiveList(data: ClientInboundProtocolAction): void {
        const [, ...ids] = data as InboundAction<typeof Types.Messages.LIST>;
        this.emit('entityList', ids);
    }

    receiveDestroy(data: ClientInboundProtocolAction): void {
        const [, id] = data as InboundAction<typeof Types.Messages.DESTROY>;
        this.emit('entityDestroy', id);
    }

    receiveHitPoints(data: ClientInboundProtocolAction): void {
        const [, maxHp] = data as InboundAction<typeof Types.Messages.HP>;
        this.emit('playerChangeMaxHitPoints', maxHp);
    }

    receiveBlink(data: ClientInboundProtocolAction): void {
        const [, id] = data as InboundAction<typeof Types.Messages.BLINK>;
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
