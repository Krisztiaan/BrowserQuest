import Character from './character';
import { attachPlayerSession } from './player-session';
import Log from './log';
import Messages from './message';
import Properties from './properties';
import Formulas from './formulas';
import Types from '../../shared/js/gametypes-browser';
import type Chest from './chest';
import type { ClientToServerProtocolAction } from '../../shared/js/protocol-contract-types';
import { HANDSHAKE_CONTROL } from '../../shared/js/connection-status';
import type { EntityKind } from '../../shared/js/entity-kind-domain';

const log = Log.getLogger();

type PlayerConnectionLike = {
    id: number;
    listen(callback: (message: ClientToServerProtocolAction) => void): void;
    onClose(callback: () => void): void;
    send(payload: unknown): void;
    sendUTF8(payload: string): void;
    close(reason?: string): void;
    closeInvalidPayload?(reason: string): void;
};
type HaterMob = {
    id: number;
    forgetPlayer(playerId: number): void;
};
type MobLike = {
    id: number;
    armorLevel: number;
    weaponLevel: number;
    receiveDamage(dmg: number, playerId: number): void;
    clearTarget?(): void;
};
type LootEntity = {
    id: number;
    kind: EntityKind;
    despawn(): unknown;
};
type CheckpointLike = { id?: string | number };
type EquipableItem = {
    kind: EntityKind;
};
type PlayerServerLike = {
    map: {
        getCheckpoint(id: string | number): CheckpointLike | null;
    };
    addPlayer(player: Player): void;
    emit(eventName: 'playerEnter', player: Player): void;
    pushSpawnsToPlayer(player: Player, entities: Array<string | number>): void;
    isValidPosition(x: number, y: number): boolean;
    getEntityById(id: string | number): MobLike | LootEntity | Chest | null;
    handleMobHate(mobId: number, playerId: number, hate: number): void;
    broadcastAttacker(player: Player): void;
    handleHurtEntity(entity: unknown, attacker?: Player, damage?: number): void;
    pushToPlayer(player: Player, message: unknown): void;
    removeEntity(entity: LootEntity): void;
    handlePlayerVanish(player: Player): void;
    pushRelevantEntityListTo(player: Player): void;
    handleOpenedChest(chest: Chest, player: Player): void;
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
        super(connection.id, 'player', Types.Entities.WARRIOR, 0, 0);

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
        const self = this;

        this.forEachAttacker(function (mob) {
            if (typeof mob.clearTarget === 'function') {
                mob.clearTarget();
            }
        });
        this.attackers = {};

        this.forEachHater(function (mob) {
            mob.forgetPlayer(self.id);
        });
        this.haters = {};
    }

    override getState(): Array<number | string> {
        const basestate = this._getBaseState(),
            state = [this.name, this.orientation, this.armor, this.weapon];

        if (this.target) {
            state.push(this.target);
        }

        return basestate.concat(state);
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

    equip(item: EntityKind): InstanceType<typeof Messages.EquipItem> {
        return new Messages.EquipItem(this, item);
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
        this.armorLevel = Properties.getArmorLevel(kind);
    }

    equipWeapon(kind: EntityKind): void {
        this.weapon = kind;
        this.weaponLevel = Properties.getWeaponLevel(kind);
    }

    equipItem(item: EquipableItem | null | undefined): void {
        if (item) {
            log.debug(this.name + ' equips ' + Types.getKindAsString(item.kind));

            if (Types.isArmor(item.kind)) {
                this.equipArmor(item.kind);
                this.updateHitPoints();
                this.send(new Messages.HitPoints(this.maxHitPoints).serialize());
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
