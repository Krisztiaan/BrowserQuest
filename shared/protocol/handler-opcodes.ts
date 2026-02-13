import Types from '../gametypes-browser';
import type { ClientToServerProtocolAction, ServerToClientProtocolAction } from './types';

export const PLAYER_SESSION_DISPATCH_OPCODES = [
    Types.Messages.HELLO,
    Types.Messages.WHO,
    Types.Messages.ZONE,
    Types.Messages.CHAT,
    Types.Messages.MOVE,
    Types.Messages.LOOTMOVE,
    Types.Messages.AGGRO,
    Types.Messages.ATTACK,
    Types.Messages.HIT,
    Types.Messages.HURT,
    Types.Messages.LOOT,
    Types.Messages.TELEPORT,
    Types.Messages.OPEN,
    Types.Messages.CHECK,
    Types.Messages.ACHIEVEMENT,
] as const satisfies readonly ClientToServerProtocolAction[0][];

export const GAMECLIENT_INBOUND_HANDLER_OPCODES = [
    Types.Messages.WELCOME,
    Types.Messages.MOVE,
    Types.Messages.LOOTMOVE,
    Types.Messages.ATTACK,
    Types.Messages.SPAWN,
    Types.Messages.DESPAWN,
    Types.Messages.HEALTH,
    Types.Messages.CHAT,
    Types.Messages.EQUIP,
    Types.Messages.DROP,
    Types.Messages.TELEPORT,
    Types.Messages.DAMAGE,
    Types.Messages.POPULATION,
    Types.Messages.LIST,
    Types.Messages.DESTROY,
    Types.Messages.KILL,
    Types.Messages.HP,
    Types.Messages.BLINK,
    Types.Messages.ACHIEVEMENTS,
] as const satisfies readonly ServerToClientProtocolAction[0][];
