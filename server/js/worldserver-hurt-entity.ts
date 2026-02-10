import type { EntityKind } from '../../shared/js/entity-kind-domain';
import type { WorldMessage } from './worldserver-contracts';

type HurtEntityBase = {
    type: string;
    hitPoints: number;
    group: string;
    despawn(): WorldMessage;
};

type HurtPlayerEntity = HurtEntityBase & {
    type: 'player';
    health(): WorldMessage;
};

type HurtMobEntity = HurtEntityBase & {
    type: 'mob';
    id: number;
    kind: EntityKind;
    drop(item: unknown): WorldMessage;
};

type HurtEntity = HurtEntityBase | HurtPlayerEntity | HurtMobEntity;

type PushToPlayer = (player: unknown, message: WorldMessage) => void;
type PushToAdjacentGroups = (groupId: string, message: WorldMessage) => void;
type GetDroppedItem = (mob: HurtMobEntity) => unknown;
type HandleItemDespawn = (item: unknown) => void;
type HandlePlayerVanish = (player: HurtPlayerEntity) => void;
type RemoveEntity = (entity: HurtEntity) => void;
type CreateDamageMessage = (mob: HurtMobEntity, damage: number) => WorldMessage;
type CreateKillMessage = (mob: HurtMobEntity) => WorldMessage;

type HandleWorldHurtEntityParams = {
    entity: HurtEntity;
    attacker: unknown;
    damage: number;
    pushToPlayer: PushToPlayer;
    pushToAdjacentGroups: PushToAdjacentGroups;
    getDroppedItem: GetDroppedItem;
    handleItemDespawn: HandleItemDespawn;
    handlePlayerVanish: HandlePlayerVanish;
    removeEntity: RemoveEntity;
    createDamageMessage: CreateDamageMessage;
    createKillMessage: CreateKillMessage;
};

export function handleWorldHurtEntity({
    entity,
    attacker,
    damage,
    pushToPlayer,
    pushToAdjacentGroups,
    getDroppedItem,
    handleItemDespawn,
    handlePlayerVanish,
    removeEntity,
    createDamageMessage,
    createKillMessage,
}: HandleWorldHurtEntityParams): void {
    if (entity.type === 'player' && typeof (entity as HurtPlayerEntity).health === 'function') {
        pushToPlayer(entity, (entity as HurtPlayerEntity).health());
    }

    if (entity.type === 'mob') {
        pushToPlayer(attacker, createDamageMessage(entity as HurtMobEntity, damage));
    }

    if (entity.hitPoints <= 0) {
        if (entity.type === 'mob') {
            const mob = entity as HurtMobEntity;
            const item = getDroppedItem(mob);

            pushToPlayer(attacker, createKillMessage(mob));
            pushToAdjacentGroups(mob.group, mob.despawn());
            if (item) {
                pushToAdjacentGroups(mob.group, mob.drop(item));
                handleItemDespawn(item);
            }
        }

        if (entity.type === 'player') {
            const player = entity as HurtPlayerEntity;
            handlePlayerVanish(player);
            pushToAdjacentGroups(player.group, player.despawn());
        }

        removeEntity(entity);
    }
}
