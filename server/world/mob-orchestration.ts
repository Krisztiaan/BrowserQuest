import type { WorldMessage } from './contracts';
import type { EntityId } from '../../shared/domain/ids';

type MobForHate = {
    hitPoints: number;
    increaseHateFor(playerId: EntityId, hatePoints: number): void;
};

type PlayerForHate = {
    addHater(mob: unknown): void;
};

type GetEntityByIdForHate = (id: EntityId) => unknown;
type IsPlayerForHate = (entity: unknown) => entity is PlayerForHate;
type IsMobForHate = (entity: unknown) => entity is MobForHate;
type ChooseMobTarget = (mob: MobForHate) => void;

type HandleWorldMobHateParams = {
    mobId: EntityId;
    playerId: EntityId;
    hatePoints: number;
    getEntityById: GetEntityByIdForHate;
    isPlayerForHate: IsPlayerForHate;
    isMobForHate: IsMobForHate;
    chooseMobTarget: ChooseMobTarget;
};

type MobHateEntry = {
    id: EntityId;
};

type MobWithLinks = {
    target: EntityId | null;
    hatelist: MobHateEntry[];
};

type PlayerEntity = {
    removeAttacker(mob: unknown): void;
    removeHater(mob: unknown): void;
};

type GetEntityByIdForLinks = (id: EntityId) => unknown;
type IsPlayerEntity = (entity: unknown) => entity is PlayerEntity;

type ClearMobAggroLinkParams = {
    mob: MobWithLinks;
    getEntityById: GetEntityByIdForLinks;
    isPlayerEntity: IsPlayerEntity;
};

type ClearMobHateLinksParams = {
    mob: MobWithLinks | null | undefined;
    getEntityById: GetEntityByIdForLinks;
    isPlayerEntity: IsPlayerEntity;
};

type MobAggroEntity = {
    id: EntityId;
    getHatedPlayerId(hateRank: number | null): EntityId | undefined;
    setTarget(target: unknown): void;
};

type PlayerAggroTarget = {
    id: EntityId;
    attackers: Record<string, unknown>;
    addAttacker(mob: unknown): void;
};

type GetEntityByIdForTarget = (id: EntityId | undefined) => unknown;
type IsPlayerAggroTarget = (entity: unknown) => entity is PlayerAggroTarget;
type ClearMobAggroLink = (mob: MobAggroEntity) => void;
type BroadcastAttacker = (mob: MobAggroEntity) => void;
type LogDebug = (message: string) => void;

type ChooseWorldMobTargetParams = {
    mob: MobAggroEntity;
    hateRank: number | null;
    getEntityById: GetEntityByIdForTarget;
    isPlayerAggroTarget: IsPlayerAggroTarget;
    clearMobAggroLink: ClearMobAggroLink;
    broadcastAttacker: BroadcastAttacker;
    logDebug: LogDebug;
};

type MobWithGroup = {
    group: string;
};

type PushToAdjacentGroupsFn = (groupId: string, message: WorldMessage) => void;
type MoveMessageFactory<TMob extends MobWithGroup> = (mob: TMob) => WorldMessage;
type HandleEntityGroupMembershipFn<TMob extends MobWithGroup> = (entity: TMob) => void;

type HandleWorldMobMoveCallbackParams<TMob extends MobWithGroup> = {
    mob: TMob;
    pushToAdjacentGroups: PushToAdjacentGroupsFn;
    createMoveMessage: MoveMessageFactory<TMob>;
    handleEntityGroupMembership: HandleEntityGroupMembershipFn<TMob>;
};

export function handleWorldMobHate({
    mobId,
    playerId,
    hatePoints,
    getEntityById,
    isPlayerForHate,
    isMobForHate,
    chooseMobTarget,
}: HandleWorldMobHateParams): void {
    const mob = getEntityById(mobId);
    const player = getEntityById(playerId);

    if (isPlayerForHate(player) && isMobForHate(mob)) {
        mob.increaseHateFor(playerId, hatePoints);
        player.addHater(mob);

        if (mob.hitPoints > 0) {
            chooseMobTarget(mob);
        }
    }
}

export function clearWorldMobAggroLink({ mob, getEntityById, isPlayerEntity }: ClearMobAggroLinkParams): void {
    let player: unknown = null;
    if (mob.target) {
        player = getEntityById(mob.target);
        if (isPlayerEntity(player)) {
            player.removeAttacker(mob);
        }
    }
}

export function clearWorldMobHateLinks({ mob, getEntityById, isPlayerEntity }: ClearMobHateLinksParams): void {
    if (mob) {
        mob.hatelist.forEach((entry) => {
            const player = getEntityById(entry.id);
            if (isPlayerEntity(player)) {
                player.removeHater(mob);
            }
        });
    }
}

export function chooseWorldMobTarget({
    mob,
    hateRank,
    getEntityById,
    isPlayerAggroTarget,
    clearMobAggroLink,
    broadcastAttacker,
    logDebug,
}: ChooseWorldMobTargetParams): void {
    const player = getEntityById(mob.getHatedPlayerId(hateRank));

    if (isPlayerAggroTarget(player) && !(mob.id in player.attackers)) {
        clearMobAggroLink(mob);

        player.addAttacker(mob);
        mob.setTarget(player);

        broadcastAttacker(mob);
        logDebug(mob.id + ' is now attacking ' + player.id);
    }
}

export function handleWorldMobMoveCallback<TMob extends MobWithGroup>({
    mob,
    pushToAdjacentGroups,
    createMoveMessage,
    handleEntityGroupMembership,
}: HandleWorldMobMoveCallbackParams<TMob>): void {
    pushToAdjacentGroups(mob.group, createMoveMessage(mob));
    handleEntityGroupMembership(mob);
}
