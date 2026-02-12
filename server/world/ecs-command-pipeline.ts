import type { EntityId } from '../../shared/domain/ids';
import { gridPos, type GridPos } from '../../shared/domain/positions';
import { WorldState } from '../ecs/world-state';
import type { Command } from '../ecs/commands';
import type { DomainEvent } from '../ecs/events';
import { Scheduler, type SchedulerStage, type System, type SystemContext } from '../ecs/scheduler';
import { OUTBOX_RESOURCE, type OutboxMessage } from '../ecs/outbox';
import { Queue } from '../ecs/queues';
import { flushDomainEventsToOutboxSystem } from '../ecs/outbox-systems';
import type { ComponentType } from '../ecs/component-registry';
import { InterestTracker } from '../ecs/interest-tracker';
import { INTEREST_TRACKER_RESOURCE } from '../ecs/spatial-resources';
import { registerCombatComponents } from '../ecs/combat-components';
import Player from '../player';
import Utils from '../utils';
import Formulas from '../formulas';
import Types from '../../shared/gametypes-browser';
import type { EntityKind } from '../../shared/entity-kind-domain';
import Chest from '../chest';
import {
    buildBlinkAction,
    buildChatAction,
    buildDespawnAction,
    buildDestroyAction,
    buildEquipAction,
    buildHpAction,
    buildLootMoveAction,
    buildTeleportAction,
    buildWelcomeAction,
} from '../protocol/outbound-actions';
import type { ServerToClientProtocolAction, ServerToClientSpawnAction } from '../../shared/protocol/types';
import {
    buildSpawnActionFromReplicationState,
    registerSpawnReplicationComponents,
    syncSpawnReplicationFromLegacyEntity,
    type LegacySpawnReplicationEntity,
} from '../replication/spawn-replication';
import { registerEffectsComponents } from '../ecs/effects-components';
import { registerItemLifecycleComponents } from '../ecs/item-lifecycle-components';
import { RESPAWN_TASKS_RESOURCE, type RespawnTask, type RespawnableEntity } from '../ecs/respawn-tasks';
import { registerMobAiComponents, type MobHateEntry } from '../ecs/mob-ai-components';

const HEALING_ITEM_POINTS_BY_KIND: Partial<Record<EntityKind, number>> = {
    [Types.Entities.FLASK]: 40,
    [Types.Entities.BURGER]: 100,
};

type WorldCommandHost = Readonly<{
    ups: number;
    map: {
        getCheckpoint(id: string | number): { id?: string | number } | null;
        getGroupIdFromPosition(x: number, y: number): string;
        forEachAdjacentGroup(groupId: string | null | undefined, callback: (groupId: string) => void): void;
    };
    getConnectionPlayerById(playerId: EntityId): Player | null;
    getEntityById(id: EntityId): unknown;
    addPlayer(player: Player): void;
    emit(eventName: 'playerEnter', player: Player): void;
    pushSpawnsToPlayer(player: Player, entities: EntityId[]): void;
    isValidPosition(x: number, y: number): boolean;
    getDroppedItem(mob: unknown): unknown;
    handleItemDespawn(item: unknown): void;
    moveEntity(entity: unknown, x: number, y: number): void;
    removeEntity(entity: unknown): void;
    pushRelevantEntityListTo(player: Player): void;
    addItemFromChest(kind: unknown, x: number, y: number): unknown;
    pushToAdjacentGroups(groupId: string, message: unknown, ignoredPlayer: EntityId | null): void;
    pushToPlayer(player: Player, message: unknown): void;
}>;

function isPlayer(value: unknown): value is Player {
    return value instanceof Player;
}

function findValidPositionNextTo({
    attacker,
    target,
    isValidPosition,
}: {
    attacker: { x: number; y: number; getPositionNextTo(target: unknown): { x: number; y: number } | null };
    target: unknown;
    isValidPosition: (x: number, y: number) => boolean;
}): { x: number; y: number } {
    const maxAttempts = 32;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const pos = attacker.getPositionNextTo(target);
        if (pos && isValidPosition(pos.x, pos.y)) {
            return pos;
        }
    }
    return { x: attacker.x, y: attacker.y };
}

function syncLegacyMobHateList(mob: unknown, entries: MobHateEntry[]): void {
    const legacy = mob as { hatelist?: unknown };
    if (!legacy || !Array.isArray(legacy.hatelist)) {
        return;
    }
    legacy.hatelist.length = 0;
    for (let i = 0; i < entries.length; i += 1) {
        const entry = entries[i];
        if (entry) {
            (legacy.hatelist as Array<{ id: EntityId; hate: number }>).push({ id: entry.id, hate: entry.hate });
        }
    }
}

function addMobHate({
    state,
    mobAi,
    replication,
    world,
    mobId,
    playerId,
    hatePoints,
}: {
    state: WorldState<Command, DomainEvent>;
    mobAi: ReturnType<typeof registerMobAiComponents>;
    replication: ReturnType<typeof registerSpawnReplicationComponents>;
    world: WorldCommandHost;
    mobId: EntityId;
    playerId: EntityId;
    hatePoints: number;
}): void {
    const kind = replication.Kind.store.get(mobId);
    if (kind === undefined || !Types.isMob(kind)) {
        return;
    }

    const current = mobAi.MobHate.store.get(mobId)?.entries ?? [];
    const next: MobHateEntry[] = current.slice();
    let matched = false;
    for (let i = 0; i < next.length; i += 1) {
        const entry = next[i];
        if (entry && entry.id === playerId) {
            next[i] = { id: playerId, hate: entry.hate + hatePoints };
            matched = true;
            break;
        }
    }
    if (!matched) {
        next.push({ id: playerId, hate: hatePoints });
    }

    state.world.addComponent(mobId, mobAi.MobHate, { entries: next });
    state.world.removeComponent(mobId, mobAi.MobReturnAtTick);

    const mob = world.getEntityById(mobId);
    if (mob) {
        syncLegacyMobHateList(mob, next);
    }
}

function clearPlayerFromMobAggro({
    state,
    mobAi,
    replication,
    world,
    playerId,
    tickNow,
}: {
    state: WorldState<Command, DomainEvent>;
    mobAi: ReturnType<typeof registerMobAiComponents>;
    replication: ReturnType<typeof registerSpawnReplicationComponents>;
    world: WorldCommandHost;
    playerId: EntityId;
    tickNow: number;
}): void {
    const Target = replication.Target;
    const ups = Math.max(1, world.ups);
    const returnDelayTicks = ups * 4;

    const updates: Array<{ mobId: EntityId; nextEntries: MobHateEntry[] }> = [];
    mobAi.MobHate.store.forEach((mobId, hate) => {
        const nextEntries = hate.entries.filter((entry) => entry.id !== playerId);
        if (nextEntries.length !== hate.entries.length) {
            updates.push({ mobId, nextEntries });
        }
    });

    for (let i = 0; i < updates.length; i += 1) {
        const update = updates[i];
        if (!update) {
            continue;
        }
        if (update.nextEntries.length === 0) {
            state.world.removeComponent(update.mobId, mobAi.MobHate);
            state.world.addComponent(update.mobId, mobAi.MobReturnAtTick, tickNow + returnDelayTicks);
        } else {
            state.world.addComponent(update.mobId, mobAi.MobHate, { entries: update.nextEntries });
        }

        const currentTarget = Target.store.get(update.mobId);
        if (currentTarget === playerId) {
            state.world.removeComponent(update.mobId, Target);
            const mob = world.getEntityById(update.mobId) as { target?: EntityId | null } | null;
            if (mob) {
                mob.target = null;
            }
        }

        const mob = world.getEntityById(update.mobId);
        if (mob) {
            syncLegacyMobHateList(mob, update.nextEntries);
        }
    }
}

function applyHello({
    state,
    Position,
    Kind,
    Name,
    Orientation,
    Armor,
    Weapon,
    Target,
    combat,
    world,
    player,
    cmd,
}: {
    state: WorldState<Command, DomainEvent>;
    Position: ComponentType<GridPos>;
    Kind: ComponentType<EntityKind>;
    Name: ComponentType<string>;
    Orientation: ComponentType<number>;
    Armor: ComponentType<EntityKind>;
    Weapon: ComponentType<EntityKind>;
    Target: ComponentType<EntityId>;
    combat: ReturnType<typeof registerCombatComponents>;
    world: WorldCommandHost;
    player: Player;
    cmd: Extract<Command, { type: 'HELLO' }>;
}): void {
    player.name = cmd.name;
    player.kind = Types.Entities.WARRIOR;
    player.equipArmor(cmd.armorKind);
    player.equipWeapon(cmd.weaponKind);
    player.orientation = Utils.randomOrientation();
    player.updateHitPoints();
    player.updatePosition();

    state.world.ensureEntity(player.id);
    state.world.addComponent(player.id, Kind, player.kind);
    state.world.addComponent(player.id, Position, gridPos(player.x, player.y));
    state.world.addComponent(player.id, Name, player.name);
    state.world.addComponent(player.id, Orientation, player.orientation);
    state.world.addComponent(player.id, Armor, player.armor);
    state.world.addComponent(player.id, Weapon, player.weapon);
    state.world.removeComponent(player.id, Target);
    state.world.addComponent(player.id, combat.HitPoints, player.hitPoints);
    state.world.addComponent(player.id, combat.MaxHitPoints, player.maxHitPoints);
    state.world.addComponent(player.id, combat.ArmorLevel, player.armorLevel);
    state.world.addComponent(player.id, combat.WeaponLevel, player.weaponLevel);

    world.addPlayer(player);
    player.send(
        buildWelcomeAction({
            id: player.id,
            name: player.name,
            x: player.x,
            y: player.y,
            hp: player.hitPoints,
        })
    );
    world.emit('playerEnter', player);
    player.hasEnteredGame = true;
    player.isDead = false;
}

function applyMoveCommand({
    state,
    Position,
    Target,
    world,
    player,
    cmd,
}: {
    state: WorldState<Command, DomainEvent>;
    Position: ComponentType<GridPos>;
    Target: ComponentType<EntityId>;
    world: WorldCommandHost;
    player: Player;
    cmd: Extract<Command, { type: 'MOVE' }>;
}): void {
    if (!world.isValidPosition(cmd.to.x, cmd.to.y)) {
        return;
    }
    player.setPosition(cmd.to.x, cmd.to.y);
    player.clearTarget();
    state.world.removeComponent(cmd.source.playerId, Target);
    state.world.addComponent(cmd.source.playerId, Position, cmd.to);
    state.events.push({ type: 'ENTITY_MOVED', entityId: cmd.source.playerId, to: cmd.to });
    player.emit('move', player.x, player.y);
}

function applyLootMoveCommand({
    state,
    Position,
    Target,
    world,
    player,
    cmd,
}: {
    state: WorldState<Command, DomainEvent>;
    Position: ComponentType<GridPos>;
    Target: ComponentType<EntityId>;
    world: WorldCommandHost;
    player: Player;
    cmd: Extract<Command, { type: 'LOOTMOVE' }>;
}): void {
    player.setPosition(cmd.to.x, cmd.to.y);
    state.world.addComponent(cmd.source.playerId, Position, cmd.to);

    const item = world.getEntityById(cmd.itemId);
    if (!item) {
        return;
    }
    player.clearTarget();
    state.world.removeComponent(cmd.source.playerId, Target);
    player.broadcast(buildLootMoveAction(player.id, (item as { id: EntityId }).id));
    player.emit('lootMove', player.x, player.y);
}

function applyAttackCommand({
    state,
    Target,
    world,
    player,
    cmd,
}: {
    state: WorldState<Command, DomainEvent>;
    Target: ComponentType<EntityId>;
    world: WorldCommandHost;
    player: Player;
    cmd: Extract<Command, { type: 'ATTACK' }>;
}): void {
    const target = world.getEntityById(cmd.targetId);
    if (!target || typeof (target as { id?: unknown }).id !== 'number') {
        return;
    }
    player.setTarget(target as { id: EntityId });
    state.world.addComponent(cmd.source.playerId, Target, cmd.targetId);
    state.events.push({ type: 'ENTITY_ATTACKED', attackerId: cmd.source.playerId, targetId: cmd.targetId });
}

function applyHitCommand({
    state,
    combat,
    mobAi,
    replication,
    world,
    player,
    cmd,
}: {
    state: WorldState<Command, DomainEvent>;
    combat: ReturnType<typeof registerCombatComponents>;
    mobAi: ReturnType<typeof registerMobAiComponents>;
    replication: ReturnType<typeof registerSpawnReplicationComponents>;
    world: WorldCommandHost;
    player: Player;
    cmd: Extract<Command, { type: 'HIT' }>;
}): void {
    const attackedMob = world.getEntityById(cmd.attackedMobId) as
        | { id: EntityId; armorLevel: number }
        | null;
    if (!attackedMob) {
        return;
    }

    const mobId = attackedMob.id;
    const mobKind = (attackedMob as { kind?: unknown }).kind as EntityKind | undefined;
    const mobMaxHp = (attackedMob as { maxHitPoints?: unknown }).maxHitPoints as number | undefined;
    const mobHp = (attackedMob as { hitPoints?: unknown }).hitPoints as number | undefined;

    state.world.ensureEntity(mobId);
    if (typeof mobHp === 'number') {
        state.world.addComponent(mobId, combat.HitPoints, mobHp);
    }
    if (typeof mobMaxHp === 'number') {
        state.world.addComponent(mobId, combat.MaxHitPoints, mobMaxHp);
    }
    if (typeof attackedMob.armorLevel === 'number') {
        state.world.addComponent(mobId, combat.ArmorLevel, attackedMob.armorLevel);
    }
    state.world.addComponent(player.id, combat.WeaponLevel, player.weaponLevel);

    const resolvedAttackerWeaponLevel = state.world.getComponent(player.id, combat.WeaponLevel) ?? player.weaponLevel;
    const resolvedMobArmorLevel = state.world.getComponent(mobId, combat.ArmorLevel) ?? attackedMob.armorLevel;
    const dmg = Formulas.dmg(resolvedAttackerWeaponLevel, resolvedMobArmorLevel);
    if (dmg <= 0) {
        return;
    }

    const resolvedMobHp = state.world.getComponent(mobId, combat.HitPoints) ?? mobHp ?? 0;
    const nextMobHp = Math.max(0, resolvedMobHp - dmg);
    state.world.addComponent(mobId, combat.HitPoints, nextMobHp);
    const legacyMob = attackedMob as unknown as { hitPoints?: number };
    if (typeof legacyMob.hitPoints === 'number') {
        legacyMob.hitPoints = nextMobHp;
    }

    addMobHate({ state, mobAi, replication, world, mobId, playerId: player.id, hatePoints: dmg });

    state.events.push({ type: 'ENTITY_DAMAGED', entityId: mobId, damage: dmg, attackerId: player.id });

    if (nextMobHp <= 0) {
        if (mobKind !== undefined) {
            state.events.push({ type: 'MOB_KILLED', mobId, mobKind, killerId: player.id });
        }

        const item = world.getDroppedItem(attackedMob);
        if (item) {
            const dropMsg = (attackedMob as { drop?: (item: unknown) => unknown }).drop?.(item);
            if (Array.isArray(dropMsg) && typeof dropMsg[0] === 'number') {
                const action = dropMsg as unknown as ServerToClientProtocolAction;
                const outbox = state.resources.require(OUTBOX_RESOURCE);
                const x = (attackedMob as { x?: unknown }).x;
                const y = (attackedMob as { y?: unknown }).y;
                const fallbackGroupId =
                    typeof x === 'number' && typeof y === 'number' ? world.map.getGroupIdFromPosition(x, y) : undefined;
                outbox.push({ kind: 'broadcast_nearby', actorId: mobId, action, fallbackGroupId });
            }
            world.handleItemDespawn(item);
        }

        world.removeEntity(attackedMob);
    }
}

function applyHurtCommand({
    state,
    ctx,
    combat,
    mobAi,
    replication,
    world,
    player,
    cmd,
}: {
    state: WorldState<Command, DomainEvent>;
    ctx: SystemContext;
    combat: ReturnType<typeof registerCombatComponents>;
    mobAi: ReturnType<typeof registerMobAiComponents>;
    replication: ReturnType<typeof registerSpawnReplicationComponents>;
    world: WorldCommandHost;
    player: Player;
    cmd: Extract<Command, { type: 'HURT' }>;
}): void {
    const hurtingMob = world.getEntityById(cmd.hurtingMobId) as
        | { id: EntityId; weaponLevel: number }
        | null;
    if (!hurtingMob || player.hitPoints <= 0) {
        return;
    }

    state.world.ensureEntity(player.id);
    state.world.addComponent(player.id, combat.MaxHitPoints, player.maxHitPoints);
    state.world.addComponent(player.id, combat.HitPoints, player.hitPoints);
    state.world.addComponent(player.id, combat.ArmorLevel, player.armorLevel);
    state.world.addComponent(hurtingMob.id, combat.WeaponLevel, hurtingMob.weaponLevel);

    const dmg = Formulas.dmg(hurtingMob.weaponLevel, player.armorLevel);
    const nextHp = Math.max(0, player.hitPoints - dmg);
    player.hitPoints = nextHp;
    state.world.addComponent(player.id, combat.HitPoints, nextHp);
    state.events.push({ type: 'PLAYER_HEALTH_CHANGED', playerId: player.id, hitPoints: nextHp, isRegen: false });

    if (player.hitPoints <= 0) {
        player.isDead = true;
        if (player.firepotionTimeout) {
            clearTimeout(player.firepotionTimeout);
        }
        clearPlayerFromMobAggro({ state, mobAi, replication, world, playerId: player.id, tickNow: ctx.tick });
        world.removeEntity(player);
    }
}

function applyLootCommand({
    state,
    ctx,
    combat,
    replication,
    effects,
    world,
    player,
    cmd,
}: {
    state: WorldState<Command, DomainEvent>;
    ctx: SystemContext;
    combat: ReturnType<typeof registerCombatComponents>;
    replication: ReturnType<typeof registerSpawnReplicationComponents>;
    effects: ReturnType<typeof registerEffectsComponents>;
    world: WorldCommandHost;
    player: Player;
    cmd: Extract<Command, { type: 'LOOT' }>;
}): void {
    const droppedItem = world.getEntityById(cmd.droppedItemId) as
        | { id: EntityId; kind: EntityKind }
        | null;
    if (!droppedItem) {
        return;
    }
    if (!Types.isItem(droppedItem.kind)) {
        return;
    }

    world.removeEntity(droppedItem);

    if (droppedItem.kind === Types.Entities.FIREPOTION) {
        player.updateHitPoints();

        state.world.addComponent(player.id, combat.MaxHitPoints, player.maxHitPoints);
        state.world.addComponent(player.id, combat.HitPoints, player.hitPoints);

        const outbox = state.resources.require(OUTBOX_RESOURCE);
        state.world.removeComponent(player.id, effects.TempVisualEquip);
        outbox.push({ kind: 'to_player', playerId: player.id, action: buildHpAction(player.maxHitPoints) });
        outbox.push({
            kind: 'to_player',
            playerId: player.id,
            action: buildEquipAction(player.id, Types.Entities.FIREFOX),
        });
        outbox.push({
            kind: 'broadcast_nearby',
            actorId: player.id,
            ignoredPlayerId: player.id,
            action: buildEquipAction(player.id, Types.Entities.FIREFOX),
        });

        const durationTicks = world.ups * 15;
        const expiresAtTick = durationTicks > 0 ? ctx.tick + durationTicks : ctx.tick;
        state.world.addComponent(player.id, effects.TempVisualEquip, {
            kind: Types.Entities.FIREFOX,
            revertKind: player.armor,
            expiresAtTick,
        });
        return;
    }

    const healingPoints = HEALING_ITEM_POINTS_BY_KIND[droppedItem.kind];
    if (typeof healingPoints === 'number') {
        if (player.hasFullHealth()) {
            return;
        }
        const nextHp = Math.min(player.maxHitPoints, player.hitPoints + healingPoints);
        if (nextHp === player.hitPoints) {
            return;
        }
        player.hitPoints = nextHp;
        state.world.addComponent(player.id, combat.HitPoints, nextHp);
        state.world.addComponent(player.id, combat.MaxHitPoints, player.maxHitPoints);
        state.events.push({ type: 'PLAYER_HEALTH_CHANGED', playerId: player.id, hitPoints: nextHp, isRegen: false });
        return;
    }

    if (Types.isArmor(droppedItem.kind)) {
        player.equipArmor(droppedItem.kind);
        player.updateHitPoints();

        state.world.addComponent(player.id, replication.Armor, player.armor);
        state.world.addComponent(player.id, combat.ArmorLevel, player.armorLevel);
        state.world.addComponent(player.id, combat.MaxHitPoints, player.maxHitPoints);
        state.world.addComponent(player.id, combat.HitPoints, player.hitPoints);

        const outbox = state.resources.require(OUTBOX_RESOURCE);
        outbox.push({ kind: 'to_player', playerId: player.id, action: buildHpAction(player.maxHitPoints) });
        outbox.push({
            kind: 'to_player',
            playerId: player.id,
            action: buildEquipAction(player.id, droppedItem.kind),
        });
        outbox.push({
            kind: 'broadcast_nearby',
            actorId: player.id,
            ignoredPlayerId: player.id,
            action: buildEquipAction(player.id, droppedItem.kind),
        });
        return;
    }

    if (Types.isWeapon(droppedItem.kind)) {
        player.equipWeapon(droppedItem.kind);

        state.world.addComponent(player.id, replication.Weapon, player.weapon);
        state.world.addComponent(player.id, combat.WeaponLevel, player.weaponLevel);

        const outbox = state.resources.require(OUTBOX_RESOURCE);
        outbox.push({
            kind: 'to_player',
            playerId: player.id,
            action: buildEquipAction(player.id, droppedItem.kind),
        });
        outbox.push({
            kind: 'broadcast_nearby',
            actorId: player.id,
            ignoredPlayerId: player.id,
            action: buildEquipAction(player.id, droppedItem.kind),
        });
        return;
    }
}

function applyTeleportCommand({
    state,
    ctx,
    Position,
    Target,
    mobAi,
    replication,
    world,
    player,
    cmd,
}: {
    state: WorldState<Command, DomainEvent>;
    ctx: SystemContext;
    Position: ComponentType<GridPos>;
    Target: ComponentType<EntityId>;
    mobAi: ReturnType<typeof registerMobAiComponents>;
    replication: ReturnType<typeof registerSpawnReplicationComponents>;
    world: WorldCommandHost;
    player: Player;
    cmd: Extract<Command, { type: 'TELEPORT' }>;
}): void {
    if (!world.isValidPosition(cmd.to.x, cmd.to.y)) {
        return;
    }
    const oldGroupId = world.map.getGroupIdFromPosition(player.x, player.y);
    player.setPosition(cmd.to.x, cmd.to.y);
    state.world.addComponent(cmd.source.playerId, Position, cmd.to);
    player.clearTarget();
    state.world.removeComponent(cmd.source.playerId, Target);

    world.pushToAdjacentGroups(oldGroupId, buildTeleportAction(player.id, player.x, player.y), player.id);
    world.moveEntity(player, player.x, player.y);
    clearPlayerFromMobAggro({ state, mobAi, replication, world, playerId: player.id, tickNow: ctx.tick });
    world.pushRelevantEntityListTo(player);
}

function applyOpenCommand(world: WorldCommandHost, player: Player, cmd: Extract<Command, { type: 'OPEN' }>): void {
    const chest = world.getEntityById(cmd.chestId);
    if (chest && chest instanceof Chest) {
        world.removeEntity(chest);
        const kind = chest.getRandomItem();
        if (kind) {
            const item = world.addItemFromChest(kind, chest.x, chest.y);
            world.handleItemDespawn(item);
        }
    }
}

function applyCheckCommand(world: WorldCommandHost, player: Player, cmd: Extract<Command, { type: 'CHECK' }>): void {
    const checkpoint = world.map.getCheckpoint(cmd.checkpointId);
    if (checkpoint) {
        player.lastCheckpoint = checkpoint;
    }
}

function applyChatCommand(world: WorldCommandHost, player: Player, cmd: Extract<Command, { type: 'CHAT' }>): void {
    if (cmd.message && cmd.message !== '') {
        player.broadcastToZone(buildChatAction(player.id, cmd.message), false);
    }
}

function createApplyInboundCommandsSystem(
    world: WorldCommandHost,
    Position: ComponentType<GridPos>,
    Target: ComponentType<EntityId>,
    replication: ReturnType<typeof registerSpawnReplicationComponents>,
    combat: ReturnType<typeof registerCombatComponents>,
    effects: ReturnType<typeof registerEffectsComponents>,
    mobAi: ReturnType<typeof registerMobAiComponents>
) {
    return (state: WorldState<Command, DomainEvent>, ctx: SystemContext) => {
        const commands = state.commands.drain();
        for (let i = 0; i < commands.length; i += 1) {
            const cmd = commands[i];
            if (!cmd) {
                continue;
            }

            if (cmd.type === 'HELLO') {
                const player = world.getConnectionPlayerById(cmd.source.playerId);
                if (!player) {
                    continue;
                }
                applyHello({
                    state,
                    Position,
                    Kind: replication.Kind,
                    Name: replication.Name,
                    Orientation: replication.Orientation,
                    Armor: replication.Armor,
                    Weapon: replication.Weapon,
                    Target,
                    combat,
                    world,
                    player,
                    cmd,
                });
                continue;
            }

            const entity = world.getEntityById(cmd.source.playerId);
            if (!isPlayer(entity)) {
                continue;
            }
            const player = entity;

            switch (cmd.type) {
                case 'WHO':
                    world.pushSpawnsToPlayer(player, [...cmd.entityIds]);
                    break;
                case 'ZONE':
                    player.emit('zone');
                    break;
                case 'CHAT':
                    applyChatCommand(world, player, cmd);
                    break;
                case 'MOVE':
                    applyMoveCommand({ state, Position, Target, world, player, cmd });
                    break;
                case 'LOOTMOVE':
                    applyLootMoveCommand({ state, Position, Target, world, player, cmd });
                    break;
                case 'AGGRO':
                    addMobHate({ state, mobAi, replication, world, mobId: cmd.mobId, playerId: player.id, hatePoints: 5 });
                    break;
                case 'ATTACK':
                    applyAttackCommand({ state, Target, world, player, cmd });
                    break;
                case 'HIT':
                    applyHitCommand({ state, combat, mobAi, replication, world, player, cmd });
                    break;
                case 'HURT':
                    applyHurtCommand({ state, ctx, combat, mobAi, replication, world, player, cmd });
                    break;
                case 'LOOT':
                    applyLootCommand({ state, ctx, combat, replication, effects, world, player, cmd });
                    break;
                case 'TELEPORT':
                    applyTeleportCommand({ state, ctx, Position, Target, mobAi, replication, world, player, cmd });
                    break;
                case 'OPEN':
                    applyOpenCommand(world, player, cmd);
                    break;
                case 'CHECK':
                    applyCheckCommand(world, player, cmd);
                    break;
                default:
                    // Ensure exhaustive handling when new command types are introduced.
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const _exhaustive: never = cmd;
                    break;
            }
        }
    };
}

export class WorldEcsCommandPipeline {
    readonly state = new WorldState<Command, DomainEvent>();
    readonly #scheduler: Scheduler<Command, DomainEvent>;
    readonly #world: WorldCommandHost;
    readonly replication = registerSpawnReplicationComponents(this.state.world);
    readonly Position = this.replication.Position;
    readonly combat = registerCombatComponents(this.state.world);
    readonly effects = registerEffectsComponents(this.state.world);
    readonly items = registerItemLifecycleComponents(this.state.world);
    readonly mobAi = registerMobAiComponents(this.state.world);
    #tick = 0;

    constructor(world: WorldCommandHost) {
        this.#world = world;
        this.state.resources.set(OUTBOX_RESOURCE, new Queue());
        this.state.resources.set(INTEREST_TRACKER_RESOURCE, new InterestTracker());
        this.state.resources.set(RESPAWN_TASKS_RESOURCE, []);

        this.#scheduler = new Scheduler<Command, DomainEvent>({ nowMs: () => Date.now() });
        this.#scheduler.register(
            'pre',
            'apply_inbound_commands',
            createApplyInboundCommandsSystem(
                world,
                this.Position,
                this.replication.Target,
                this.replication,
                this.combat,
                this.effects,
                this.mobAi
            )
        );
        this.#scheduler.register('sim', 'item_despawn_timers', (state, ctx: SystemContext) => {
            const ItemDespawnTimer = this.items.ItemDespawnTimer;
            const outbox = state.resources.require(OUTBOX_RESOURCE);

            const toBlink: EntityId[] = [];
            const toDestroy: Array<{ id: EntityId; fallbackGroupId?: string }> = [];

            ItemDespawnTimer.store.forEach((id, timer) => {
                if (!timer.blinked && ctx.tick >= timer.blinkAtTick) {
                    toBlink.push(id);
                }
                if (ctx.tick >= timer.destroyAtTick) {
                    const pos = this.Position.store.get(id);
                    const fallbackGroupId =
                        pos !== undefined ? this.#world.map.getGroupIdFromPosition(pos.x, pos.y) : undefined;
                    toDestroy.push({ id, fallbackGroupId });
                }
            });

            for (let i = 0; i < toBlink.length; i += 1) {
                const id = toBlink[i];
                if (id === undefined) {
                    continue;
                }
                const current = ItemDespawnTimer.store.get(id);
                if (!current || current.blinked) {
                    continue;
                }
                state.world.addComponent(id, ItemDespawnTimer, {
                    blinkAtTick: current.blinkAtTick,
                    destroyAtTick: current.destroyAtTick,
                    blinked: true,
                });
                outbox.push({ kind: 'broadcast_nearby', actorId: id, action: buildBlinkAction(id) });
            }

            for (let i = 0; i < toDestroy.length; i += 1) {
                const entry = toDestroy[i];
                if (!entry) {
                    continue;
                }
                outbox.push({
                    kind: 'broadcast_nearby',
                    actorId: entry.id,
                    action: buildDestroyAction(entry.id),
                    fallbackGroupId: entry.fallbackGroupId,
                });

                const entity = this.#world.getEntityById(entry.id);
                if (entity) {
                    this.#world.removeEntity(entity);
                } else {
                    state.world.removeComponent(entry.id, ItemDespawnTimer);
                    this.removeEntity(entry.id);
                }
            }
        });
        this.#scheduler.register('sim', 'respawn_tasks', (state, ctx: SystemContext) => {
            const tasks = state.resources.require(RESPAWN_TASKS_RESOURCE);
            if (tasks.length === 0) {
                return;
            }

            const remaining: RespawnTask[] = [];
            for (let i = 0; i < tasks.length; i += 1) {
                const task = tasks[i];
                if (!task) {
                    continue;
                }
                if (ctx.tick >= task.atTick) {
                    task.entity.emit('respawn');
                } else {
                    remaining.push(task);
                }
            }
            tasks.length = 0;
            tasks.push(...remaining);
        });
        this.#scheduler.register('sim', 'expire_temp_visual_equip', (state, ctx: SystemContext) => {
            const TempVisualEquip = this.effects.TempVisualEquip;
            const outbox = state.resources.require(OUTBOX_RESOURCE);

            const expired: Array<{ id: EntityId; revertKind: EntityKind }> = [];
            TempVisualEquip.store.forEach((id, effect) => {
                if (ctx.tick >= effect.expiresAtTick) {
                    expired.push({ id, revertKind: effect.revertKind });
                }
            });

            for (let i = 0; i < expired.length; i += 1) {
                const entry = expired[i];
                if (!entry) {
                    continue;
                }
                state.world.removeComponent(entry.id, TempVisualEquip);
                outbox.push({
                    kind: 'to_player',
                    playerId: entry.id,
                    action: buildEquipAction(entry.id, entry.revertKind),
                });
                outbox.push({
                    kind: 'broadcast_nearby',
                    actorId: entry.id,
                    ignoredPlayerId: entry.id,
                    action: buildEquipAction(entry.id, entry.revertKind),
                });
            }
        });
        this.#scheduler.register('sim', 'mob_ai', (state, ctx: SystemContext) => {
            const Kind = this.replication.Kind;
            const Position = this.Position;
            const Target = this.replication.Target;
            const { HitPoints } = this.combat;
            const { MobSpawnPos, MobHate, MobReturnAtTick } = this.mobAi;

            const ups = Math.max(1, this.#world.ups);
            const intervalTicks = Math.max(1, Math.floor(ups / 5));
            if (ctx.tick === 0 || ctx.tick % intervalTicks !== 0) {
                return;
            }

            const returnDelayTicks = ups * 4;
            const leashDistance = 50;

            const mobIds: EntityId[] = [];
            Kind.store.forEach((id, kind) => {
                if (kind !== undefined && Types.isMob(kind)) {
                    mobIds.push(id);
                }
            });

            for (let i = 0; i < mobIds.length; i += 1) {
                const mobId = mobIds[i];
                if (mobId === undefined) {
                    continue;
                }

                const legacyMob = this.#world.getEntityById(mobId) as
                    | {
                          id: EntityId;
                          x: number;
                          y: number;
                          spawningX?: number;
                          spawningY?: number;
                          isDead?: boolean;
                          target?: EntityId | null;
                          getPositionNextTo(target: unknown): { x: number; y: number } | null;
                      }
                    | null;
                if (!legacyMob || legacyMob.isDead) {
                    continue;
                }

                let spawn = MobSpawnPos.store.get(mobId);
                if (!spawn) {
                    const spawningX = typeof legacyMob.spawningX === 'number' ? legacyMob.spawningX : legacyMob.x;
                    const spawningY = typeof legacyMob.spawningY === 'number' ? legacyMob.spawningY : legacyMob.y;
                    spawn = gridPos(spawningX, spawningY);
                    state.world.addComponent(mobId, MobSpawnPos, spawn);
                }

                const hate = MobHate.store.get(mobId)?.entries ?? [];
                if (hate.length === 0) {
                    const returnAtTick = MobReturnAtTick.store.get(mobId);
                    if (typeof returnAtTick === 'number' && ctx.tick >= returnAtTick) {
                        state.world.removeComponent(mobId, MobReturnAtTick);
                        if (legacyMob.x !== spawn.x || legacyMob.y !== spawn.y) {
                            this.#world.moveEntity(legacyMob, spawn.x, spawn.y);
                            state.world.addComponent(mobId, Position, gridPos(spawn.x, spawn.y));
                            state.events.push({ type: 'ENTITY_MOVED', entityId: mobId, to: gridPos(spawn.x, spawn.y) });
                        }
                    }
                    continue;
                }

                const filtered: MobHateEntry[] = [];
                for (let j = 0; j < hate.length; j += 1) {
                    const entry = hate[j];
                    if (!entry || entry.hate <= 0) {
                        continue;
                    }
                    const entity = this.#world.getEntityById(entry.id);
                    if (!isPlayer(entity) || entity.hitPoints <= 0 || entity.isDead) {
                        continue;
                    }
                    filtered.push(entry);
                }

                if (filtered.length !== hate.length) {
                    if (filtered.length === 0) {
                        state.world.removeComponent(mobId, MobHate);
                        state.world.addComponent(mobId, MobReturnAtTick, ctx.tick + returnDelayTicks);
                        state.world.removeComponent(mobId, Target);
                        legacyMob.target = null;
                        syncLegacyMobHateList(legacyMob, []);
                        continue;
                    }
                    state.world.addComponent(mobId, MobHate, { entries: filtered });
                    syncLegacyMobHateList(legacyMob, filtered);
                }

                let best: MobHateEntry | null = null;
                for (let j = 0; j < filtered.length; j += 1) {
                    const entry = filtered[j];
                    if (!entry) {
                        continue;
                    }
                    if (!best || entry.hate > best.hate) {
                        best = entry;
                    }
                }
                if (!best) {
                    continue;
                }

                const desiredTargetId = best.id;
                const currentTarget = Target.store.get(mobId);
                if (currentTarget !== desiredTargetId) {
                    state.world.addComponent(mobId, Target, desiredTargetId);
                    legacyMob.target = desiredTargetId;
                    state.events.push({ type: 'ENTITY_ATTACKED', attackerId: mobId, targetId: desiredTargetId });
                }

                const targetEntity = this.#world.getEntityById(desiredTargetId);
                if (!targetEntity) {
                    continue;
                }

                const pos = findValidPositionNextTo({
                    attacker: legacyMob,
                    target: targetEntity,
                    isValidPosition: this.#world.isValidPosition.bind(this.#world),
                });

                if (Utils.distanceTo(pos.x, pos.y, spawn.x, spawn.y) > leashDistance) {
                    state.world.removeComponent(mobId, MobHate);
                    state.world.addComponent(mobId, MobReturnAtTick, ctx.tick + returnDelayTicks);
                    state.world.removeComponent(mobId, Target);
                    legacyMob.target = null;
                    syncLegacyMobHateList(legacyMob, []);
                    continue;
                }

                const currentPos = Position.store.get(mobId) ?? gridPos(legacyMob.x, legacyMob.y);
                if (currentPos.x !== pos.x || currentPos.y !== pos.y) {
                    this.#world.moveEntity(legacyMob, pos.x, pos.y);
                    state.world.addComponent(mobId, Position, gridPos(pos.x, pos.y));
                    state.events.push({ type: 'ENTITY_MOVED', entityId: mobId, to: gridPos(pos.x, pos.y) });
                }
            }
        });
        this.#scheduler.register('sim', 'regen', (state, ctx: SystemContext) => {
            const intervalTicks = this.#world.ups * 2;
            if (ctx.tick === 0 || intervalTicks <= 0 || ctx.tick % intervalTicks !== 0) {
                return;
            }

            const Kind = this.replication.Kind;
            const { HitPoints, MaxHitPoints } = this.combat;
            HitPoints.store.forEach((id, hp) => {
                if (hp <= 0) {
                    return;
                }
                const max = MaxHitPoints.store.get(id);
                if (typeof max !== 'number' || max <= 0 || hp >= max) {
                    return;
                }
                const kind = Kind.store.get(id);
                if (kind === undefined || (!Types.isPlayer(kind) && !Types.isMob(kind))) {
                    return;
                }

                const delta = Math.floor(max / 25);
                if (delta <= 0) {
                    return;
                }
                const next = Math.min(max, hp + delta);
                if (next === hp) {
                    return;
                }
                state.world.addComponent(id, HitPoints, next);

                const legacy = this.#world.getEntityById(id) as { hitPoints?: unknown } | null;
                if (legacy && typeof legacy.hitPoints === 'number') {
                    legacy.hitPoints = next;
                }

                if (Types.isPlayer(kind)) {
                    state.events.push({ type: 'PLAYER_HEALTH_CHANGED', playerId: id, hitPoints: next, isRegen: true });
                }
            });
        });
        this.#scheduler.register('post', 'flush_events_to_outbox', flushDomainEventsToOutboxSystem);
    }

    registerSystem(stage: SchedulerStage, name: string, run: System<Command, DomainEvent>): void {
        this.#scheduler.register(stage, name, run);
    }

    getTick(): number {
        return this.#tick;
    }

    scheduleItemDespawn(
        entity: Readonly<{ id: EntityId }>,
        {
            blinkDelaySeconds = 10,
            blinkingDurationSeconds = 4,
        }: { blinkDelaySeconds?: number; blinkingDurationSeconds?: number } = {},
        tickNow?: number
    ): void {
        const baseTick = tickNow ?? this.#tick;
        const ups = Math.max(1, this.#world.ups);
        const blinkAtTick = baseTick + Math.floor(ups * blinkDelaySeconds);
        const destroyAtTick = blinkAtTick + Math.floor(ups * blinkingDurationSeconds);

        this.state.world.ensureEntity(entity.id);
        this.state.world.addComponent(entity.id, this.items.ItemDespawnTimer, {
            blinkAtTick,
            destroyAtTick,
            blinked: false,
        });
    }

    scheduleStaticRespawn(entity: RespawnableEntity, delaySeconds = 30, tickNow?: number): void {
        const baseTick = tickNow ?? this.#tick;
        const ups = Math.max(1, this.#world.ups);
        const tasks = this.state.resources.require(RESPAWN_TASKS_RESOURCE);
        tasks.push({ atTick: baseTick + Math.floor(ups * delaySeconds), entity });
    }

    syncSpawnReplicationEntity(entity: LegacySpawnReplicationEntity): void {
        syncSpawnReplicationFromLegacyEntity(this.state.world, this.replication, entity);
    }

    removeEntity(id: EntityId): void {
        this.state.resources.get(INTEREST_TRACKER_RESOURCE)?.clearObserver(id);
        if (this.state.world.entities.isAlive(id)) {
            this.state.world.destroyEntity(id);
        }
    }

    enqueue(command: Command): void {
        this.state.commands.push(command);
    }

    buildSpawnActionForLegacyEntity(entity: LegacySpawnReplicationEntity): ServerToClientSpawnAction {
        this.syncSpawnReplicationEntity(entity);
        return buildSpawnActionFromReplicationState(this.state.world, this.replication, entity.id);
    }

    tick(): void {
        this.#scheduler.tick(this.state, this.#tick++);

        const idsByGroup = this.#buildGroupIndex();
        this.#replicateInterest(idsByGroup);

        const outbox = this.state.resources.require(OUTBOX_RESOURCE);
        const messages = outbox.drain();
        for (let i = 0; i < messages.length; i += 1) {
            const msg = messages[i];
            if (!msg) {
                continue;
            }
            if (msg.kind === 'to_player') {
                const player = this.#world.getConnectionPlayerById(msg.playerId);
                if (player && player.hasEnteredGame) {
                    this.#world.pushToPlayer(player, msg.action);
                }
                continue;
            }
            if (msg.kind === 'broadcast_nearby') {
                this.#broadcastNearby(msg, idsByGroup);
            }
        }
    }

    #buildGroupIndex(): Map<string, EntityId[]> {
        const idsByGroup = new Map<string, EntityId[]>();

        this.Position.store.forEach((id, pos) => {
            const groupId = this.#world.map.getGroupIdFromPosition(pos.x, pos.y);
            const list = idsByGroup.get(groupId);
            if (list) {
                list.push(id);
            } else {
                idsByGroup.set(groupId, [id]);
            }
        });

        return idsByGroup;
    }

    #replicateInterest(idsByGroup: Map<string, EntityId[]>): void {
        const interest = this.state.resources.require(INTEREST_TRACKER_RESOURCE);
        const Kind = this.replication.Kind;

        Kind.store.forEach((observerId, kind) => {
            if (!Types.isPlayer(kind)) {
                return;
            }

            const player = this.#world.getConnectionPlayerById(observerId);
            if (!player || !player.hasEnteredGame) {
                interest.clearObserver(observerId);
                return;
            }

            const pos = this.Position.store.get(observerId);
            if (!pos) {
                return;
            }

            const groupId = this.#world.map.getGroupIdFromPosition(pos.x, pos.y);
            const visible: EntityId[] = [];
            this.#world.map.forEachAdjacentGroup(groupId, (adjacent) => {
                const groupIds = idsByGroup.get(adjacent);
                if (groupIds) {
                    visible.push(...groupIds);
                }
            });

            const diff = interest.update(observerId, visible, { excludeSelf: true });
            for (let i = 0; i < diff.enter.length; i += 1) {
                const id = diff.enter[i];
                if (id === undefined) {
                    continue;
                }
                try {
                    this.#world.pushToPlayer(
                        player,
                        buildSpawnActionFromReplicationState(this.state.world, this.replication, id)
                    );
                } catch (_) {
                    // Entity may have been destroyed during this tick or missing replication components.
                }
            }
            for (let i = 0; i < diff.leave.length; i += 1) {
                const id = diff.leave[i];
                if (id === undefined) {
                    continue;
                }
                this.#world.pushToPlayer(player, buildDespawnAction(id));
            }
        });
    }

    #broadcastNearby(msg: Extract<OutboxMessage, { kind: 'broadcast_nearby' }>, idsByGroup: Map<string, EntityId[]>) {
        const pos = this.Position.store.get(msg.actorId);
        const groupId =
            pos !== undefined
                ? this.#world.map.getGroupIdFromPosition(pos.x, pos.y)
                : typeof msg.fallbackGroupId === 'string'
                  ? msg.fallbackGroupId
                  : null;
        if (!groupId) {
            return;
        }

        this.#world.map.forEachAdjacentGroup(groupId, (adjacent) => {
            const ids = idsByGroup.get(adjacent);
            if (!ids) {
                return;
            }
            for (let i = 0; i < ids.length; i += 1) {
                const id = ids[i];
                if (id === undefined || (msg.ignoredPlayerId !== undefined && id === msg.ignoredPlayerId)) {
                    continue;
                }
                const player = this.#world.getConnectionPlayerById(id);
                if (!player || !player.hasEnteredGame) {
                    continue;
                }
                this.#world.pushToPlayer(player, msg.action);
            }
        });
    }
}
