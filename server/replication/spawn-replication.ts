import type { EntityKind } from '../../shared/entity-kind-domain';
import type { EntityId } from '../../shared/domain/ids';
import { ENTITY_ID_NONE, entityIdToWire } from '../../shared/domain/ids';
import { gridPos, type GridPos } from '../../shared/domain/positions';
import { tileToWorldPosCenter, type WorldPos } from '../../shared/world/worldpos';
import Types from '../../shared/gametypes-browser';
import { encodeSpawnSnapshot, type SpawnExtras, type SpawnSnapshot } from '../../shared/replication/spawn-snapshot';
import type { ServerToClientSpawnAction } from '../../shared/protocol/types';
import type { ComponentType } from '../ecs/component-registry';
import { SparseSetStore, SoaGridPosStore, SoaWorldPosStore } from '../ecs/component-store';
import type { EcsWorld } from '../ecs/world';

export type SpawnReplicationComponents = Readonly<{
    Position: ComponentType<GridPos>;
    PositionSub: ComponentType<WorldPos>;
    Kind: ComponentType<EntityKind>;
    Name: ComponentType<string>;
    Orientation: ComponentType<number>;
    Armor: ComponentType<EntityKind>;
    Weapon: ComponentType<EntityKind>;
    Target: ComponentType<EntityId>;
}>;

export type LegacySpawnReplicationEntity = Readonly<{
    id: EntityId;
    kind: EntityKind;
    x: number;
    y: number;
    mapId?: string;
    name?: string;
    orientation?: number;
    armor?: EntityKind;
    weapon?: EntityKind;
    target?: EntityId | null;
}>;

export function registerSpawnReplicationComponents(world: EcsWorld): SpawnReplicationComponents {
    const Position = world.components.register('Position', new SoaGridPosStore());
    const PositionSub = world.components.register('PositionSub', new SoaWorldPosStore());
    const Kind = world.components.register('ReplicatedKind', new SparseSetStore<EntityKind>());
    const Name = world.components.register('ReplicatedName', new SparseSetStore<string>());
    const Orientation = world.components.register('ReplicatedOrientation', new SparseSetStore<number>());
    const Armor = world.components.register('ReplicatedArmor', new SparseSetStore<EntityKind>());
    const Weapon = world.components.register('ReplicatedWeapon', new SparseSetStore<EntityKind>());
    // Store ENTITY_ID_NONE to represent "no target" to keep the store dense and avoid nullable reads.
    const Target = world.components.register('ReplicatedTarget', new SparseSetStore<EntityId>());
    return { Position, PositionSub, Kind, Name, Orientation, Armor, Weapon, Target };
}

export function syncSpawnReplicationFromLegacyEntity(
    world: EcsWorld,
    components: SpawnReplicationComponents,
    entity: LegacySpawnReplicationEntity
): void {
    world.ensureEntity(entity.id);
    world.addComponent(entity.id, components.Kind, entity.kind);
    world.addComponent(entity.id, components.Position, gridPos(entity.x, entity.y));
    world.addComponent(entity.id, components.PositionSub, tileToWorldPosCenter(entity.x, entity.y));

    if (typeof entity.name === 'string') {
        world.addComponent(entity.id, components.Name, entity.name);
    } else {
        world.removeComponent(entity.id, components.Name);
    }

    if (typeof entity.orientation === 'number') {
        world.addComponent(entity.id, components.Orientation, entity.orientation);
    } else {
        world.removeComponent(entity.id, components.Orientation);
    }

    if (entity.armor !== undefined) {
        world.addComponent(entity.id, components.Armor, entity.armor);
    } else {
        world.removeComponent(entity.id, components.Armor);
    }

    if (entity.weapon !== undefined) {
        world.addComponent(entity.id, components.Weapon, entity.weapon);
    } else {
        world.removeComponent(entity.id, components.Weapon);
    }

    const target = entity.target ?? ENTITY_ID_NONE;
    if (target !== ENTITY_ID_NONE) {
        world.addComponent(entity.id, components.Target, target);
    } else {
        world.removeComponent(entity.id, components.Target);
    }
}

export function buildSpawnActionFromReplicationState(
    world: EcsWorld,
    components: SpawnReplicationComponents,
    id: EntityId,
    mapId?: string
): ServerToClientSpawnAction {
    const kind = world.getComponent(id, components.Kind);
    const pos = world.getComponent(id, components.Position);
    if (kind === undefined || pos === undefined) {
        throw new Error('Spawn replication: missing Kind/Position component');
    }

    const extras = buildSpawnExtras(world, components, id, kind);
    const snapshot: SpawnSnapshot = {
        id: entityIdToWire(id),
        kind,
        x: pos.x,
        y: pos.y,
        ...(typeof mapId === 'string' && mapId.trim().length > 0 ? { mapId } : {}),
        extras,
    };
    return encodeSpawnSnapshot(snapshot);
}

function buildSpawnExtras(
    world: EcsWorld,
    components: SpawnReplicationComponents,
    id: EntityId,
    kind: EntityKind
): SpawnExtras {
    if (Types.isPlayer(kind)) {
        const name = world.getComponent(id, components.Name);
        const orientation = world.getComponent(id, components.Orientation);
        const armor = world.getComponent(id, components.Armor);
        const weapon = world.getComponent(id, components.Weapon);
        if (name === undefined || orientation === undefined || armor === undefined || weapon === undefined) {
            throw new Error('Spawn replication: missing player spawn components');
        }
        const target = world.getComponent(id, components.Target);
        return {
            type: 'player',
            name,
            orientation,
            armor,
            weapon,
            targetId: target !== undefined && target !== ENTITY_ID_NONE ? entityIdToWire(target) : undefined,
        };
    }

    if (Types.isMob(kind)) {
        const orientation = world.getComponent(id, components.Orientation);
        if (orientation === undefined) {
            throw new Error('Spawn replication: missing mob Orientation component');
        }
        const target = world.getComponent(id, components.Target);
        return {
            type: 'mob',
            orientation,
            targetId: target !== undefined && target !== ENTITY_ID_NONE ? entityIdToWire(target) : undefined,
        };
    }

    return { type: 'simple' };
}
