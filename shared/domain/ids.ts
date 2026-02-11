type Brand<T, TBrand extends string> = T & { readonly __brand: TBrand };

// Internally we use packed uint32 ids for performance. Index 0 is reserved as "none".
const ENTITY_ID_INDEX_BITS = 20;
const ENTITY_ID_INDEX_MASK = (1 << ENTITY_ID_INDEX_BITS) - 1;
const ENTITY_ID_GENERATION_BITS = 12;
const ENTITY_ID_MAX_INDEX = ENTITY_ID_INDEX_MASK;
const ENTITY_ID_MAX_GENERATION = (1 << ENTITY_ID_GENERATION_BITS) - 1;

export type EntityId = Brand<number, 'EntityId'>;
export type PlayerId = Brand<EntityId, 'PlayerId'>;
export type MobId = Brand<EntityId, 'MobId'>;
export type ItemId = Brand<EntityId, 'ItemId'>;
export type NpcId = Brand<EntityId, 'NpcId'>;

export const ENTITY_ID_NONE = 0 as EntityId;

export function isEntityId(value: unknown): value is EntityId {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffff_ffff;
}

export function makeEntityId(index: number, generation: number): EntityId {
    if (!Number.isInteger(index) || index < 0 || index > ENTITY_ID_MAX_INDEX) {
        throw new Error(`Invalid EntityId index: ${String(index)}`);
    }
    if (!Number.isInteger(generation) || generation < 0 || generation > ENTITY_ID_MAX_GENERATION) {
        throw new Error(`Invalid EntityId generation: ${String(generation)}`);
    }

    // Ensure uint32 semantics.
    return (((generation << ENTITY_ID_INDEX_BITS) | index) >>> 0) as EntityId;
}

export function entityIdIndex(id: EntityId): number {
    return id & ENTITY_ID_INDEX_MASK;
}

export function entityIdGeneration(id: EntityId): number {
    return id >>> ENTITY_ID_INDEX_BITS;
}

export function isNoneEntityId(id: EntityId): boolean {
    return id === ENTITY_ID_NONE;
}

export function asPlayerId(id: EntityId): PlayerId {
    return id as unknown as PlayerId;
}

export function asMobId(id: EntityId): MobId {
    return id as unknown as MobId;
}

export function asItemId(id: EntityId): ItemId {
    return id as unknown as ItemId;
}

export function asNpcId(id: EntityId): NpcId {
    return id as unknown as NpcId;
}

export function formatEntityId(id: EntityId): string {
    const idx = entityIdIndex(id);
    const gen = entityIdGeneration(id);
    return `${gen}:${idx}`;
}

