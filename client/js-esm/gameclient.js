import EntityFactory from 'entityfactory';
import BISON from 'lib/bison';
import log from 'compat/log';
import Types from 'compat/gametypes';
import { normalizeProtocolActionBatch } from 'protocol-payload';

/** @typedef {import('./client-boundary-types').ClientProtocolAction} ClientProtocolAction */
/** @typedef {import('./client-boundary-types').ClientProtocolBatch} ClientProtocolBatch */

class GameClient {
    constructor(host, port) {
        this.connection = null;
        this.host = host;
        this.port = port;

        this.connected_callback = null;
        this.spawn_callback = null;
        this.movement_callback = null;
        this.isTimeout = false;
    
        this.handlers = [];
        this.handlers[Types.Messages.WELCOME] = this.receiveWelcome;
        this.handlers[Types.Messages.MOVE] = this.receiveMove;
        this.handlers[Types.Messages.LOOTMOVE] = this.receiveLootMove;
        this.handlers[Types.Messages.ATTACK] = this.receiveAttack;
        this.handlers[Types.Messages.SPAWN] = this.receiveSpawn;
        this.handlers[Types.Messages.DESPAWN] = this.receiveDespawn;
        this.handlers[Types.Messages.SPAWN_BATCH] = this.receiveSpawnBatch;
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
    
        this.useBison = false;
        this.enable();
    }

    enable() {
        this.isListening = true;
    }

    disable() {
        this.isListening = false;
    }
    
    connect(dispatcherMode) {
        var scheme = window.location.protocol === "https:" ? "wss://" : "ws://",
            url = scheme + this.host +":"+ this.port +"/",
            self = this;
        
        log.info("Trying to connect to server : "+url);

        this.connection = new WebSocket(url);
        
        if(dispatcherMode) {
            this.connection.onmessage = function(e) {
                var reply = JSON.parse(e.data);

                if(reply.status === 'OK') {
                    self.dispatched_callback(reply.host, reply.port);
                } else if(reply.status === 'FULL') {
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
                if(e.data === "go") {
                    if(self.connected_callback) {
                        self.connected_callback();
                    }
                    return;
                }
                if(e.data === 'timeout') {
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
                
                if(self.disconnected_callback) {
                    if(self.isTimeout) {
                        self.disconnected_callback("You have been disconnected for being inactive for too long");
                    } else {
                        self.disconnected_callback("The connection to BrowserQuest has been lost");
                    }
                }
            };
        }
    }

    sendMessage(json) {
        var data;
        if(this.connection.readyState === 1) {
            if(this.useBison) {
                data = BISON.encode(json);
            } else {
                data = JSON.stringify(json);
            }
            this.connection.send(data);
        }
    }

    receiveMessage(message) {
        var data, actions;
    
        if(this.isListening) {
            if(this.useBison) {
                data = BISON.decode(message);
            } else {
                data = JSON.parse(message);
            }

            log.debug("data: " + message);
            actions = normalizeProtocolActionBatch(data);
            if(actions.length === 1) {
                this.receiveAction(actions[0]);
            } else if(actions.length > 1) {
                this.receiveActionBatch(actions);
            }
        }
    }

    /**
     * @param {ClientProtocolAction} data
     */
    receiveAction(data) {
        var action = data[0];
        if(this.handlers[action] && typeof this.handlers[action] === "function") {
            this.handlers[action].call(this, data);
        }
        else {
            log.error("Unknown action : " + action);
        }
    }

    /**
     * @param {ClientProtocolBatch} actions
     */
    receiveActionBatch(actions) {
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
    
        if(this.welcome_callback) {
            this.welcome_callback(id, name, x, y, hp);
        }
    }

    receiveMove(data) {
        var id = data[1],
            x = data[2],
            y = data[3];
    
        if(this.move_callback) {
            this.move_callback(id, x, y);
        }
    }

    receiveLootMove(data) {
        var id = data[1], 
            item = data[2];
    
        if(this.lootmove_callback) {
            this.lootmove_callback(id, item);
        }
    }

    receiveAttack(data) {
        var attacker = data[1], 
            target = data[2];
    
        if(this.attack_callback) {
            this.attack_callback(attacker, target);
        }
    }

    receiveSpawn(data) {
        var id = data[1],
            kind = data[2],
            x = data[3],
            y = data[4];
    
        if(Types.isItem(kind)) {
            var item = EntityFactory.createEntity(kind, id);
        
            if(this.spawn_item_callback) {
                this.spawn_item_callback(item, x, y);
            }
        } else if(Types.isChest(kind)) {
            var item = EntityFactory.createEntity(kind, id);
        
            if(this.spawn_chest_callback) {
                this.spawn_chest_callback(item, x, y);
            }
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
        
            if(this.spawn_character_callback) {
                this.spawn_character_callback(character, x, y, orientation, target);
            }
        }
    }

    receiveSpawnBatch(data) {
        data.slice(1).forEach(function(spawn) {
            if(spawn instanceof Array) {
                this.receiveSpawn(spawn);
            }
        }, this);
    }

    receiveDespawn(data) {
        var id = data[1];
    
        if(this.despawn_callback) {
            this.despawn_callback(id);
        }
    }

    receiveHealth(data) {
        var points = data[1],
            isRegen = false;
    
        if(data[2]) {
            isRegen = true;
        }
    
        if(this.health_callback) {
            this.health_callback(points, isRegen);
        }
    }

    receiveChat(data) {
        var id = data[1],
            text = data[2];
    
        if(this.chat_callback) {
            this.chat_callback(id, text);
        }
    }

    receiveEquipItem(data) {
        var id = data[1],
            itemKind = data[2];
    
        if(this.equip_callback) {
            this.equip_callback(id, itemKind);
        }
    }

    receiveDrop(data) {
        var mobId = data[1],
            id = data[2],
            kind = data[3];
    
        var item = EntityFactory.createEntity(kind, id);
        item.wasDropped = true;
        item.playersInvolved = data[4];
    
        if(this.drop_callback) {
            this.drop_callback(item, mobId);
        }
    }

    receiveTeleport(data) {
        var id = data[1],
            x = data[2],
            y = data[3];
    
        if(this.teleport_callback) {
            this.teleport_callback(id, x, y);
        }
    }

    receiveDamage(data) {
        var id = data[1],
            dmg = data[2];
    
        if(this.dmg_callback) {
            this.dmg_callback(id, dmg);
        }
    }

    receivePopulation(data) {
        var worldPlayers = data[1],
            totalPlayers = data[2];
    
        if(this.population_callback) {
            this.population_callback(worldPlayers, totalPlayers);
        }
    }

    receiveKill(data) {
        var mobKind = data[1];
    
        if(this.kill_callback) {
            this.kill_callback(mobKind);
        }
    }

    receiveList(data) {
        data.shift();
    
        if(this.list_callback) {
            this.list_callback(data);
        }
    }

    receiveDestroy(data) {
        var id = data[1];
    
        if(this.destroy_callback) {
            this.destroy_callback(id);
        }
    }

    receiveHitPoints(data) {
        var maxHp = data[1];
    
        if(this.hp_callback) {
            this.hp_callback(maxHp);
        }
    }

    receiveBlink(data) {
        var id = data[1];
    
        if(this.blink_callback) {
            this.blink_callback(id);
        }
    }
    
    onDispatched(callback) {
        this.dispatched_callback = callback;
    }

    onConnected(callback) {
        this.connected_callback = callback;
    }
    
    onDisconnected(callback) {
        this.disconnected_callback = callback;
    }

    onWelcome(callback) {
        this.welcome_callback = callback;
    }

    onSpawnCharacter(callback) {
        this.spawn_character_callback = callback;
    }

    onSpawnItem(callback) {
        this.spawn_item_callback = callback;
    }

    onSpawnChest(callback) {
        this.spawn_chest_callback = callback;
    }

    onDespawnEntity(callback) {
        this.despawn_callback = callback;
    }

    onEntityMove(callback) {
        this.move_callback = callback;
    }

    onEntityAttack(callback) {
        this.attack_callback = callback;
    }

    onPlayerChangeHealth(callback) {
        this.health_callback = callback;
    }

    onPlayerEquipItem(callback) {
        this.equip_callback = callback;
    }

    onPlayerMoveToItem(callback) {
        this.lootmove_callback = callback;
    }

    onPlayerTeleport(callback) {
        this.teleport_callback = callback;
    }

    onChatMessage(callback) {
        this.chat_callback = callback;
    }

    onDropItem(callback) {
        this.drop_callback = callback;
    }

    onPlayerDamageMob(callback) {
        this.dmg_callback = callback;
    }

    onPlayerKillMob(callback) {
        this.kill_callback = callback;
    }

    onPopulationChange(callback) {
        this.population_callback = callback;
    }

    onEntityList(callback) {
        this.list_callback = callback;
    }

    onEntityDestroy(callback) {
        this.destroy_callback = callback;
    }

    onPlayerChangeMaxHitPoints(callback) {
        this.hp_callback = callback;
    }

    onItemBlink(callback) {
        this.blink_callback = callback;
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
