import Character from './character';
import Types from '../shared/gametypes-browser';
import type { EntityKind } from '../shared/entity-kind-domain';
import type { EntityId } from '../shared/domain/ids';
import { entityIdFromWireString } from '../shared/domain/ids';

type PlayerConnectionLike = {
    id: string;
};
type HaterMob = {
    id: EntityId;
    forgetPlayer(playerId: EntityId): void;
};
type CheckpointLike = { getRandomPosition?: () => { x: number; y: number } } & { id?: string | number };

type PlayerEvents = {
    exit: [];
    move: [x: number, y: number];
    lootMove: [x: number, y: number];
    zone: [];
    orient: [];
};

class Player extends Character<PlayerEvents> {
    name: string;
    accountNameKey: string;
    hasEnteredGame: boolean;
    isDead: boolean;
    haters: Record<string, HaterMob>;
    armor: EntityKind;
    armorLevel: number;
    weapon: EntityKind;
    weaponLevel: number;
    lastCheckpoint: CheckpointLike | null;
    firepotionTimeout: ReturnType<typeof setTimeout> | null;
    positionResolver: (() => { x: number; y: number }) | null;

    constructor(connection: PlayerConnectionLike, _worldServer: object) {
        super(entityIdFromWireString(connection.id), 'player', Types.Entities.WARRIOR, 0, 0);

        this.name = '';
        this.accountNameKey = '';
        this.hasEnteredGame = false;
        this.isDead = false;
        this.haters = {};
        this.lastCheckpoint = null;
        this.firepotionTimeout = null;
        this.armor = 0 as EntityKind;
        this.armorLevel = 0;
        this.weapon = 0 as EntityKind;
        this.weaponLevel = 0;
        this.positionResolver = null;
    }

    override destroy(): void {
        this.attackers = {};
        this.haters = {};
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

    updatePosition(): void {
        if (this.positionResolver) {
            const pos = this.positionResolver();
            this.setPosition(pos.x, pos.y);
        }
    }

    setPositionResolver(resolver: () => { x: number; y: number }): void {
        this.positionResolver = resolver;
    }
}

export default Player;
