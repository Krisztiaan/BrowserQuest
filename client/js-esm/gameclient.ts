import EntityFactory from './entityfactory';
import log from './compat/log';
import Types from './compat/gametypes';
import type { EntityKind } from './compat/gametypes';
import { normalizeProtocolActionBatch } from './protocol-payload';
import type { TypedEventSource } from '../../shared/js/typed-event-emitter';
import { Evented } from '../../shared/js/evented';
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

type GameClientActionHandler = (data: unknown[]) => void;
type EntityId = string | number;

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
    handlers: Array<GameClientActionHandler | undefined>;

    constructor(host, port) {
        super();
        this.connection = null;
        this.host = host;
        this.port = port;
        this.isTimeout = false;
    
        this.handlers = [];
        this.handlers[Types.Messages.WELCOME] = this.receiveWelcome;
        this.handlers[Types.Messages.MOVE] = this.receiveMove;
        this.handlers[Types.Messages.LOOTMOVE] = this.receiveLootMove;
        this.handlers[Types.Messages.ATTACK] = this.receiveAttack;
        this.handlers[Types.Messages.SPAWN] = this.receiveSpawn;
        this.handlers[Types.Messages.DESPAWN] = this.receiveDespawn;
        this.handlers[Types.Messages.HEALTH] = this.receiveHealth;
        this.handlers[Types.Messages.CHAT] = this.receiveChat;
        this.handlers[Types.Messages.EQUIP] = this.receiveEquipItem;
        this.handlers[Types.Messages.DROP] = this.receiveDrop;
        this.handlers[Types.Messages.TELEPORT] = this.receiveTeleport;
        this.handlers[Types.Messages.DAMAGE] = this.receiveDamage;
        this.handlers[Types.Messages.POPULATION] = this.receivePopulation;
        this.handlers[Types.Messages.LIST] = this.receiveList;
        this.handlers[Types.Messages.DESTROY] = this.receiveDestroy;
        this.handlers[Types.Messages.KILL] = this.receiveKill;
        this.handlers[Types.Messages.HP] = this.receiveHitPoints;
        this.handlers[Types.Messages.BLINK] = this.receiveBlink;
    
        this.enable();
    }

    enable() {
        this.isListening = true;
    }

    disable() {
        this.isListening = false;
    }
    
    connect(dispatcherMode = false) {
        var scheme = window.location.protocol === "https:" ? "wss://" : "ws://",
            url = scheme + this.host +":"+ this.port +"/",
            self = this;
        
        log.info("Trying to connect to server : "+url);

        this.connection = new WebSocket(url);
        
        if(dispatcherMode) {
            this.connection.onmessage = function(e) {
                var reply = JSON.parse(e.data);
                var status = reply?.status;

                if(isDispatcherConnectStatus(status) && status === DISPATCHER_CONNECT_STATUS.OK) {
                    self.emit('dispatched', reply.host, reply.port);
                } else if(isDispatcherConnectStatus(status) && status === DISPATCHER_CONNECT_STATUS.FULL) {
                    alert("BrowserQuest is currently at maximum player population. Please retry later.");
                } else {
                    alert("Unknown error while connecting to BrowserQuest.");
                }
            };
        } else {
            this.connection.onopen = function(e) {
                log.info("Connected to server "+self.host+":"+self.port);
            };

            this.connection.onmessage = function(e) {
                if(e.data === HANDSHAKE_CONTROL.GO) {
                    self.emit('connected');
                    return;
                }
                if(e.data === HANDSHAKE_CONTROL.TIMEOUT) {
                    self.isTimeout = true;
                    return;
                }
                
                self.receiveMessage(e.data);
            };

            this.connection.onerror = function(e) {
                log.error(e, true);
            };

            this.connection.onclose = function() {
                log.debug("Connection closed");
                var container = document.getElementById('container');
                if(container) {
                    container.classList.add('error');
                }
                
                if(self.isTimeout) {
                    self.emit('disconnected', "You have been disconnected for being inactive for too long");
                } else {
                    self.emit('disconnected', "The connection to BrowserQuest has been lost");
                }
            };
        }
    }

    sendMessage(json: ClientOutboundProtocolAction) {
        var data;
        if(this.connection.readyState === 1) {
            data = JSON.stringify(json);
            this.connection.send(data);
        }
    }

    receiveMessage(message) {
        var data, actions;
    
        if(this.isListening) {
            data = JSON.parse(message);

            log.debug("data: " + message);
            actions = normalizeProtocolActionBatch(data);
            if(actions.length === 1) {
                this.receiveAction(actions[0]);
            } else if(actions.length > 1) {
                this.receiveActionBatch(actions);
            }
        }
    }

    receiveAction(data: ClientInboundProtocolAction) {
        var action = data[0];
        if(this.handlers[action] && typeof this.handlers[action] === "function") {
            this.handlers[action].call(this, data);
        }
        else {
            log.error("Unknown action : " + action);
        }
    }

    receiveActionBatch(actions: ClientProtocolBatch) {
        var self = this;

        actions.forEach(function(action) {
            self.receiveAction(action);
        });
    }

    receiveWelcome(data) {
        var id = data[1],
            name = data[2],
            x = data[3],
            y = data[4],
            hp = data[5];

        this.emit('welcome', id, name, x, y, hp);
    }

    receiveMove(data) {
        var id = data[1],
            x = data[2],
            y = data[3];

        this.emit('entityMove', id, x, y);
    }

    receiveLootMove(data) {
        var id = data[1], 
            item = data[2];

        this.emit('playerMoveToItem', id, item);
    }

    receiveAttack(data) {
        var attacker = data[1], 
            target = data[2];

        this.emit('entityAttack', attacker, target);
    }

    receiveSpawn(data) {
        var id = data[1],
            kind = data[2],
            x = data[3],
            y = data[4];
    
        if(Types.isItem(kind)) {
            var item = EntityFactory.createEntity(kind, id);

            this.emit('spawnItem', item, x, y);
        } else if(Types.isChest(kind)) {
            var item = EntityFactory.createEntity(kind, id);

            this.emit('spawnChest', item, x, y);
        } else {
            var name, orientation, target, weapon, armor;
        
            if(Types.isPlayer(kind)) {
                name = data[5];
                orientation = data[6];
                armor = data[7];
                weapon = data[8];
                if(data.length > 9) {
                    target = data[9];
                }
            }
            else if(Types.isMob(kind)) {
                orientation = data[5];
                if(data.length > 6) {
                    target = data[6];
                }
            }

            var character = EntityFactory.createEntity(kind, id, name);
        
            if(Types.isPlayer(kind) && character) {
                character.weaponName = Types.getKindAsString(weapon);
                character.spriteName = Types.getKindAsString(armor);
            }
        
            this.emit('spawnCharacter', character, x, y, orientation, target);
        }
    }

    receiveDespawn(data) {
        var id = data[1];

        this.emit('despawnEntity', id);
    }

    receiveHealth(data) {
        var points = data[1],
            isRegen = false;
    
        if(data[2]) {
            isRegen = true;
        }
    
        this.emit('playerChangeHealth', points, isRegen);
    }

    receiveChat(data) {
        var id = data[1],
            text = data[2];

        this.emit('chatMessage', id, text);
    }

    receiveEquipItem(data) {
        var id = data[1],
            itemKind = data[2];

        this.emit('playerEquipItem', id, itemKind);
    }

    receiveDrop(data) {
        var mobId = data[1],
            id = data[2],
            kind = data[3];
    
        var item = EntityFactory.createEntity(kind, id);
        item.wasDropped = true;
        item.playersInvolved = data[4];
    
        this.emit('dropItem', item, mobId);
    }

    receiveTeleport(data) {
        var id = data[1],
            x = data[2],
            y = data[3];

        this.emit('playerTeleport', id, x, y);
    }

    receiveDamage(data) {
        var id = data[1],
            dmg = data[2];

        this.emit('playerDamageMob', id, dmg);
    }

    receivePopulation(data) {
        var worldPlayers = data[1],
            totalPlayers = data[2];

        this.emit('populationChange', worldPlayers, totalPlayers);
    }

    receiveKill(data) {
        var mobKind = data[1];

        this.emit('playerKillMob', mobKind);
    }

    receiveList(data) {
        data.shift();

        this.emit('entityList', data);
    }

    receiveDestroy(data) {
        var id = data[1];

        this.emit('entityDestroy', id);
    }

    receiveHitPoints(data) {
        var maxHp = data[1];

        this.emit('playerChangeMaxHitPoints', maxHp);
    }

    receiveBlink(data) {
        var id = data[1];

        this.emit('itemBlink', id);
    }

    sendHello(player) {
        this.sendMessage([Types.Messages.HELLO,
                          player.name,
                          Types.getKindFromString(player.getSpriteName()),
                          Types.getKindFromString(player.getWeaponName())]);
    }

    sendMove(x, y) {
        this.sendMessage([Types.Messages.MOVE,
                          x,
                          y]);
    }

    sendLootMove(item, x, y) {
        this.sendMessage([Types.Messages.LOOTMOVE,
                          x,
                          y,
                          item.id]);
    }

    sendAggro(mob) {
        this.sendMessage([Types.Messages.AGGRO,
                          mob.id]);
    }

    sendAttack(mob) {
        this.sendMessage([Types.Messages.ATTACK,
                          mob.id]);
    }

    sendHit(mob) {
        this.sendMessage([Types.Messages.HIT,
                          mob.id]);
    }

    sendHurt(mob) {
        this.sendMessage([Types.Messages.HURT,
                          mob.id]);
    }

    sendChat(text) {
        this.sendMessage([Types.Messages.CHAT,
                          text]);
    }

    sendLoot(item) {
        this.sendMessage([Types.Messages.LOOT,
                          item.id]);
    }

    sendTeleport(x, y) {
        this.sendMessage([Types.Messages.TELEPORT,
                          x,
                          y]);
    }

    sendWho(ids) {
        ids.unshift(Types.Messages.WHO);
        this.sendMessage(ids);
    }

    sendZone() {
        this.sendMessage([Types.Messages.ZONE]);
    }

    sendOpen(chest) {
        this.sendMessage([Types.Messages.OPEN,
                          chest.id]);
    }

    sendCheck(id) {
        this.sendMessage([Types.Messages.CHECK,
                          id]);
    }
}

export default GameClient;
