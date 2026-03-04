import type { EntityKindName } from '../../shared/entity-kind-domain';

export type MapMobAreaConfig = {
    id: string | number;
    count: number;
    mobKind: EntityKindName;
    x: number;
    y: number;
    width: number;
    height: number;
};

export type MapChestAreaConfig = {
    id: string | number;
    x: number;
    y: number;
    w: number;
    h: number;
    tx: number;
    ty: number;
    i: Array<string | number>;
};

export type MapChestConfig = {
    x: number;
    y: number;
    i: Array<string | number>;
};

type MapConfigValue = string | number | boolean | null | undefined | object;

export const isMapMobAreaConfig = (value: MapConfigValue): value is MapMobAreaConfig => {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const entry = value as Partial<MapMobAreaConfig>;
    return (
        (typeof entry.id === 'string' || typeof entry.id === 'number')
        && typeof entry.count === 'number'
        && typeof entry.mobKind === 'string'
        && typeof entry.x === 'number'
        && typeof entry.y === 'number'
        && typeof entry.width === 'number'
        && typeof entry.height === 'number'
    );
};

export const isMapChestAreaConfig = (value: MapConfigValue): value is MapChestAreaConfig => {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const entry = value as Partial<MapChestAreaConfig>;
    return (
        (typeof entry.id === 'string' || typeof entry.id === 'number')
        && typeof entry.x === 'number'
        && typeof entry.y === 'number'
        && typeof entry.w === 'number'
        && typeof entry.h === 'number'
        && typeof entry.tx === 'number'
        && typeof entry.ty === 'number'
        && Array.isArray(entry.i)
        && entry.i.every((item) => typeof item === 'string' || typeof item === 'number')
    );
};

export const isMapChestConfig = (value: MapConfigValue): value is MapChestConfig => {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const entry = value as Partial<MapChestConfig>;
    return (
        typeof entry.x === 'number'
        && typeof entry.y === 'number'
        && Array.isArray(entry.i)
        && entry.i.every((item) => typeof item === 'string' || typeof item === 'number')
    );
};
