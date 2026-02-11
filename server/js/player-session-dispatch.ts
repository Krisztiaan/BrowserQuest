import Chest from './chest';
import Messages from './message';
import Utils from './utils';
import Formulas from './formulas';
import Types from '../../shared/js/gametypes-browser';
import { PLAYER_SESSION_DISPATCH_OPCODES } from '../../shared/js/protocol-handler-opcodes';
import type { ClientToServerHelloAction, ClientToServerProtocolAction } from '../../shared/js/protocol-contract-types';
import type { EntityKind } from '../../shared/js/entity-kind-domain';
import type Player from './player';

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

type CloseInvalidPayload = (reason: string) => void;
type ClientDispatchHandler = (message: ClientToServerProtocolAction) => void;

function handleHello(
    player: Player,
    message: ClientToServerHelloAction,
    closeInvalidPayload: CloseInvalidPayload
): void {
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
    const armorKind = Number(message[2]) as EntityKind;
    const weaponKind = Number(message[3]) as EntityKind;
    player.equipArmor(armorKind);
    player.equipWeapon(weaponKind);
    player.orientation = Utils.randomOrientation();
    player.updateHitPoints();
    player.updatePosition();

    player.server.addPlayer(player);
    player.server.emit('playerEnter', player);

    player.send([Types.Messages.WELCOME, player.id, player.name, player.x, player.y, player.hitPoints]);
    player.hasEnteredGame = true;
    player.isDead = false;
}

function handleWho(
    player: Player,
    message: ClientToServerProtocolAction,
    closeInvalidPayload: CloseInvalidPayload
): void {
    if (message.length - 1 > WHO_MAX_IDS) {
        closeInvalidPayload('WHO message is too large.');
        return;
    }

    const [, ...entityIds] = message;
    player.server.pushSpawnsToPlayer(player, entityIds as Array<string | number>);
}

function handleChat(
    player: Player,
    message: ClientToServerProtocolAction,
    closeInvalidPayload: CloseInvalidPayload
): void {
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
}

function handleMove(player: Player, message: ClientToServerProtocolAction): void {
    const x = Number(message[1]);
    const y = Number(message[2]);

    if (player.server.isValidPosition(x, y)) {
        player.setPosition(x, y);
        player.clearTarget();

        player.broadcast(new Messages.Move(player));
        player.emit('move', player.x, player.y);
    }
}

function handleLootMove(player: Player, message: ClientToServerProtocolAction): void {
    player.setPosition(Number(message[1]), Number(message[2]));

    const item = player.server.getEntityById(message[3]);
    if (item) {
        player.clearTarget();

        player.broadcast(new Messages.LootMove(player, item));
        player.emit('lootMove', player.x, player.y);
    }
}

function handleAttack(player: Player, message: ClientToServerProtocolAction): void {
    const targetMob = player.server.getEntityById(message[1]) as MobLike | null;

    if (targetMob) {
        player.setTarget(targetMob);
        player.server.broadcastAttacker(player);
    }
}

function handleHit(player: Player, message: ClientToServerProtocolAction): void {
    const attackedMob = player.server.getEntityById(message[1]) as MobLike | null;
    if (attackedMob) {
        const dmg = Formulas.dmg(player.weaponLevel, attackedMob.armorLevel);

        if (dmg > 0) {
            attackedMob.receiveDamage(dmg, player.id);
            player.server.handleMobHate(attackedMob.id, player.id, dmg);
            player.server.handleHurtEntity(attackedMob, player, dmg);
        }
    }
}

function handleHurt(player: Player, message: ClientToServerProtocolAction): void {
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
}

function handleLoot(player: Player, message: ClientToServerProtocolAction): void {
    const droppedItem = player.server.getEntityById(message[1]) as LootEntity | null;

    if (!droppedItem) {
        return;
    }

    const kind = droppedItem.kind;
    if (!Types.isItem(kind)) {
        return;
    }

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
        return;
    }

    if (Types.isHealingItem(kind)) {
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
        return;
    }

    if (Types.isArmor(kind) || Types.isWeapon(kind)) {
        player.equipItem(droppedItem);
        player.broadcast(player.equip(kind));
    }
}

function handleTeleport(player: Player, message: ClientToServerProtocolAction): void {
    const x = Number(message[1]);
    const y = Number(message[2]);

    if (player.server.isValidPosition(x, y)) {
        player.setPosition(x, y);
        player.clearTarget();

        player.broadcast(new Messages.Teleport(player));

        player.server.handlePlayerVanish(player);
        player.server.pushRelevantEntityListTo(player);
    }
}

function handleOpen(player: Player, message: ClientToServerProtocolAction): void {
    const chest = player.server.getEntityById(message[1]);
    if (chest && chest instanceof Chest) {
        player.server.handleOpenedChest(chest, player);
    }
}

function handleCheck(player: Player, message: ClientToServerProtocolAction): void {
    const checkpoint = player.server.map.getCheckpoint(message[1]);
    if (checkpoint) {
        player.lastCheckpoint = checkpoint;
    }
}

export function createPlayerSessionActionDispatcher(
    player: Player,
    closeInvalidPayload: CloseInvalidPayload
): (message: ClientToServerProtocolAction) => boolean {
    const handlers: Partial<Record<ClientToServerProtocolAction[0], ClientDispatchHandler>> = {
        [Types.Messages.HELLO]: (message) =>
            handleHello(player, message as ClientToServerHelloAction, closeInvalidPayload),
        [Types.Messages.WHO]: (message) => handleWho(player, message, closeInvalidPayload),
        [Types.Messages.ZONE]: () => {
            player.emit('zone');
        },
        [Types.Messages.CHAT]: (message) => handleChat(player, message, closeInvalidPayload),
        [Types.Messages.MOVE]: (message) => handleMove(player, message),
        [Types.Messages.LOOTMOVE]: (message) => handleLootMove(player, message),
        [Types.Messages.AGGRO]: (message) => {
            player.server.handleMobHate(Number(message[1]), Number(player.id), 5);
        },
        [Types.Messages.ATTACK]: (message) => handleAttack(player, message),
        [Types.Messages.HIT]: (message) => handleHit(player, message),
        [Types.Messages.HURT]: (message) => handleHurt(player, message),
        [Types.Messages.LOOT]: (message) => handleLoot(player, message),
        [Types.Messages.TELEPORT]: (message) => handleTeleport(player, message),
        [Types.Messages.OPEN]: (message) => handleOpen(player, message),
        [Types.Messages.CHECK]: (message) => handleCheck(player, message),
    };

    return function dispatch(message: ClientToServerProtocolAction): boolean {
        const action = message[0];
        const handler = handlers[action];
        if (!handler) {
            return false;
        }
        handler(message);
        return true;
    };
}
