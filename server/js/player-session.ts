import Chest from './chest';
import Log from './log';
import Messages from './message';
import Utils from './utils';
import Formulas from './formulas';
import FormatModule from './format';
import Types from '../../shared/js/gametypes';
import type { ClientToServerProtocolAction } from '../../shared/js/protocol-contract-types';
import { HANDSHAKE_CONTROL } from '../../shared/js/connection-status';
import type { EntityKind } from '../../shared/js/entity-kind-domain';
import type Player from './player';

const check = FormatModule.check as (payload: ClientToServerProtocolAction) => boolean;
const log = Log.getLogger();

const NAME_MAX_UTF8_BYTES = 64;
const NAME_MAX_CODEPOINTS = 15;
const CHAT_MAX_UTF8_BYTES = 512;
const CHAT_MAX_CODEPOINTS = 60;
const WHO_MAX_IDS = 1000;

type MobLike = {
    id: number;
    armorLevel: number;
    weaponLevel: number;
    receiveDamage(dmg: number, playerId: number): void;
};

type LootEntity = {
    id: number;
    kind: EntityKind;
    despawn(): unknown;
};

export function attachPlayerSession(player: Player): void {
    const closeInvalidPayload = (reason: string): void => {
        if (player.connection && typeof player.connection.closeInvalidPayload === 'function') {
            player.connection.closeInvalidPayload(reason);
        } else {
            player.connection.close(reason);
        }
    };

    player.connection.listen((message: ClientToServerProtocolAction) => {
        const action = message[0];

        log.debug('Received: ' + message);
        if (!check(message)) {
            closeInvalidPayload('Invalid ' + Types.getMessageTypeAsString(action) + ' message format: ' + message);
            return;
        }

        if (!player.hasEnteredGame && action !== Types.Messages.HELLO) {
            closeInvalidPayload('Invalid handshake message: ' + message);
            return;
        }

        if (player.hasEnteredGame && !player.isDead && action === Types.Messages.HELLO) {
            closeInvalidPayload('Cannot initiate handshake twice: ' + message);
            return;
        }

        player.resetTimeout();

        if (action === Types.Messages.HELLO) {
            const rawName = message[1];
            if (typeof rawName !== 'string' || !Utils.hasMaxUtf8Bytes(rawName, NAME_MAX_UTF8_BYTES)) {
                closeInvalidPayload('Name is too long.');
                return;
            }
            let name = Utils.sanitize(rawName);
            name = Utils.limitUtf8Bytes(name, NAME_MAX_UTF8_BYTES);
            name = Utils.limitCodePoints(name, NAME_MAX_CODEPOINTS);

            player.name = name === '' ? 'lorem ipsum' : name;

            player.kind = Types.Entities.WARRIOR;
            player.equipArmor(message[2]);
            player.equipWeapon(message[3]);
            player.orientation = Utils.randomOrientation();
            player.updateHitPoints();
            player.updatePosition();

            player.server.addPlayer(player);
            player.server.emit('playerEnter', player);

            player.send([Types.Messages.WELCOME, player.id, player.name, player.x, player.y, player.hitPoints]);
            player.hasEnteredGame = true;
            player.isDead = false;
        } else if (action === Types.Messages.WHO) {
            if (message.length - 1 > WHO_MAX_IDS) {
                closeInvalidPayload('WHO message is too large.');
                return;
            }
            message.shift();
            player.server.pushSpawnsToPlayer(player, message as Array<string | number>);
        } else if (action === Types.Messages.ZONE) {
            player.emit('zone');
        } else if (action === Types.Messages.CHAT) {
            const rawMessage = message[1];
            if (typeof rawMessage !== 'string' || !Utils.hasMaxUtf8Bytes(rawMessage, CHAT_MAX_UTF8_BYTES)) {
                closeInvalidPayload('Chat message is too long.');
                return;
            }
            let chatMessage = Utils.sanitize(rawMessage);
            chatMessage = Utils.limitUtf8Bytes(chatMessage, CHAT_MAX_UTF8_BYTES);
            chatMessage = Utils.limitCodePoints(chatMessage, CHAT_MAX_CODEPOINTS);

            if (chatMessage && chatMessage !== '') {
                player.broadcastToZone(new Messages.Chat(player, chatMessage), false);
            }
        } else if (action === Types.Messages.MOVE) {
            const x = Number(message[1]);
            const y = Number(message[2]);

            if (player.server.isValidPosition(x, y)) {
                player.setPosition(x, y);
                player.clearTarget();

                player.broadcast(new Messages.Move(player));
                player.emit('move', player.x, player.y);
            }
        } else if (action === Types.Messages.LOOTMOVE) {
            player.setPosition(Number(message[1]), Number(message[2]));

            const item = player.server.getEntityById(message[3]);
            if (item) {
                player.clearTarget();

                player.broadcast(new Messages.LootMove(player, item));
                player.emit('lootMove', player.x, player.y);
            }
        } else if (action === Types.Messages.AGGRO) {
            player.server.handleMobHate(Number(message[1]), Number(player.id), 5);
        } else if (action === Types.Messages.ATTACK) {
            const targetMob = player.server.getEntityById(message[1]) as MobLike | null;

            if (targetMob) {
                player.setTarget(targetMob);
                player.server.broadcastAttacker(player);
            }
        } else if (action === Types.Messages.HIT) {
            const attackedMob = player.server.getEntityById(message[1]) as MobLike | null;
            if (attackedMob) {
                const dmg = Formulas.dmg(player.weaponLevel, attackedMob.armorLevel);

                if (dmg > 0) {
                    attackedMob.receiveDamage(dmg, player.id);
                    player.server.handleMobHate(attackedMob.id, player.id, dmg);
                    player.server.handleHurtEntity(attackedMob, player, dmg);
                }
            }
        } else if (action === Types.Messages.HURT) {
            const hurtingMob = player.server.getEntityById(message[1]) as MobLike | null;
            if (hurtingMob && player.hitPoints > 0) {
                player.hitPoints -= Formulas.dmg(hurtingMob.weaponLevel, player.armorLevel);
                player.server.handleHurtEntity(player);

                if (player.hitPoints <= 0) {
                    player.isDead = true;
                    if (player.firepotionTimeout) {
                        clearTimeout(player.firepotionTimeout);
                    }
                }
            }
        } else if (action === Types.Messages.LOOT) {
            const droppedItem = player.server.getEntityById(message[1]) as LootEntity | null;

            if (droppedItem) {
                const kind = droppedItem.kind;

                if (Types.isItem(kind)) {
                    player.broadcast(droppedItem.despawn());
                    player.server.removeEntity(droppedItem);

                    if (kind === Types.Entities.FIREPOTION) {
                        player.updateHitPoints();
                        player.broadcast(player.equip(Types.Entities.FIREFOX));
                        player.firepotionTimeout = setTimeout(function () {
                            player.broadcast(player.equip(player.armor));
                            player.firepotionTimeout = null;
                        }, 15000);
                        player.send(new Messages.HitPoints(player.maxHitPoints).serialize());
                    } else if (Types.isHealingItem(kind)) {
                        let amount = 0;

                        switch (kind) {
                            case Types.Entities.FLASK:
                                amount = 40;
                                break;
                            case Types.Entities.BURGER:
                                amount = 100;
                                break;
                        }

                        if (!player.hasFullHealth()) {
                            player.regenHealthBy(amount);
                            player.server.pushToPlayer(player, player.health());
                        }
                    } else if (Types.isArmor(kind) || Types.isWeapon(kind)) {
                        player.equipItem(droppedItem);
                        player.broadcast(player.equip(kind));
                    }
                }
            }
        } else if (action === Types.Messages.TELEPORT) {
            const x = Number(message[1]);
            const y = Number(message[2]);

            if (player.server.isValidPosition(x, y)) {
                player.setPosition(x, y);
                player.clearTarget();

                player.broadcast(new Messages.Teleport(player));

                player.server.handlePlayerVanish(player);
                player.server.pushRelevantEntityListTo(player);
            }
        } else if (action === Types.Messages.OPEN) {
            const chest = player.server.getEntityById(message[1]);
            if (chest && chest instanceof Chest) {
                player.server.handleOpenedChest(chest, player);
            }
        } else if (action === Types.Messages.CHECK) {
            const checkpoint = player.server.map.getCheckpoint(message[1]);
            if (checkpoint) {
                player.lastCheckpoint = checkpoint;
            }
        } else {
            player.emit('message', message);
        }
    });

    player.connection.onClose(() => {
        if (player.firepotionTimeout) {
            clearTimeout(player.firepotionTimeout);
        }
        clearTimeout(player.disconnectTimeout);
        player.emit('exit');
    });

    player.connection.sendUTF8(HANDSHAKE_CONTROL.GO);
}
