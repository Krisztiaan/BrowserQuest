import Character from './character';
import { attachPlayerSession } from './player-session';
import Log from './log';
import Formulas from './formulas';
import Types from '../shared/gametypes-browser';
import type { ClientToServerProtocolAction } from '../shared/protocol/types';
import { HANDSHAKE_CONTROL } from '../shared/connection-status';
import type { EntityKind } from '../shared/entity-kind-domain';
import type { EntityId } from '../shared/domain/ids';
import { entityIdFromWireString } from '../shared/domain/ids';
import type { Command } from './ecs/commands';
import { buildEquipAction, buildHpAction } from './protocol/outbound-actions';

const log = Log.getLogger();

type PlayerConnectionLike = {
    id: string;
    listen(callback: (message: ClientToServerProtocolAction) => void): void;
    onClose(callback: () => void): void;
    send(payload: unknown): void;
    sendUTF8(payload: string): void;
    close(reason?: string): void;
    closeInvalidPayload?(reason: string): void;
};
type HaterMob = {
    id: EntityId;
    forgetPlayer(playerId: EntityId): void;
};
type CheckpointLike = { id?: string | number };
type EquipableItem = {
    kind: EntityKind;
};
type PlayerServerLike = {
    enqueueCommand(command: Command): void;
};

type PlayerEvents = {
    exit: [];
    move: [x: number, y: number];
    lootMove: [x: number, y: number];
    zone: [];
    orient: [];
    message: [message: ClientToServerProtocolAction];
    broadcast: [message: unknown, ignoreSelf?: boolean];
    broadcastZone: [message: unknown, ignoreSelf?: boolean];
};

class Player extends Character<PlayerEvents> {
    server: PlayerServerLike;
    connection: PlayerConnectionLike;
    name: string;
    hasEnteredGame: boolean;
    isDead: boolean;
    haters: Record<string, HaterMob>;
    armor: EntityKind;
    armorLevel: number;
    weapon: EntityKind;
    weaponLevel: number;
    lastCheckpoint: CheckpointLike | null;
    disconnectTimeout: ReturnType<typeof setTimeout> | null;
    firepotionTimeout: ReturnType<typeof setTimeout> | null;
    positionResolver: (() => { x: number; y: number }) | null;

    constructor(connection: PlayerConnectionLike, worldServer: PlayerServerLike) {
        super(entityIdFromWireString(connection.id), 'player', Types.Entities.WARRIOR, 0, 0);

        this.server = worldServer;
        this.connection = connection;

        this.name = '';
        this.hasEnteredGame = false;
        this.isDead = false;
        this.haters = {};
        this.lastCheckpoint = null;
        this.disconnectTimeout = null;
        this.firepotionTimeout = null;
        this.armor = 0 as EntityKind;
        this.armorLevel = 0;
        this.weapon = 0 as EntityKind;
        this.weaponLevel = 0;
        this.positionResolver = null;
        attachPlayerSession(this);
    }

    override destroy(): void {
        this.attackers = {};
        this.haters = {};
    }

    send(message: unknown): void {
        this.connection.send(message);
    }

    broadcast(message: unknown, ignoreSelf = true): void {
        this.emit('broadcast', message, ignoreSelf);
    }

    broadcastToZone(message: unknown, ignoreSelf = true): void {
        this.emit('broadcastZone', message, ignoreSelf);
    }

    equip(item: EntityKind): unknown {
        return buildEquipAction(this.id, item);
    }

    addHater(mob: HaterMob | null): void {
        if (mob) {
            if (!(mob.id in this.haters)) {
                this.haters[mob.id] = mob;
            }
        }
    }

    removeHater(mob: HaterMob | null): void {
        if (mob && mob.id in this.haters) {
            delete this.haters[mob.id];
        }
    }

    forEachHater(callback: (mob: HaterMob) => void): void {
        Object.values(this.haters).forEach((mob) => {
            callback(mob);
        });
    }

    equipArmor(kind: EntityKind): void {
        this.armor = kind;
        try {
            this.armorLevel = Types.getArmorRank(kind) + 1;
        } catch (_) {
            this.armorLevel = 1;
        }
    }

    equipWeapon(kind: EntityKind): void {
        this.weapon = kind;
        try {
            this.weaponLevel = Types.getWeaponRank(kind) + 1;
        } catch (_) {
            this.weaponLevel = 1;
        }
    }

    equipItem(item: EquipableItem | null | undefined): void {
        if (item) {
            log.debug(this.name + ' equips ' + Types.getKindAsString(item.kind));

            if (Types.isArmor(item.kind)) {
                this.equipArmor(item.kind);
                this.updateHitPoints();
                this.send(buildHpAction(this.maxHitPoints));
            } else if (Types.isWeapon(item.kind)) {
                this.equipWeapon(item.kind);
            }
        }
    }

    updateHitPoints(): void {
        this.resetHitPoints(Formulas.hp(this.armorLevel));
    }

    updatePosition(): void {
        if (this.positionResolver) {
            const pos = this.positionResolver();
            this.setPosition(pos.x, pos.y);
        }
    }

    setPositionResolver(resolver: () => { x: number; y: number }): void {
        this.positionResolver = resolver;
    }

    resetTimeout(): void {
        if (this.disconnectTimeout) {
            clearTimeout(this.disconnectTimeout);
        }
        this.disconnectTimeout = setTimeout(() => this.timeout(), 1000 * 60 * 15); // 15 min.
    }

    timeout(): void {
        this.connection.sendUTF8(HANDSHAKE_CONTROL.TIMEOUT);
        this.connection.close('Player was idle for too long');
    }
}

export default Player;
