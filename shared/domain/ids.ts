type Brand<T, TBrand extends string> = T & { readonly __brand: TBrand };

// Internally we use packed uint32 ids for performance. Index 0 is reserved as "none".
//
// We intentionally reserve more bits for generation than for index to reduce ABA reuse risk.
// Wire/entity ids still remain full uint32 values, but decomposition into (generation,index)
// now prefers long-lived generation space over oversized concurrent index capacity.
const ENTITY_ID_INDEX_BITS = 20;
const ENTITY_ID_INDEX_MASK = (1 << ENTITY_ID_INDEX_BITS) - 1;
const ENTITY_ID_GENERATION_BITS = 32 - ENTITY_ID_INDEX_BITS;
export const ENTITY_ID_MAX_INDEX = ENTITY_ID_INDEX_MASK;
export const ENTITY_ID_MAX_GENERATION = (1 << ENTITY_ID_GENERATION_BITS) - 1;

export type EntityId = Brand<number, 'EntityId'>;
export type PlayerId = Brand<EntityId, 'PlayerId'>;
export type MobId = Brand<EntityId, 'MobId'>;
export type ItemId = Brand<EntityId, 'ItemId'>;
export type NpcId = Brand<EntityId, 'NpcId'>;

export const ENTITY_ID_NONE = 0 as EntityId;

type EntityIdCandidate = number | string | boolean | bigint | object | null | undefined;

export function isEntityId(value: EntityIdCandidate): value is EntityId {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffff_ffff;
}

export function entityIdFromWire(value: number): EntityId {
    if (!isEntityId(value)) {
        throw new Error(`Invalid wire EntityId: ${String(value)}`);
    }
    return value;
}

export function entityIdFromWireString(value: string): EntityId {
    // Connection ids and other legacy ids are sometimes transmitted as digit strings.
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) {
        throw new Error(`Invalid wire EntityId string: ${String(value)}`);
    }
    return entityIdFromWire(parsed);
}

export function entityIdToWire(id: EntityId): number {
    return id;
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
    return id as PlayerId;
}

export function asMobId(id: EntityId): MobId {
    return id as MobId;
}

export function asItemId(id: EntityId): ItemId {
    return id as ItemId;
}

export function asNpcId(id: EntityId): NpcId {
    return id as NpcId;
}

export function formatEntityId(id: EntityId): string {
    const idx = entityIdIndex(id);
    const gen = entityIdGeneration(id);
    return `${gen}:${idx}`;
}
